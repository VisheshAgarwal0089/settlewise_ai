import { afterEach, describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';
import { openDatabase } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { createBatch } from '../../src/modules/batches/batchService.js';
import { importCsv } from '../../src/modules/ingestion/ingestionService.js';
import { generateOrders } from '../../src/modules/generator/generatorService.js';
import { reconcileBatch } from '../../src/modules/reconciliation/reconcileBatch.js';
import { CSV_HEADERS } from '../../src/config/constants.js';

const databases = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
function databaseFixture() { const database = openDatabase(':memory:'); migrate(database); databases.push(database); return database; }

function csvFixture(count) {
  const rows = [CSV_HEADERS.join(',')];
  for (let index = 0; index < count; index += 1) {
    const amount = 100000 + Math.floor(index / 2) * 2500;
    const fee = amount / 50; const tax = fee * 18 / 100; const credit = amount - fee - tax;
    rows.push([`entity-${index}`, 'payment', amount, 'INR', fee, tax, credit, 0, 1, 1788217200 + index, 1788303600 + index, `settlement-${index}`, `utr-${index}`, `provider-order-${index}`, `receipt-${index}`, `payment-${index}`].join(','));
  }
  return Buffer.from(`${rows.join('\n')}\n`);
}

describe('Phase 6 measured workflows', () => {
  it('completes the canonical 150-order CSV workflow with held-out metrics and no truth leakage', () => {
    const database = databaseFixture();
    const batch = createBatch(database, { name: 'Held-out 150 workflow', sourceMode: 'csv', requestedCount: 150 });
    importCsv(database, { batchId: batch.id, buffer: csvFixture(150), originalName: 'held-out.csv', requestId: 'upload-150' });
    const generated = generateOrders(database, { batchId: batch.id, count: 150, seed: 'phase6-held-out-seed', requestId: 'generate-150' });
    const result = reconcileBatch(database, { batchId: batch.id, requestId: 'reconcile-150' });
    expect(generated.count).toBe(150); expect(result.counts.total).toBe(150);
    expect(database.prepare('SELECT COUNT(*) count FROM evaluation_truth').get().count).toBe(150);
    expect(result.counts).toEqual({ total: 150, matched: 123, pendingReview: 23, unresolved: 4 });
    expect(result.metrics).toMatchObject({ precision: 1, recall: 123 / 146, autoMatchRate: 123 / 146, exceptionRecall: 0.9, falseMatchRate: 0, manualReviewRate: 23 / 150 });
    expect(result.metrics.denominators).toEqual(expect.objectContaining({ totalOrders: 150, groundTruthMatchableOrders: 146 }));
    expect(JSON.stringify(result)).not.toMatch(/expectedSettlementRecordId|expected_settlement_record_id|isMatchable|is_matchable|evaluation_truth/);
  });

  it('reconciles 500 orders within 30 seconds using integer-paise records', () => {
    const database = databaseFixture(); const now = new Date().toISOString();
    const batch = createBatch(database, { name: '500-order performance', sourceMode: 'csv', requestedCount: 500 });
    database.prepare(`INSERT INTO data_imports (id,batch_id,source,status,record_count,created_at,completed_at) VALUES ('performance-import',?,'csv_fallback','succeeded',500,?,?)`).run(batch.id, now, now);
    const settlement = database.prepare(`INSERT INTO settlement_records (id,batch_id,import_id,entity_id,type,order_id,order_receipt,payment_id,amount_paise,fee_paise,tax_paise,credit_paise,debit_paise,currency,settled,created_at_utc,settled_at_utc,raw_payload_json,created_at) VALUES (@id,@batchId,'performance-import',@entityId,'payment',@merchantOrderId,@receipt,@id,@gross,@fee,@tax,@net,0,'INR',1,@date,@date,'{}',@now)`);
    const order = database.prepare(`INSERT INTO orders (id,batch_id,merchant_order_id,order_receipt,gross_amount_paise,refund_amount_paise,expected_fee_paise,expected_tax_paise,expected_net_paise,order_date_utc,currency,generation_case,created_at) VALUES (@orderRowId,@batchId,@merchantOrderId,@receipt,@gross,0,@fee,@tax,@net,@date,'INR','normal',@now)`);
    const truth = database.prepare(`INSERT INTO evaluation_truth (order_id,expected_settlement_record_id,is_matchable,is_anomaly,expected_case,created_at) VALUES (@orderRowId,@id,1,0,'normal',@now)`);
    database.transaction(() => {
      for (let index = 0; index < 500; index += 1) {
        const gross = 100000 + index * 2500; const fee = gross / 50; const tax = fee * 18 / 100;
        const values = { id: `payment-${index}`, orderRowId: `order-row-${index}`, batchId: batch.id, entityId: `entity-${index}`, merchantOrderId: `order-${index}`, receipt: `receipt-${index}`, gross, fee, tax, net: gross - fee - tax, date: '2026-09-01T00:00:00.000Z', now };
        settlement.run(values); order.run(values); truth.run(values);
      }
      database.prepare('UPDATE batches SET order_count=500,settlement_record_count=500 WHERE id=?').run(batch.id);
    })();
    const started = performance.now(); const result = reconcileBatch(database, { batchId: batch.id, requestId: 'performance-500' }); const wallTimeMs = performance.now() - started;
    expect(result.counts).toEqual({ total: 500, matched: 500, pendingReview: 0, unresolved: 0 });
    expect(result.metrics).toMatchObject({ precision: 1, recall: 1, autoMatchRate: 1, falseMatchRate: 0 });
    expect(result.metrics.matchingDurationMs).toBeLessThan(30000); expect(wallTimeMs).toBeLessThan(30000);
    expect(database.prepare('SELECT COUNT(*) count FROM matches').get().count).toBe(500);
  }, 35000);
});
