export const APP_VERSION = '0.1.0';
export const SESSION_COOKIE = 'settlewise_session';
export const BATCH_STATUSES = Object.freeze(['uploaded', 'processing', 'completed', 'failed']);
export const SOURCE_MODES = Object.freeze(['api', 'csv']);
export const MATCH_STATUSES = Object.freeze(['matched', 'pending_review', 'unresolved']);
export const MATCHED_BY = Object.freeze(['engine', 'reviewer', 'none']);
export const REVIEW_ACTIONS = Object.freeze(['approve', 'reject', 'manual_link']);
export const AUDIT_EVENT_TYPES = Object.freeze([
  'API_FETCH', 'CSV_UPLOAD', 'SEED_GENERATED', 'MATCH_RESULT',
  'APPROVE', 'REJECT', 'MANUAL_LINK', 'EXPORT', 'RESET'
]);
export const CSV_HEADERS = Object.freeze([
  'entity_id', 'type', 'amount', 'currency', 'fee', 'tax', 'credit', 'debit',
  'settled', 'created_at', 'settled_at', 'settlement_id', 'settlement_utr',
  'order_id', 'order_receipt', 'payment_id'
]);

