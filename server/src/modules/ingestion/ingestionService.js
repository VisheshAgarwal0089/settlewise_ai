import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { parse } from 'csv-parse/sync';
import { CSV_HEADERS } from '../../config/constants.js';
import { normalizeSourceRecords, SourceValidationError } from '../reconciliation/normalize.js';
import { appendAuditEvent } from '../audit/auditService.js';

export class IngestionError extends Error {
  constructor(code, message, details = {}) { super(message); this.code = code; this.status = 400; Object.assign(this, details); }
}

function requireBatch(database, batchId) {
  const batch = database.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) throw new IngestionError('BATCH_NOT_FOUND', 'Batch not found', { status: 404 });
  return batch;
}

function recordFailedImport(database, values) {
  requireBatch(database, values.batchId);
  const now = new Date().toISOString();
  database.prepare(`INSERT INTO data_imports
    (id,batch_id,source,status,record_count,file_name,file_sha256,provider_http_status,error_code,created_at,completed_at)
    VALUES (?,?,?,?,0,?,?,?,?,?,?)`).run(randomUUID(), values.batchId, values.source, 'failed', values.fileName ?? null, values.fileSha256 ?? null, values.providerHttpStatus ?? null, values.errorCode, now, now);
}

function persistImport(database, values) {
  requireBatch(database, values.batchId);
  const transaction = database.transaction(() => {
    const importId = randomUUID(); const now = new Date().toISOString();
    database.prepare(`INSERT INTO data_imports
      (id,batch_id,source,status,record_count,file_name,file_sha256,created_at,completed_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(importId, values.batchId, values.source, 'succeeded', values.records.length, values.fileName ?? null, values.fileSha256 ?? null, now, now);
    const insert = database.prepare(`INSERT INTO settlement_records
      (id,batch_id,import_id,entity_id,type,order_id,order_receipt,payment_id,settlement_id,settlement_utr,amount_paise,fee_paise,tax_paise,credit_paise,debit_paise,currency,settled,created_at_utc,settled_at_utc,raw_payload_json,created_at)
      VALUES (@id,@batchId,@importId,@entityId,@type,@orderId,@orderReceipt,@paymentId,@settlementId,@settlementUtr,@amountPaise,@feePaise,@taxPaise,@creditPaise,@debitPaise,@currency,@settled,@createdAtUtc,@settledAtUtc,@rawPayloadJson,@createdAt)`);
    for (const record of values.records) insert.run({ id: randomUUID(), batchId: values.batchId, importId, ...record, createdAt: now });
    database.prepare('UPDATE batches SET settlement_record_count = (SELECT count(*) FROM settlement_records WHERE batch_id = ?), updated_at = ? WHERE id = ?').run(values.batchId, now, values.batchId);
    appendAuditEvent(database, { batchId: values.batchId, userId: values.userId, eventType: values.source === 'razorpay_api' ? 'API_FETCH' : 'CSV_UPLOAD', entityType: 'batch', entityId: values.batchId, requestId: values.requestId, payload: { recordCount: values.records.length, source: values.source } });
    return { importId, batchId: values.batchId, source: values.source, recordCount: values.records.length };
  });
  try { return transaction(); }
  catch (error) {
    if (String(error.code).startsWith('SQLITE_CONSTRAINT')) throw new IngestionError('DUPLICATE_ENTITY_ID', 'A provider entity ID already exists in this batch');
    throw error;
  }
}

export function parseCsvBuffer(buffer) {
  let rows;
  try { rows = parse(buffer, { bom: true, relax_column_count: false, skip_empty_lines: true }); }
  catch { throw new IngestionError('CSV_INVALID', 'CSV could not be parsed'); }
  if (rows.length === 0 || rows[0].join(',') !== CSV_HEADERS.join(',')) throw new IngestionError('CSV_INVALID_HEADERS', 'CSV headers do not match the required schema');
  if (rows.length - 1 > 1500) throw new IngestionError('CSV_TOO_MANY_ROWS', 'CSV exceeds 1,500 records');
  const objects = rows.slice(1).map((values) => Object.fromEntries(CSV_HEADERS.map((header, index) => [header, values[index]])));
  try { return normalizeSourceRecords(objects); }
  catch (error) {
    if (error instanceof SourceValidationError) throw new IngestionError(error.issues?.[0]?.message === 'Duplicate entity_id' ? 'DUPLICATE_ENTITY_ID' : 'CSV_ROW_INVALID', 'CSV validation failed', { rowErrors: [{ line: error.rowIndex + 2, issues: error.issues }] });
    throw error;
  }
}

export function importCsv(database, values) {
  const fileName = basename(values.originalName || 'upload.csv');
  const fileSha256 = createHash('sha256').update(values.buffer).digest('hex');
  let records;
  try { records = parseCsvBuffer(values.buffer); }
  catch (error) { recordFailedImport(database, { batchId: values.batchId, source: 'csv_fallback', fileName, fileSha256, errorCode: error.code }); throw error; }
  return persistImport(database, { ...values, source: 'csv_fallback', fileName, fileSha256, records });
}

export async function importRazorpay(database, values) {
  let records;
  try { records = normalizeSourceRecords(await values.client.fetchSettlementRecon(values.query)); }
  catch (error) {
    recordFailedImport(database, { batchId: values.batchId, source: 'razorpay_api', providerHttpStatus: error.providerHttpStatus, errorCode: 'RAZORPAY_UNAVAILABLE' });
    error.code = 'RAZORPAY_UNAVAILABLE'; error.status = 503; error.message = 'Razorpay Settlement Recon is unavailable'; throw error;
  }
  return persistImport(database, { ...values, source: 'razorpay_api', records });
}
