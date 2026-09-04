import { afterEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { openDatabase } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { createBatch } from '../../src/modules/batches/batchService.js';
import { reconcileBatch } from '../../src/modules/reconciliation/reconcileBatch.js';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { SESSION_COOKIE } from '../../src/config/constants.js';

const databases = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });
function databaseFixture() { const database = openDatabase(':memory:'); migrate(database); databases.push(database); return database; }

function reconciliationFixture(database) {
  const batch = createBatch(database, { name: 'Phase 3 fixture', sourceMode: 'csv', requestedCount: 5 });
  const now = new Date().toISOString(); const importId = 'import-1';
  database.prepare(`INSERT INTO data_imports (id,batch_id,source,status,record_count,created_at,completed_at) VALUES (?,?,?,'succeeded',6,?,?)`).run(importId, batch.id, 'csv_fallback', now, now);
  const insertSettlement = database.prepare(`INSERT INTO settlement_records
    (id,batch_id,import_id,entity_id,type,order_id,order_receipt,payment_id,amount_paise,fee_paise,tax_paise,credit_paise,debit_paise,currency,settled,created_at_utc,settled_at_utc,raw_payload_json,created_at)
    VALUES (@id,@batchId,@importId,@entityId,@type,@orderId,@receipt,@paymentId,@amount,@fee,@tax,@credit,@debit,'INR',1,@created,@settled,'{}',@now)`);
  const base = { batchId: batch.id, importId, type: 'payment', receipt: null, amount: 100000, fee: 2000, tax: 360, credit: 97640, debit: 0, created: '2026-09-01T00:00:00.000Z', settled: '2026-09-02T00:00:00.000Z', now };
  const settlements = [
    { ...base, id: 'pay-normal', entityId: 'pay-normal', orderId: 'order-normal', paymentId: 'pay-normal' },
    { ...base, id: 'pay-amount', entityId: 'pay-amount', orderId: 'order-amount', paymentId: 'pay-amount', amount: 102500, fee: 2050, tax: 369, credit: 100081 },
    { ...base, id: 'pay-tie-a', entityId: 'pay-tie-a', orderId: 'provider-a', paymentId: 'pay-tie-a' },
    { ...base, id: 'pay-tie-b', entityId: 'pay-tie-b', orderId: 'provider-b', paymentId: 'pay-tie-b' },
    { ...base, id: 'pay-refund', entityId: 'pay-refund', orderId: 'order-refund', paymentId: 'pay-refund' },
    { ...base, id: 'refund-1', entityId: 'refund-1', type: 'refund', orderId: 'order-refund', paymentId: 'pay-refund', amount: 10000, fee: 0, tax: 0, credit: 0, debit: 10000 }
  ];
  for (const settlement of settlements) insertSettlement.run(settlement);
  const insertOrder = database.prepare(`INSERT INTO orders
    (id,batch_id,merchant_order_id,order_receipt,gross_amount_paise,refund_amount_paise,expected_fee_paise,expected_tax_paise,expected_net_paise,order_date_utc,currency,generation_case,created_at)
    VALUES (@id,@batchId,@merchantOrderId,NULL,@gross,@refund,@expectedFee,@expectedTax,@net,'2026-09-01T00:00:00.000Z','INR',@generationCase,@now)`);
  const orders = [
    { id: 'order-row-normal', batchId: batch.id, merchantOrderId: 'order-normal', gross: 100000, refund: 0, expectedFee: 2000, expectedTax: 360, net: 97640, generationCase: 'normal', now, truth: 'pay-normal', matchable: 1, anomaly: 0 },
    { id: 'order-row-amount', batchId: batch.id, merchantOrderId: 'order-amount', gross: 100000, refund: 0, expectedFee: 2000, expectedTax: 360, net: 97640, generationCase: 'amount_mismatch', now, truth: 'pay-amount', matchable: 1, anomaly: 1 },
    { id: 'order-row-missing', batchId: batch.id, merchantOrderId: 'order-missing', gross: 200000, refund: 0, expectedFee: 4000, expectedTax: 720, net: 195280, generationCase: 'missing_settlement', now, truth: null, matchable: 0, anomaly: 1 },
    { id: 'order-row-tie', batchId: batch.id, merchantOrderId: 'order-tie', gross: 100000, refund: 0, expectedFee: 2000, expectedTax: 360, net: 97640, generationCase: 'duplicate_candidate', now, truth: 'pay-tie-a', matchable: 1, anomaly: 1 },
    { id: 'order-row-refund', batchId: batch.id, merchantOrderId: 'order-refund', gross: 100000, refund: 10000, expectedFee: 2000, expectedTax: 360, net: 87640, generationCase: 'normal', now, truth: 'pay-refund', matchable: 1, anomaly: 0 }
  ];
  const insertTruth = database.prepare('INSERT INTO evaluation_truth (order_id,expected_settlement_record_id,is_matchable,is_anomaly,expected_case,created_at) VALUES (?,?,?,?,?,?)');
  for (const order of orders) { insertOrder.run(order); insertTruth.run(order.id, order.truth, order.matchable, order.anomaly, order.generationCase, now); }
  database.prepare('UPDATE batches SET order_count = 5, settlement_record_count = 6 WHERE id = ?').run(batch.id);
  return batch;
}

