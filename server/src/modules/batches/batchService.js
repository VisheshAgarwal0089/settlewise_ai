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
  const statusRows = database.prepare('SELECT status,COUNT(*) count FROM matches WHERE batch_id=? GROUP BY status').all(id);
  const statusCounts = { matched: 0, pendingReview: 0, unresolved: 0 };
  for (const item of statusRows) statusCounts[item.status === 'pending_review' ? 'pendingReview' : item.status] = item.count;
  return {
    id: row.id, name: row.name, sourceMode: row.source_mode, status: row.status,
    requestedCount: row.requested_count, orderCount: row.order_count, settlementRecordCount: row.settlement_record_count,
    matchingStartedAt: row.matching_started_at, matchingCompletedAt: row.matching_completed_at,
    statusCounts, metrics: {
      matchingDurationMs: row.matching_duration_ms, explanationDurationMs: row.explanation_duration_ms,
      autoMatchRate: row.auto_match_rate, precision: row.precision, recall: row.recall,
      exceptionRecall: row.exception_recall, falseMatchRate: row.false_match_rate,
      manualReviewRate: row.manual_review_rate, unexplainedVariancePaise: row.unexplained_variance_paise
    },
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function pageValues(query) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? '20', 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function listBatches(database, query = {}) {
  const { page, pageSize, offset } = pageValues(query);
  const total = database.prepare('SELECT COUNT(*) count FROM batches').get().count;
  const data = database.prepare('SELECT id FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset).map(({ id }) => getBatch(database, id));
  return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export function listRecords(database, batchId, query = {}) {
  if (!getBatch(database, batchId)) { const error = new Error('Batch not found'); error.status = 404; error.code = 'BATCH_NOT_FOUND'; throw error; }
  const { page, pageSize, offset } = pageValues(query);
  const clauses = ['o.batch_id = @batchId']; const params = { batchId, pageSize, offset };
  if (['matched', 'pending_review', 'unresolved'].includes(query.status)) { clauses.push('m.status = @status'); params.status = query.status; }
  if (query.case) { clauses.push('o.generation_case = @case'); params.case = query.case; }
  if (query.search) { clauses.push('(o.merchant_order_id LIKE @search OR o.order_receipt LIKE @search OR s.entity_id LIKE @search)'); params.search = `%${String(query.search).slice(0, 100)}%`; }
  const where = clauses.join(' AND ');
  const total = database.prepare(`SELECT COUNT(*) count FROM orders o LEFT JOIN matches m ON m.order_id=o.id LEFT JOIN settlement_records s ON s.id=m.settlement_record_id WHERE ${where}`).get(params).count;
  const rows = database.prepare(`SELECT o.id order_id,o.merchant_order_id,o.order_receipt,o.gross_amount_paise,o.refund_amount_paise,o.expected_net_paise,o.order_date_utc,o.generation_case,
    m.id match_id,m.status,m.confidence_score,m.matched_by,m.actual_net_paise,m.variance_paise,m.reason_codes_json,
    s.id settlement_record_id,s.entity_id,s.settlement_id,s.settlement_utr
    FROM orders o LEFT JOIN matches m ON m.order_id=o.id LEFT JOIN settlement_records s ON s.id=m.settlement_record_id
    WHERE ${where} ORDER BY o.created_at DESC,o.merchant_order_id LIMIT @pageSize OFFSET @offset`).all(params);
  const data = rows.map((row) => ({
    orderId: row.order_id, merchantOrderId: row.merchant_order_id, orderReceipt: row.order_receipt,
    grossAmountPaise: row.gross_amount_paise, refundAmountPaise: row.refund_amount_paise, expectedNetPaise: row.expected_net_paise,
    orderDateUtc: row.order_date_utc, generationCase: row.generation_case,
    match: row.match_id ? { id: row.match_id, status: row.status, confidenceScore: row.confidence_score, matchedBy: row.matched_by, actualNetPaise: row.actual_net_paise, variancePaise: row.variance_paise, reasonCodes: JSON.parse(row.reason_codes_json), settlement: row.settlement_record_id ? { id: row.settlement_record_id, entityId: row.entity_id, settlementId: row.settlement_id, settlementUtr: row.settlement_utr } : null } : null
  }));
  return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize), filters: { status: query.status ?? null, case: query.case ?? null, search: query.search ?? null } } };
}

export function listReviewQueue(database, batchId, query = {}) {
  const result = listRecords(database, batchId, { ...query, status: 'pending_review' });
  const detail = database.prepare('SELECT evidence_json FROM matches WHERE id=?');
  return { ...result, data: result.data.map((record) => ({ ...record, deterministicEvidence: JSON.parse(detail.get(record.match.id).evidence_json) })) };
}
