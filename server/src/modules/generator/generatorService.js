import { createHash } from 'node:crypto';
import { appendAuditEvent } from '../audit/auditService.js';

export const CANONICAL_CASE_COUNTS = Object.freeze({
  normal: 120,
  amount_mismatch: 4,
  date_mismatch: 4,
  missing_reference: 4,
  duplicate_candidate: 4,
  fee_mismatch: 4,
  tax_mismatch: 3,
  refund_mismatch: 3,
  missing_settlement: 4
});

export class GeneratorError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function seedNumber(seed) {
  return createHash('sha256').update(String(seed ?? 'settlewise-demo')).digest().readUInt32LE(0);
}

function randomFactory(seed) {
  let state = seedNumber(seed) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}

function shuffle(values, random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const selected = Math.floor(random() * (index + 1));
    [copy[index], copy[selected]] = [copy[selected], copy[index]];
  }
  return copy;
}

function deterministicUuid(seed, namespace, index) {
  const hex = createHash('sha256').update(`${seed}:${namespace}:${index}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function plusDays(iso, days) { const date = new Date(iso); date.setUTCDate(date.getUTCDate() + days); return date.toISOString(); }
function fee(gross) { return gross / 50; }
function tax(expectedFee) { return expectedFee * 18 / 100; }

export function generateOrders(database, { batchId, count, seed = 'settlewise-demo', userId, requestId }) {
  if (count !== 150) throw new GeneratorError('GENERATOR_COUNT_INVALID', 'The canonical generator requires exactly 150 orders');
  const batch = database.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) throw new GeneratorError('BATCH_NOT_FOUND', 'Batch not found', 404);
  if (database.prepare('SELECT 1 FROM orders WHERE batch_id = ? LIMIT 1').get(batchId)) throw new GeneratorError('ORDERS_ALREADY_GENERATED', 'Orders have already been generated for this batch', 409);
  const candidates = database.prepare(`SELECT * FROM settlement_records
    WHERE batch_id = ? AND type = 'payment' AND amount_paise > 0 AND amount_paise % 2500 = 0
    ORDER BY entity_id`).all(batchId);
  if (candidates.length < 146) throw new GeneratorError('INSUFFICIENT_SOURCE_RECORDS', 'At least 146 eligible payment records are required to generate 150 orders');
  const random = randomFactory(seed);
  const shuffledCandidates = shuffle(candidates, random);
  const amountCounts = new Map(candidates.map((record) => [record.amount_paise, (candidates.filter((other) => other.amount_paise === record.amount_paise)).length]));
  const duplicateSources = shuffledCandidates.filter((record) => amountCounts.get(record.amount_paise) > 1).slice(0, CANONICAL_CASE_COUNTS.duplicate_candidate);
  if (duplicateSources.length < CANONICAL_CASE_COUNTS.duplicate_candidate) throw new GeneratorError('INSUFFICIENT_AMBIGUOUS_RECORDS', 'At least four payment records with duplicate candidate amounts are required');
  const reservedIds = new Set(duplicateSources.map((record) => record.id));
  const regularSources = shuffledCandidates.filter((record) => !reservedIds.has(record.id)).slice(0, 142);
  const cases = shuffle(Object.entries(CANONICAL_CASE_COUNTS).flatMap(([name, amount]) => Array(amount).fill(name)), random);
  const now = new Date().toISOString();
  const insertOrder = database.prepare(`INSERT INTO orders
    (id,batch_id,merchant_order_id,order_receipt,gross_amount_paise,refund_amount_paise,expected_fee_paise,expected_tax_paise,expected_net_paise,order_date_utc,currency,generation_case,created_at)
    VALUES (@id,@batchId,@merchantOrderId,@orderReceipt,@gross,@refund,@expectedFee,@expectedTax,@expectedNet,@orderDateUtc,'INR',@generationCase,@createdAt)`);
  const insertTruth = database.prepare(`INSERT INTO evaluation_truth
    (order_id,expected_settlement_record_id,is_matchable,is_anomaly,expected_case,created_at)
    VALUES (?,?,?,?,?,?)`);
  const transaction = database.transaction(() => {
    let sourceIndex = 0; let duplicateIndex = 0;
    for (let index = 0; index < count; index += 1) {
      const generationCase = cases[index];
      const source = generationCase === 'duplicate_candidate' ? duplicateSources[duplicateIndex++] : generationCase === 'missing_settlement' ? shuffledCandidates[index % shuffledCandidates.length] : regularSources[sourceIndex++];
      const id = deterministicUuid(seed, 'order', index);
      let merchantOrderId = source.order_id || `SW-${seed}-${index}`;
      let orderReceipt = source.order_receipt;
      let gross = source.amount_paise;
      let refund = 0;
      let orderDateUtc = source.created_at_utc;
      if (generationCase === 'amount_mismatch' || generationCase === 'fee_mismatch' || generationCase === 'tax_mismatch') gross += 2500;
      if (generationCase === 'date_mismatch') orderDateUtc = plusDays(orderDateUtc, 5);
      if (generationCase === 'missing_reference' || generationCase === 'duplicate_candidate' || generationCase === 'missing_settlement') { merchantOrderId = `SW-MISSING-${seed}-${index}`; orderReceipt = null; }
      if (generationCase === 'refund_mismatch') refund = Math.min(2500, gross);
      const expectedFee = fee(gross); const expectedTax = tax(expectedFee);
      if (!Number.isInteger(expectedFee) || !Number.isInteger(expectedTax)) throw new GeneratorError('INVALID_GENERATED_MONEY', 'Generated money must resolve to integer paise');
      insertOrder.run({ id, batchId, merchantOrderId, orderReceipt, gross, refund, expectedFee, expectedTax, expectedNet: gross - expectedFee - expectedTax - refund, orderDateUtc, generationCase, createdAt: now });
      insertTruth.run(id, generationCase === 'missing_settlement' ? null : source.id, generationCase === 'missing_settlement' ? 0 : 1, generationCase === 'normal' ? 0 : 1, generationCase, now);
    }
    database.prepare('UPDATE batches SET order_count = ?, updated_at = ? WHERE id = ?').run(count, now, batchId);
    appendAuditEvent(database, { batchId, userId, eventType: 'SEED_GENERATED', entityType: 'batch', entityId: batchId, requestId, payload: { count, seed: String(seed), caseCounts: CANONICAL_CASE_COUNTS } });
  });
  transaction();
  return { batchId, count, seed: String(seed), caseCounts: CANONICAL_CASE_COUNTS };
}
