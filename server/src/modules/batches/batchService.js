import { randomUUID } from 'node:crypto';

export function createBatch(database, input) {
  const now = new Date().toISOString();
  const batch = { id: randomUUID(), name: input.name, sourceMode: input.sourceMode, status: 'uploaded', requestedCount: input.requestedCount, orderCount: 0, settlementRecordCount: 0, createdAt: now, updatedAt: now };
  database.prepare(`INSERT INTO batches (id,name,source_mode,status,requested_count,order_count,settlement_record_count,created_at,updated_at)
    VALUES (@id,@name,@sourceMode,@status,@requestedCount,@orderCount,@settlementRecordCount,@createdAt,@updatedAt)`).run(batch);
  return batch;
}

export function getBatch(database, id) {
  const row = database.prepare(`SELECT id,name,source_mode,status,requested_count,order_count,settlement_record_count,
    matching_started_at,matching_completed_at,matching_duration_ms,explanation_duration_ms,auto_match_rate,
    precision,recall,exception_recall,false_match_rate,manual_review_rate,unexplained_variance_paise,created_at,updated_at
    FROM batches WHERE id = ?`).get(id);
  if (!row) return null;
  return {
    id: row.id, name: row.name, sourceMode: row.source_mode, status: row.status,
    requestedCount: row.requested_count, orderCount: row.order_count, settlementRecordCount: row.settlement_record_count,
    matchingStartedAt: row.matching_started_at, matchingCompletedAt: row.matching_completed_at,
    metrics: {
      matchingDurationMs: row.matching_duration_ms, explanationDurationMs: row.explanation_duration_ms,
      autoMatchRate: row.auto_match_rate, precision: row.precision, recall: row.recall,
      exceptionRecall: row.exception_recall, falseMatchRate: row.false_match_rate,
      manualReviewRate: row.manual_review_rate, unexplainedVariancePaise: row.unexplained_variance_paise
    },
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}
