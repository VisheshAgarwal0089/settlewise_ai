CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL, last_login_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS batches (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 80),
 source_mode TEXT NOT NULL CHECK(source_mode IN ('api','csv')),
 status TEXT NOT NULL CHECK(status IN ('uploaded','processing','completed','failed')),
 requested_count INTEGER NOT NULL CHECK(requested_count BETWEEN 1 AND 500),
 order_count INTEGER NOT NULL DEFAULT 0, settlement_record_count INTEGER NOT NULL DEFAULT 0,
 matching_started_at TEXT, matching_completed_at TEXT,
 matching_duration_ms INTEGER CHECK(matching_duration_ms IS NULL OR matching_duration_ms >= 0),
 explanation_duration_ms INTEGER CHECK(explanation_duration_ms IS NULL OR explanation_duration_ms >= 0),
 auto_match_rate REAL CHECK(auto_match_rate IS NULL OR auto_match_rate BETWEEN 0 AND 1),
 precision REAL CHECK(precision IS NULL OR precision BETWEEN 0 AND 1),
 recall REAL CHECK(recall IS NULL OR recall BETWEEN 0 AND 1),
 exception_recall REAL CHECK(exception_recall IS NULL OR exception_recall BETWEEN 0 AND 1),
 false_match_rate REAL CHECK(false_match_rate IS NULL OR false_match_rate BETWEEN 0 AND 1),
 manual_review_rate REAL CHECK(manual_review_rate IS NULL OR manual_review_rate BETWEEN 0 AND 1),
 unexplained_variance_paise INTEGER, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);