describe('atomic reconciliation', () => {
  it('classifies matches, ties and missing settlements and calculates ground-truth metrics', () => {
    const database = databaseFixture(); const batch = reconciliationFixture(database);
    const result = reconcileBatch(database, { batchId: batch.id, requestId: 'reconcile-1' });
    expect(result.counts).toEqual({ total: 5, matched: 2, pendingReview: 2, unresolved: 1 });
    expect(result.metrics).toMatchObject({ autoMatchRate: 0.5, precision: 1, recall: 0.5, exceptionRecall: 1, falseMatchRate: 0, manualReviewRate: 0.4 });
    expect(result.metrics.denominators).toEqual({ totalOrders: 5, eligibleOrders: 4, engineMatches: 2, groundTruthMatchableOrders: 4, groundTruthAnomalies: 3 });
    const rows = Object.fromEntries(database.prepare('SELECT order_id,status,confidence_score,reason_codes_json,evidence_json FROM matches').all().map((row) => [row.order_id, row]));
    expect(rows['order-row-normal']).toMatchObject({ status: 'matched', confidence_score: 100 });
    expect(rows['order-row-amount']).toMatchObject({ status: 'pending_review', confidence_score: 65 });
    expect(rows['order-row-missing']).toMatchObject({ status: 'unresolved', confidence_score: 0 });
    expect(rows['order-row-tie'].status).toBe('pending_review'); expect(JSON.parse(rows['order-row-tie'].reason_codes_json)).toContain('AMBIGUOUS_CANDIDATES');
    expect(JSON.parse(rows['order-row-refund'].evidence_json).rankedCandidates[0].refundRecordIds).toEqual(['refund-1']);
    expect(database.prepare('SELECT count(*) count FROM audit_logs WHERE event_type = ?').get('MATCH_RESULT').count).toBe(5);
    expect(database.prepare('SELECT status FROM batches WHERE id = ?').get(batch.id).status).toBe('completed');
  });
  it('rolls back every match and batch state when an atomic write fails', () => {
    const database = databaseFixture(); const batch = reconciliationFixture(database);
    expect(() => reconcileBatch(database, { batchId: batch.id, userId: 'missing-user', requestId: 'rollback' })).toThrow();
    expect(database.prepare('SELECT count(*) count FROM matches').get().count).toBe(0);
    expect(database.prepare('SELECT status,matching_started_at FROM batches WHERE id = ?').get(batch.id)).toEqual({ status: 'uploaded', matching_started_at: null });
  });
  it('serves the reconciliation endpoint without exposing truth fields', async () => {
    const database = databaseFixture(); database.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run('user-1', 'admin@settlewise.local', 'unused', new Date().toISOString());
    const batch = reconciliationFixture(database); const app = createApp(database);
    const token = jwt.sign({ id: 'user-1', email: 'admin@settlewise.local' }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const response = await request(app).post(`/api/v1/batches/${batch.id}/reconcile`).set('Origin', env.CLIENT_ORIGIN).set('Cookie', `${SESSION_COOKIE}=${token}`).send({});
    expect(response.status).toBe(200); expect(response.body.data.counts.total).toBe(5);
    expect(JSON.stringify(response.body)).not.toMatch(/evaluation_truth|expected_settlement_record_id|is_matchable/);
  });
});
