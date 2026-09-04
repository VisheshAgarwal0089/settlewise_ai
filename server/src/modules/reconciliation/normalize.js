import { sourceRecordSchema } from '../ingestion/schemas.js';

export class SourceValidationError extends Error {
  constructor(issues) {
    super('Source record validation failed');
    this.code = 'SOURCE_VALIDATION_ERROR';
    this.status = 400;
    this.issues = issues;
  }
}

export function normalizeSourceRecord(input) {
  const result = sourceRecordSchema.safeParse(input);
  if (!result.success) throw new SourceValidationError(result.error.issues);
  const row = result.data;
  return Object.freeze({
    entityId: row.entity_id,
    type: row.type,
    orderId: row.order_id,
    orderReceipt: row.order_receipt,
    paymentId: row.payment_id,
    settlementId: row.settlement_id,
    settlementUtr: row.settlement_utr,
    amountPaise: row.amount,
    feePaise: row.fee,
    taxPaise: row.tax,
    creditPaise: row.credit,
    debitPaise: row.debit,
    currency: row.currency,
    settled: row.settled ? 1 : 0,
    createdAtUtc: new Date(row.created_at * 1000).toISOString(),
    settledAtUtc: row.settled_at == null ? null : new Date(row.settled_at * 1000).toISOString(),
    rawPayloadJson: JSON.stringify(row)
  });
}

export function normalizeSourceRecords(rows) {
  const seen = new Set();
  return rows.map((row, index) => {
    try {
      const normalized = normalizeSourceRecord(row);
      if (seen.has(normalized.entityId)) {
        const error = new SourceValidationError([{ path: ['entity_id'], message: 'Duplicate entity_id' }]);
        error.rowIndex = index;
        throw error;
      }
      seen.add(normalized.entityId);
      return normalized;
    } catch (error) {
      if (error.rowIndex == null) error.rowIndex = index;
      throw error;
    }
  });
}
