import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { approveMatch, manualLinkMatch, rejectMatch } from '../../src/modules/reviews/reviewService.js';
import { explainMatch } from '../../src/modules/explanations/explanationService.js';
import { exportBatchCsv } from '../../src/modules/exports/exportService.js';
import { resetAllData } from '../../src/modules/exports/resetService.js';
import { verifyAuditChain } from '../../src/modules/audit/auditService.js';
import { env } from '../../src/config/env.js';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { SESSION_COOKIE } from '../../src/config/constants.js';

const databases = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
function databaseFixture() { const database = openDatabase(':memory:'); migrate(database); databases.push(database); return database; }

function phase4Fixture(database) {
  const now = new Date().toISOString();
  database.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run('user-1', 'admin@settlewise.local', 'hash', now);
  database.prepare(`INSERT INTO batches (id,name,source_mode,status,requested_count,order_count,settlement_record_count,created_at,updated_at) VALUES ('batch-1','Phase 4','csv','completed',3,3,2,?,?)`).run(now, now);
  database.prepare(`INSERT INTO data_imports (id,batch_id,source,status,record_count,created_at,completed_at) VALUES ('import-1','batch-1','csv_fallback','succeeded',2,?,?)`).run(now, now);
  const insertPayment = database.prepare(`INSERT INTO settlement_records
    (id,batch_id,import_id,entity_id,type,order_id,payment_id,amount_paise,fee_paise,tax_paise,credit_paise,debit_paise,currency,settled,created_at_utc,settled_at_utc,raw_payload_json,created_at)
    VALUES (?, 'batch-1','import-1',?,'payment',?,?,100000,2000,360,97640,0,'INR',1,'2026-09-01T00:00:00.000Z','2026-09-02T00:00:00.000Z','{}',?)`);
  insertPayment.run('pay-1', '=provider-formula', 'order-approve', 'pay-1', now);
  insertPayment.run('pay-2', 'pay-2', 'provider-manual', 'pay-2', now);
  const insertOrder = database.prepare(`INSERT INTO orders
    (id,batch_id,merchant_order_id,gross_amount_paise,refund_amount_paise,expected_fee_paise,expected_tax_paise,expected_net_paise,order_date_utc,currency,generation_case,created_at)
    VALUES (?,'batch-1',?,100000,0,2000,360,97640,'2026-09-01T00:00:00.000Z','INR',?,?)`);
  insertOrder.run('order-1', '=cmd-order', 'amount_mismatch', now);
  insertOrder.run('order-2', 'order-reject', 'date_mismatch', now);
  insertOrder.run('order-3', 'order-manual', 'missing_settlement', now);
  const candidate = (id, entityId) => ({ settlementRecordId: id, entityId, score: 65, components: { identifier: 50, amount: 0, date: 15, formula: 0 }, actualNetPaise: 97640, variancePaise: 0, refundRecordIds: [], checks: { amountMatch: false, dateWithinTolerance: true }, reasonCodes: ['EXACT_ORDER_ID', 'AMOUNT_MISMATCH'], hardGatesPass: false });
  const insertMatch = database.prepare(`INSERT INTO matches
    (id,batch_id,order_id,status,confidence_score,matched_by,expected_net_paise,actual_net_paise,variance_paise,reason_codes_json,evidence_json,algorithm_version,created_at,updated_at)
    VALUES (?,'batch-1',?,?,?,'none',97640,97640,0,?,?,'1.0.0',?,?)`);
  insertMatch.run('match-approve', 'order-1', 'pending_review', 65, '["AMOUNT_MISMATCH"]', JSON.stringify({ ambiguous: false, candidateCount: 1, rankedCandidates: [candidate('pay-1', '=provider-formula')] }), now, now);
  insertMatch.run('match-reject', 'order-2', 'pending_review', 60, '["DATE_OUTSIDE_TOLERANCE"]', JSON.stringify({ ambiguous: false, candidateCount: 1, rankedCandidates: [candidate('pay-1', '=provider-formula')] }), now, now);
  insertMatch.run('match-manual', 'order-3', 'unresolved', 0, '["NO_CANDIDATE"]', JSON.stringify({ ambiguous: false, candidateCount: 0, rankedCandidates: [] }), now, now);
  const insertTruth = database.prepare('INSERT INTO evaluation_truth (order_id,expected_settlement_record_id,is_matchable,is_anomaly,expected_case,created_at) VALUES (?,?,?,?,?,?)');
  insertTruth.run('order-1', 'pay-1', 1, 1, 'amount_mismatch', now); insertTruth.run('order-2', 'pay-1', 1, 1, 'date_mismatch', now); insertTruth.run('order-3', null, 0, 1, 'missing_settlement', now);
}

