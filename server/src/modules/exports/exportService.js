import { appendAuditEvent } from '../audit/auditService.js';

const headers = ['merchant_order_id', 'order_receipt', 'gross_amount_paise', 'refund_amount_paise', 'expected_fee_paise', 'expected_tax_paise', 'expected_net_paise', 'entity_id', 'settlement_id', 'settlement_utr', 'actual_net_paise', 'variance_paise', 'confidence_score', 'status', 'matched_by', 'reason_codes'];

export function protectFormula(value) {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const protectedValue = protectFormula(value);
  return /[",\r\n]/.test(protectedValue) ? `"${protectedValue.replaceAll('"', '""')}"` : protectedValue;
}

export function exportBatchCsv(database, { batchId, userId, requestId }) {
  const batch = database.prepare('SELECT id,name FROM batches WHERE id=?').get(batchId);
  if (!batch) { const error = new Error('Batch not found'); error.code = 'BATCH_NOT_FOUND'; error.status = 404; throw error; }
  return database.transaction(() => {
    const rows = database.prepare(`SELECT o.merchant_order_id,o.order_receipt,o.gross_amount_paise,o.refund_amount_paise,o.expected_fee_paise,o.expected_tax_paise,o.expected_net_paise,
      s.entity_id,s.settlement_id,s.settlement_utr,m.actual_net_paise,m.variance_paise,m.confidence_score,m.status,m.matched_by,m.reason_codes_json
      FROM orders o JOIN matches m ON m.order_id=o.id LEFT JOIN settlement_records s ON s.id=m.settlement_record_id
      WHERE o.batch_id=? ORDER BY o.merchant_order_id`).all(batchId);
    const lines = [headers.join(',')];
    for (const row of rows) lines.push([
      row.merchant_order_id, row.order_receipt, row.gross_amount_paise, row.refund_amount_paise,
      row.expected_fee_paise, row.expected_tax_paise, row.expected_net_paise, row.entity_id,
      row.settlement_id, row.settlement_utr, row.actual_net_paise, row.variance_paise,
      row.confidence_score, row.status, row.matched_by, JSON.parse(row.reason_codes_json).join('|')
    ].map(csvCell).join(','));
    appendAuditEvent(database, { batchId, userId, eventType: 'EXPORT', entityType: 'batch', entityId: batchId, requestId, payload: { recordCount: rows.length, format: 'csv' } });
    return { fileName: `settlewise-${batchId}.csv`, content: `${lines.join('\r\n')}\r\n`, recordCount: rows.length };
  })();
}

