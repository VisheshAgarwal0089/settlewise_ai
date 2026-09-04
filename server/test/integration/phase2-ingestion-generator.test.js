import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { openDatabase } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { createBatch } from '../../src/modules/batches/batchService.js';
import { importCsv, importRazorpay } from '../../src/modules/ingestion/ingestionService.js';
import { generateOrders } from '../../src/modules/generator/generatorService.js';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { SESSION_COOKIE } from '../../src/config/constants.js';

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
const databases = [];
afterEach(() => { for (const database of databases.splice(0)) database.close(); });

function databaseFixture() { const database = openDatabase(':memory:'); migrate(database); databases.push(database); return database; }
function sourceRows(count = 150) {
  return Array.from({ length: count }, (_, index) => {
    const amount = 100000 + (index % 75) * 2500; const fee = amount / 50; const tax = fee * 18 / 100;
    return { entity_id: `pay_${String(index).padStart(3, '0')}`, type: 'payment', amount, currency: 'INR', fee, tax, credit: amount - fee - tax, debit: 0, settled: 1, created_at: 1788451200 + index * 60, settled_at: 1788537600 + index * 60, settlement_id: `setl_${index}`, settlement_utr: `UTR${index}`, order_id: `order_${index}`, order_receipt: `receipt_${index}`, payment_id: `pay_${index}` };
  });
}
async function loadedBatch(database, name = 'Phase 2') {
  const batch = createBatch(database, { name, sourceMode: 'api', requestedCount: 150 });
  await importRazorpay(database, { batchId: batch.id, query: {}, client: { fetchSettlementRecon: async () => sourceRows() }, requestId: 'request-import' });
  return batch;
}

describe('atomic ingestion', () => {
  it('imports a valid CSV and records no file bytes', () => {
    const database = databaseFixture(); const batch = createBatch(database, { name: 'CSV', sourceMode: 'csv', requestedCount: 150 });
    const result = importCsv(database, { batchId: batch.id, buffer: readFileSync(join(fixtureDirectory, 'valid-settlements.csv')), originalName: '../unsafe/valid-settlements.csv', requestId: 'csv-ok' });
    expect(result.recordCount).toBe(1);
    expect(database.prepare('SELECT count(*) count FROM settlement_records').get().count).toBe(1);
    const imported = database.prepare('SELECT file_name,file_sha256 FROM data_imports').get();
    expect(imported.file_name).toBe('valid-settlements.csv'); expect(imported.file_sha256).toHaveLength(64);
  });
  it('rejects an invalid row atomically with a line error', () => {
    const database = databaseFixture(); const batch = createBatch(database, { name: 'Invalid CSV', sourceMode: 'csv', requestedCount: 150 });
    expect(() => importCsv(database, { batchId: batch.id, buffer: readFileSync(join(fixtureDirectory, 'invalid-settlements.csv')), originalName: 'invalid.csv', requestId: 'csv-bad' })).toThrow('CSV validation failed');
    expect(database.prepare('SELECT count(*) count FROM settlement_records').get().count).toBe(0);
    expect(database.prepare('SELECT status,error_code FROM data_imports').get()).toEqual({ status: 'failed', error_code: 'CSV_ROW_INVALID' });
  });
  it('rejects duplicate entity IDs and persists no source rows', () => {
    const database = databaseFixture(); const batch = createBatch(database, { name: 'Duplicate CSV', sourceMode: 'csv', requestedCount: 150 });
    expect(() => importCsv(database, { batchId: batch.id, buffer: readFileSync(join(fixtureDirectory, 'invalid-duplicate-settlements.csv')), originalName: 'duplicates.csv', requestId: 'csv-duplicate' })).toThrow('CSV validation failed');
    expect(database.prepare('SELECT count(*) count FROM settlement_records').get().count).toBe(0);
  });
  it('records provider failure without partial settlement rows', async () => {
    const database = databaseFixture(); const batch = createBatch(database, { name: 'API failure', sourceMode: 'api', requestedCount: 150 });
    await expect(importRazorpay(database, { batchId: batch.id, query: {}, client: { fetchSettlementRecon: async () => { const error = new Error('secret response'); error.providerHttpStatus = 503; throw error; } }, requestId: 'api-bad' })).rejects.toMatchObject({ code: 'RAZORPAY_UNAVAILABLE' });
    expect(database.prepare('SELECT count(*) count FROM settlement_records').get().count).toBe(0);
    expect(database.prepare('SELECT status,error_code,provider_http_status FROM data_imports').get()).toEqual({ status: 'failed', error_code: 'RAZORPAY_UNAVAILABLE', provider_http_status: 503 });
  });
});

describe('deterministic generator and truth isolation', () => {
  it('creates exactly 150 integer-paise orders and isolated truth deterministically', async () => {
    const firstDb = databaseFixture(); const secondDb = databaseFixture(); const firstBatch = await loadedBatch(firstDb, 'First'); const secondBatch = await loadedBatch(secondDb, 'Second');
    const firstResult = generateOrders(firstDb, { batchId: firstBatch.id, count: 150, seed: 'held-out', requestId: 'gen-1' });
    generateOrders(secondDb, { batchId: secondBatch.id, count: 150, seed: 'held-out', requestId: 'gen-2' });
    expect(firstResult.count).toBe(150); expect(Object.values(firstResult.caseCounts).reduce((sum, value) => sum + value, 0)).toBe(150);
    const query = `SELECT merchant_order_id,order_receipt,gross_amount_paise,refund_amount_paise,expected_fee_paise,expected_tax_paise,expected_net_paise,order_date_utc,generation_case FROM orders ORDER BY id`;
    expect(firstDb.prepare(query).all()).toEqual(secondDb.prepare(query).all());
    expect(firstDb.prepare('SELECT count(*) count FROM evaluation_truth').get().count).toBe(150);
    for (const order of firstDb.prepare('SELECT gross_amount_paise,refund_amount_paise,expected_fee_paise,expected_tax_paise,expected_net_paise FROM orders').all()) for (const value of Object.values(order)) expect(Number.isInteger(value)).toBe(true);
    expect(JSON.stringify(firstResult)).not.toContain('expectedSettlement');
  });
  it('never exposes evaluation truth through Phase 2 APIs', async () => {
    const database = databaseFixture(); database.prepare('INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)').run('user-1', 'admin@settlewise.local', 'unused', new Date().toISOString());
    const batch = await loadedBatch(database, 'API generator');
    const app = createApp(database); const token = jwt.sign({ id: 'user-1', email: 'admin@settlewise.local' }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    const response = await request(app).post(`/api/v1/batches/${batch.id}/orders/generate`).set('Origin', env.CLIENT_ORIGIN).set('Cookie', `${SESSION_COOKIE}=${token}`).send({ count: 150, seed: 'api-seed' });
    expect(response.status).toBe(201); expect(response.body.data.count).toBe(150);
    expect(JSON.stringify(response.body)).not.toMatch(/evaluation_truth|expected_settlement_record_id|is_matchable/);
    expect((await request(app).get('/api/v1/evaluation_truth').set('Cookie', `${SESSION_COOKIE}=${token}`)).status).toBe(404);
  });
});