describe('transactional reviews and immutable audits', () => {
  it('approves, rejects and manually links with append-only history and audit events', () => {
    const database = databaseFixture(); phase4Fixture(database);
    const approved = approveMatch(database, { matchId: 'match-approve', userId: 'user-1', note: 'approved', requestId: 'req-a' });
    const rejected = rejectMatch(database, { matchId: 'match-reject', userId: 'user-1', note: 'rejected', requestId: 'req-r' });
    const linked = manualLinkMatch(database, { matchId: 'match-manual', settlementRecordId: 'pay-2', userId: 'user-1', note: 'linked', requestId: 'req-m' });
    expect(approved).toMatchObject({ status: 'matched', matchedBy: 'reviewer', confidenceScore: 65, settlementRecordId: 'pay-1' });
    expect(rejected).toMatchObject({ status: 'unresolved', matchedBy: 'none', confidenceScore: 60, settlementRecordId: null });
    expect(linked).toMatchObject({ status: 'matched', matchedBy: 'reviewer', settlementRecordId: 'pay-2' });
    expect(database.prepare('SELECT action FROM review_actions ORDER BY rowid').all().map((row) => row.action)).toEqual(['approve', 'reject', 'manual_link']);
    expect(database.prepare("SELECT event_type FROM audit_logs ORDER BY rowid").all().map((row) => row.event_type)).toEqual(['APPROVE', 'REJECT', 'MANUAL_LINK']);
    expect(verifyAuditChain(database)).toEqual({ valid: true, checkedEvents: 3 });
    expect(() => approveMatch(database, { matchId: 'match-approve', userId: 'user-1', requestId: 'stale' })).toThrow('Only pending-review');
    expect(database.prepare('SELECT count(*) count FROM review_actions').get().count).toBe(3);
  });
  it('rolls back the match update if review history cannot be appended', () => {
    const database = databaseFixture(); phase4Fixture(database);
    expect(() => approveMatch(database, { matchId: 'match-approve', userId: 'missing-user', requestId: 'rollback' })).toThrow();
    expect(database.prepare("SELECT status,settlement_record_id FROM matches WHERE id='match-approve'").get()).toEqual({ status: 'pending_review', settlement_record_id: null });
    expect(database.prepare('SELECT count(*) count FROM review_actions').get().count).toBe(0);
  });
});

describe('advisory explanations', () => {
  it('stores valid structured Groq output without changing any financial match field', async () => {
    const database = databaseFixture(); phase4Fixture(database);
    const before = database.prepare("SELECT * FROM matches WHERE id='match-approve'").get();
    const client = { explain: async (input) => { expect(JSON.stringify(input)).not.toMatch(/evaluation_truth|raw_payload|password/i); return { model: env.GROQ_MODEL, content: '{"category":"amount_mismatch","summary":"Amounts differ.","recommendedAction":"Review the order amount."}' }; } };
    const result = await explainMatch(database, { matchId: 'match-approve', client });
    expect(result).toMatchObject({ status: 'succeeded', model: 'openai/gpt-oss-20b', category: 'amount_mismatch' });
    expect(database.prepare("SELECT * FROM matches WHERE id='match-approve'").get()).toEqual(before);
  });
  it('discards invalid or failed AI output and stores deterministic fallback', async () => {
    const database = databaseFixture(); phase4Fixture(database);
    const invalid = await explainMatch(database, { matchId: 'match-approve', client: { explain: async () => ({ model: env.GROQ_MODEL, content: '{"summary":"missing fields"}' }) } });
    expect(invalid).toMatchObject({ status: 'failed', category: 'amount_mismatch', errorCode: 'AI_EXPLANATION_FAILED' });
    expect(invalid.summary).toBe('The order and proposed settlement gross amounts differ.');
  });
});

