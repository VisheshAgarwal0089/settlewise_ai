import { randomUUID } from 'node:crypto';
import { appendAuditEvent } from '../audit/auditService.js';
import { findRefundsForPayment } from '../reconciliation/candidateBuilder.js';
import { scoreCandidate } from '../reconciliation/scoreCandidate.js';
import { calculateMetrics } from '../reconciliation/metrics.js';

export class ReviewError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function currentMatch(database, matchId) {
  const match = database.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
  if (!match) throw new ReviewError('MATCH_NOT_FOUND', 'Match not found', 404);
  return match;
}

function updateBatchMetrics(database, batchId) {
  const metrics = calculateMetrics(database, batchId);
  database.prepare(`UPDATE batches SET auto_match_rate=?,precision=?,recall=?,exception_recall=?,false_match_rate=?,manual_review_rate=?,unexplained_variance_paise=?,updated_at=? WHERE id=?`)
    .run(metrics.autoMatchRate, metrics.precision, metrics.recall, metrics.exceptionRecall, metrics.falseMatchRate, metrics.manualReviewRate, metrics.unexplainedVariancePaise, new Date().toISOString(), batchId);
}

function appendReview(database, { match, userId, action, resultingStatus, selectedSettlementRecordId, note, requestId, payload }) {
  const now = new Date().toISOString();
  database.prepare(`INSERT INTO review_actions
    (id,match_id,user_id,action,previous_status,resulting_status,previous_settlement_record_id,selected_settlement_record_id,note,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), match.id, userId, action, match.status, resultingStatus, match.settlement_record_id, selectedSettlementRecordId ?? null, note ?? null, now);
  appendAuditEvent(database, { batchId: match.batch_id, userId, eventType: action === 'manual_link' ? 'MANUAL_LINK' : action.toUpperCase(), entityType: 'match', entityId: match.id, requestId, payload });
}

function serializeMatch(database, matchId) {
  const row = currentMatch(database, matchId);
  return { id: row.id, batchId: row.batch_id, orderId: row.order_id, settlementRecordId: row.settlement_record_id, status: row.status, confidenceScore: row.confidence_score, matchedBy: row.matched_by, expectedNetPaise: row.expected_net_paise, actualNetPaise: row.actual_net_paise, variancePaise: row.variance_paise, reasonCodes: JSON.parse(row.reason_codes_json), evidence: JSON.parse(row.evidence_json), reviewNote: row.review_note, updatedAt: row.updated_at };
}

export function approveMatch(database, { matchId, userId, note, requestId }) {
  return database.transaction(() => {
    const match = currentMatch(database, matchId);
    if (match.status !== 'pending_review') throw new ReviewError('STALE_REVIEW', 'Only pending-review matches can be approved', 409);
    const evidence = JSON.parse(match.evidence_json); const selected = evidence.rankedCandidates?.[0];
    if (!selected?.settlementRecordId || !database.prepare("SELECT 1 FROM settlement_records WHERE id=? AND batch_id=? AND type='payment'").get(selected.settlementRecordId, match.batch_id)) throw new ReviewError('CANDIDATE_NOT_FOUND', 'The proposed settlement candidate no longer exists', 409);
    if (database.prepare("SELECT 1 FROM matches WHERE settlement_record_id=? AND id<>? AND matched_by='reviewer'").get(selected.settlementRecordId, match.id)) throw new ReviewError('SETTLEMENT_ALREADY_LINKED', 'Settlement record is already manually linked', 409);
    const now = new Date().toISOString();
    database.prepare("UPDATE matches SET settlement_record_id=?,status='matched',matched_by='reviewer',review_note=?,updated_at=? WHERE id=?").run(selected.settlementRecordId, note ?? null, now, match.id);
    appendReview(database, { match, userId, action: 'approve', resultingStatus: 'matched', selectedSettlementRecordId: selected.settlementRecordId, note, requestId, payload: { previousStatus: match.status, resultingStatus: 'matched', selectedSettlementRecordId: selected.settlementRecordId, note: note ?? null } });
    updateBatchMetrics(database, match.batch_id);
    return serializeMatch(database, match.id);
  })();
}

export function rejectMatch(database, { matchId, userId, note, requestId }) {
  return database.transaction(() => {
    const match = currentMatch(database, matchId);
    if (match.status !== 'pending_review') throw new ReviewError('STALE_REVIEW', 'Only pending-review matches can be rejected', 409);
    const now = new Date().toISOString();
    database.prepare("UPDATE matches SET settlement_record_id=NULL,status='unresolved',matched_by='none',review_note=?,updated_at=? WHERE id=?").run(note ?? null, now, match.id);
    appendReview(database, { match, userId, action: 'reject', resultingStatus: 'unresolved', note, requestId, payload: { previousStatus: match.status, resultingStatus: 'unresolved', note: note ?? null } });
    updateBatchMetrics(database, match.batch_id);
    return serializeMatch(database, match.id);
  })();
}

export function manualLinkMatch(database, { matchId, settlementRecordId, userId, note, requestId }) {
  return database.transaction(() => {
    const match = currentMatch(database, matchId);
    if (!['pending_review', 'unresolved'].includes(match.status)) throw new ReviewError('STALE_REVIEW', 'Only pending-review or unresolved matches can be manually linked', 409);
    const order = database.prepare('SELECT * FROM orders WHERE id=?').get(match.order_id);
    const payment = database.prepare("SELECT * FROM settlement_records WHERE id=? AND batch_id=? AND type='payment'").get(settlementRecordId, match.batch_id);
    if (!payment) throw new ReviewError('SETTLEMENT_NOT_FOUND', 'Settlement payment record not found', 404);
    if (database.prepare("SELECT 1 FROM matches WHERE settlement_record_id=? AND id<>? AND matched_by='reviewer'").get(settlementRecordId, match.id)) throw new ReviewError('SETTLEMENT_ALREADY_LINKED', 'Settlement record is already manually linked', 409);
    const scored = scoreCandidate(order, { record: payment, refunds: findRefundsForPayment(database, payment) });
    const evidence = { ...JSON.parse(match.evidence_json), manualLink: { settlementRecordId, score: scored.score, components: scored.components, checks: scored.checks, refundRecordIds: scored.refundRecordIds } };
    const now = new Date().toISOString();
    database.prepare(`UPDATE matches SET settlement_record_id=?,status='matched',matched_by='reviewer',confidence_score=?,actual_net_paise=?,variance_paise=?,reason_codes_json=?,evidence_json=?,review_note=?,updated_at=? WHERE id=?`)
      .run(settlementRecordId, scored.score, scored.actualNetPaise, scored.variancePaise, JSON.stringify(scored.reasonCodes), JSON.stringify(evidence), note ?? null, now, match.id);
    appendReview(database, { match, userId, action: 'manual_link', resultingStatus: 'matched', selectedSettlementRecordId: settlementRecordId, note, requestId, payload: { previousStatus: match.status, resultingStatus: 'matched', selectedSettlementRecordId: settlementRecordId, recalculatedScore: scored.score, checks: scored.checks, note: note ?? null } });
    updateBatchMetrics(database, match.batch_id);
    return serializeMatch(database, match.id);
  })();
}