CREATE TABLE IF NOT EXISTS data_imports (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 source TEXT NOT NULL CHECK(source IN ('razorpay_api','csv_fallback')),
 status TEXT NOT NULL CHECK(status IN ('started','succeeded','failed')),
 record_count INTEGER NOT NULL DEFAULT 0, file_name TEXT, file_sha256 TEXT,
 provider_http_status INTEGER, error_code TEXT, created_at TEXT NOT NULL, completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_data_imports_batch ON data_imports(batch_id);
CREATE INDEX IF NOT EXISTS idx_data_imports_batch_created ON data_imports(batch_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 merchant_order_id TEXT NOT NULL, order_receipt TEXT,
 gross_amount_paise INTEGER NOT NULL CHECK(gross_amount_paise > 0),
 refund_amount_paise INTEGER NOT NULL DEFAULT 0 CHECK(refund_amount_paise >= 0 AND refund_amount_paise <= gross_amount_paise),
 expected_fee_paise INTEGER NOT NULL CHECK(expected_fee_paise >= 0),
 expected_tax_paise INTEGER NOT NULL CHECK(expected_tax_paise >= 0), expected_net_paise INTEGER NOT NULL,
 order_date_utc TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency = 'INR'),
 generation_case TEXT NOT NULL CHECK(generation_case IN ('normal','amount_mismatch','date_mismatch','missing_reference','duplicate_candidate','fee_mismatch','tax_mismatch','refund_mismatch','missing_settlement')),
 created_at TEXT NOT NULL, UNIQUE(batch_id, merchant_order_id)
);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch_merchant ON orders(batch_id, merchant_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch_amount ON orders(batch_id, gross_amount_paise);
CREATE INDEX IF NOT EXISTS idx_orders_batch_date ON orders(batch_id, order_date_utc);

CREATE TABLE IF NOT EXISTS settlement_records (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 import_id TEXT NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE, entity_id TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('payment','refund','transfer','adjustment')),
 order_id TEXT, order_receipt TEXT, payment_id TEXT, settlement_id TEXT, settlement_utr TEXT,
 amount_paise INTEGER NOT NULL CHECK(amount_paise >= 0), fee_paise INTEGER NOT NULL DEFAULT 0 CHECK(fee_paise >= 0),
 tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0), credit_paise INTEGER NOT NULL DEFAULT 0 CHECK(credit_paise >= 0),
 debit_paise INTEGER NOT NULL DEFAULT 0 CHECK(debit_paise >= 0), currency TEXT NOT NULL CHECK(currency = 'INR'),
 settled INTEGER NOT NULL CHECK(settled IN (0,1)), created_at_utc TEXT NOT NULL, settled_at_utc TEXT,
 raw_payload_json TEXT NOT NULL CHECK(json_valid(raw_payload_json)), created_at TEXT NOT NULL,
 UNIQUE(batch_id, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_settlements_batch ON settlement_records(batch_id);
CREATE INDEX IF NOT EXISTS idx_settlements_batch_order ON settlement_records(batch_id, order_id);
CREATE INDEX IF NOT EXISTS idx_settlements_batch_receipt ON settlement_records(batch_id, order_receipt);
CREATE INDEX IF NOT EXISTS idx_settlements_batch_amount ON settlement_records(batch_id, amount_paise);
CREATE INDEX IF NOT EXISTS idx_settlements_batch_settled_at ON settlement_records(batch_id, settled_at_utc);
CREATE INDEX IF NOT EXISTS idx_settlements_batch_settlement ON settlement_records(batch_id, settlement_id);

CREATE TABLE IF NOT EXISTS matches (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
 order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
 settlement_record_id TEXT REFERENCES settlement_records(id),
 status TEXT NOT NULL CHECK(status IN ('matched','pending_review','unresolved')),
 confidence_score INTEGER NOT NULL CHECK(confidence_score BETWEEN 0 AND 100),
 matched_by TEXT NOT NULL CHECK(matched_by IN ('engine','reviewer','none')),
 expected_net_paise INTEGER NOT NULL, actual_net_paise INTEGER, variance_paise INTEGER,
 reason_codes_json TEXT NOT NULL CHECK(json_valid(reason_codes_json) AND json_type(reason_codes_json) = 'array'),
 evidence_json TEXT NOT NULL CHECK(json_valid(evidence_json) AND json_type(evidence_json) = 'object'),
 algorithm_version TEXT NOT NULL DEFAULT '1.0.0', review_note TEXT CHECK(review_note IS NULL OR length(review_note) <= 500),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_matches_batch_status ON matches(batch_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_batch_confidence ON matches(batch_id, confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_settlement ON matches(settlement_record_id);

CREATE TABLE IF NOT EXISTS review_actions (
 id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL CHECK(action IN ('approve','reject','manual_link')),
 previous_status TEXT NOT NULL, resulting_status TEXT NOT NULL, previous_settlement_record_id TEXT,
 selected_settlement_record_id TEXT, note TEXT CHECK(note IS NULL OR length(note) <= 500), created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_actions_match ON review_actions(match_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_user_created ON review_actions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_explanations (
 id TEXT PRIMARY KEY, match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
 provider TEXT NOT NULL DEFAULT 'groq', model TEXT NOT NULL, prompt_version TEXT NOT NULL DEFAULT '1.0.0',
 input_sha256 TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','succeeded','failed','skipped')),
 category TEXT, summary TEXT CHECK(summary IS NULL OR length(summary) <= 600),
 recommended_action TEXT CHECK(recommended_action IS NULL OR length(recommended_action) <= 300),
 error_code TEXT, created_at TEXT NOT NULL, completed_at TEXT, UNIQUE(match_id, input_sha256)
);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_match ON ai_explanations(match_id);
CREATE INDEX IF NOT EXISTS idx_ai_explanations_status ON ai_explanations(status);

CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, batch_id TEXT REFERENCES batches(id), user_id TEXT REFERENCES users(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('API_FETCH','CSV_UPLOAD','SEED_GENERATED','MATCH_RESULT','APPROVE','REJECT','MANUAL_LINK','EXPORT','RESET')),
 entity_type TEXT NOT NULL, entity_id TEXT, request_id TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)), previous_hash TEXT, event_hash TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_batch_created ON audit_logs(batch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS evaluation_truth (
 order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
 expected_settlement_record_id TEXT REFERENCES settlement_records(id),
 is_matchable INTEGER NOT NULL CHECK(is_matchable IN (0,1)), is_anomaly INTEGER NOT NULL CHECK(is_anomaly IN (0,1)),
 expected_case TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_truth_matchable ON evaluation_truth(is_matchable);
CREATE INDEX IF NOT EXISTS idx_truth_anomaly ON evaluation_truth(is_anomaly);