describe('export and reset', () => {
  it('exports database values and neutralizes spreadsheet formulas', () => {
    const database = databaseFixture(); phase4Fixture(database);
    approveMatch(database, { matchId: 'match-approve', userId: 'user-1', requestId: 'approve-export' });
    const exported = exportBatchCsv(database, { batchId: 'batch-1', userId: 'user-1', requestId: 'export' });
    expect(exported.content).toContain("'=cmd-order"); expect(exported.content).toContain("'=provider-formula");
    expect(exported.content).toContain('100000,0,2000,360,97640');
    expect(database.prepare("SELECT count(*) count FROM audit_logs WHERE event_type='EXPORT'").get().count).toBe(1);
  });
  it('requires exact confirmation, clears scoped data and preserves the login', () => {
    const database = databaseFixture(); phase4Fixture(database);
    expect(() => resetAllData(database, { confirmation: 'reset all data', userId: 'user-1', requestId: 'bad' })).toThrow('exactly match');
    expect(database.prepare('SELECT count(*) count FROM batches').get().count).toBe(1);
    const result = resetAllData(database, { confirmation: 'RESET ALL DATA', userId: 'user-1', requestId: 'reset' });
    expect(result.sessionPreserved).toBe(true); expect(result.deleted.matches).toBe(3);
    expect(database.prepare('SELECT count(*) count FROM batches').get().count).toBe(0);
    expect(database.prepare('SELECT count(*) count FROM audit_logs').get().count).toBe(0);
    expect(database.prepare('SELECT email FROM users').get().email).toBe('admin@settlewise.local');
  });
});

describe('Phase 4 API routes', () => {
  it('exposes review, explanation, export and exact reset through authenticated routes', async () => {
    const database = databaseFixture(); phase4Fixture(database);
    const groqClient = { explain: async () => ({ model: env.GROQ_MODEL, content: '{"category":"amount_mismatch","summary":"Amounts differ.","recommendedAction":"Review evidence."}' }) };
    const app = createApp(database, { groqClient });
    const token = jwt.sign({ id: 'user-1', email: 'admin@settlewise.local' }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const authentication = (call) => call.set('Origin', env.CLIENT_ORIGIN).set('Cookie', `${SESSION_COOKIE}=${token}`);
    const explanation = await authentication(request(app).post('/api/v1/matches/match-approve/explanation/retry')).send({});
    expect(explanation.status).toBe(200); expect(explanation.body.data.status).toBe('succeeded');
    const approval = await authentication(request(app).post('/api/v1/matches/match-approve/approve')).send({ note: 'approved through API' });
    expect(approval.status).toBe(200); expect(approval.body.data.status).toBe('matched');
    const exported = await request(app).get('/api/v1/batches/batch-1/export.csv').set('Cookie', `${SESSION_COOKIE}=${token}`);
    expect(exported.status).toBe(200); expect(exported.headers['content-type']).toContain('text/csv');
    const invalidReset = await authentication(request(app).delete('/api/v1/data')).send({ confirmation: 'reset all data' });
    expect(invalidReset.status).toBe(400); expect(database.prepare('SELECT count(*) count FROM batches').get().count).toBe(1);
    const reset = await authentication(request(app).delete('/api/v1/data')).send({ confirmation: 'RESET ALL DATA' });
    expect(reset.status).toBe(200); expect(reset.body.data.sessionPreserved).toBe(true);
    expect(database.prepare('SELECT count(*) count FROM users').get().count).toBe(1);
  });
});
