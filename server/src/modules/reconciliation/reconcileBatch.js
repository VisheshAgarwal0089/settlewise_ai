import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { appendAuditEvent } from '../audit/auditService.js';
import { buildCandidates } from './candidateBuilder.js';
import { classifyMatch, scoreCandidate } from './scoreCandidate.js';
import { calculateMetrics } from './metrics.js';
import { REASON_CODES } from './reasonCodes.js';

export class ReconciliationError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function manuallyLinkedElsewhere(database, settlementRecordId, orderId) {
  return Boolean(database.prepare(`SELECT 1 FROM matches
    WHERE settlement_record_id = ? AND order_id <> ? AND matched_by = 'reviewer' LIMIT 1`).get(settlementRecordId, orderId));
}

export function reconcileBatch(database, { batchId, userId, requestId }) {
  const batch = database.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) throw new ReconciliationError('BATCH_NOT_FOUND', 'Batch not found', 404);
  if (batch.status === 'processing') throw new ReconciliationError('RECONCILIATION_IN_PROGRESS', 'Batch reconciliation is already processing', 409);
  if (database.prepare('SELECT 1 FROM matches WHERE batch_id = ? LIMIT 1').get(batchId)) throw new ReconciliationError('BATCH_ALREADY_RECONCILED', 'Batch has already been reconciled', 409);
  if (!database.prepare('SELECT 1 FROM orders WHERE batch_id = ? LIMIT 1').get(batchId)) throw new ReconciliationError('ORDERS_REQUIRED', 'Generate orders before reconciliation');
  if (!database.prepare('SELECT 1 FROM settlement_records WHERE batch_id = ? LIMIT 1').get(batchId)) throw new ReconciliationError('SETTLEMENTS_REQUIRED', 'Import settlement records before reconciliation');

  const transaction = database.transaction(() => {
    const startedAt = new Date().toISOString();
    database.prepare("UPDATE batches SET status = 'processing', matching_started_at = ?, error_code = NULL, updated_at = ? WHERE id = ?").run(startedAt, startedAt, batchId);
    const started = performance.now();
    const orders = database.prepare('SELECT * FROM orders WHERE batch_id = ? ORDER BY id').all(batchId);
    const insert = database.prepare(`INSERT INTO matches
      (id,batch_id,order_id,settlement_record_id,status,confidence_score,matched_by,expected_net_paise,actual_net_paise,variance_paise,reason_codes_json,evidence_json,algorithm_version,created_at,updated_at)
      VALUES (@id,@batchId,@orderId,@settlementRecordId,@status,@confidenceScore,@matchedBy,@expectedNetPaise,@actualNetPaise,@variancePaise,@reasonCodesJson,@evidenceJson,'1.0.0',@createdAt,@updatedAt)`);
    const counts = { total: orders.length, matched: 0, pendingReview: 0, unresolved: 0 };
    for (const order of orders) {
      const rankedCandidates = buildCandidates(database, order).map((candidate) => ({
        source: candidate.source,
        ...scoreCandidate(order, candidate, { manuallyLinkedElsewhere: manuallyLinkedElsewhere(database, candidate.record.id, order.id) })
      })).sort((left, right) => right.score - left.score || left.entityId.localeCompare(right.entityId));
      const best = rankedCandidates[0] ?? null;
      const ambiguous = rankedCandidates.length > 1 && best.score - rankedCandidates[1].score <= 5;
      const status = best ? classifyMatch({ score: best.score, ambiguous, hardGatesPass: best.hardGatesPass }) : 'unresolved';
      const reasonCodes = best ? [...best.reasonCodes] : [REASON_CODES.NO_CANDIDATE];
      if (ambiguous) reasonCodes.push(REASON_CODES.AMBIGUOUS_CANDIDATES);
      const evidence = { algorithmVersion: '1.0.0', ambiguous, candidateCount: rankedCandidates.length, rankedCandidates };
      const now = new Date().toISOString();
      const matchId = randomUUID();
      insert.run({ id: matchId, batchId, orderId: order.id, settlementRecordId: status === 'matched' ? best.settlementRecordId : null, status, confidenceScore: best?.score ?? 0, matchedBy: status === 'matched' ? 'engine' : 'none', expectedNetPaise: order.expected_net_paise, actualNetPaise: best?.actualNetPaise ?? null, variancePaise: best?.variancePaise ?? null, reasonCodesJson: JSON.stringify(reasonCodes), evidenceJson: JSON.stringify(evidence), createdAt: now, updatedAt: now });
      appendAuditEvent(database, { batchId, userId, eventType: 'MATCH_RESULT', entityType: 'match', entityId: matchId, requestId, payload: { orderId: order.id, status, confidenceScore: best?.score ?? 0, reasonCodes } });
      if (status === 'matched') counts.matched += 1;
      else if (status === 'pending_review') counts.pendingReview += 1;
      else counts.unresolved += 1;
    }
    const matchingDurationMs = Math.max(0, Math.round(performance.now() - started));
    const metrics = calculateMetrics(database, batchId);
    const completedAt = new Date().toISOString();
    database.prepare(`UPDATE batches SET status = 'completed', matching_completed_at = ?, matching_duration_ms = ?,
      auto_match_rate = ?, precision = ?, recall = ?, exception_recall = ?, false_match_rate = ?, manual_review_rate = ?,
      unexplained_variance_paise = ?, updated_at = ? WHERE id = ?`).run(completedAt, matchingDurationMs, metrics.autoMatchRate, metrics.precision, metrics.recall, metrics.exceptionRecall, metrics.falseMatchRate, metrics.manualReviewRate, metrics.unexplainedVariancePaise, completedAt, batchId);
    const throughput = matchingDurationMs === 0 ? null : counts.total * 1000 / matchingDurationMs;
    return { batchId, counts, metrics: { ...metrics, matchingDurationMs, throughput } };
  });
  return transaction();
}
