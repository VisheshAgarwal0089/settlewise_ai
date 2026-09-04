import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../../src/db/connection.js';
import { migrate } from '../../src/db/migrate.js';
import { appendAuditEvent, verifyAuditChain } from '../../src/modules/audit/auditService.js';
import { CSV_HEADERS } from '../../src/config/constants.js';
import { loadEnv } from '../../src/config/env.js';

const directories = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function databaseFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'settlewise-'));
  directories.push(directory);
  const database = openDatabase(join(directory, 'test.db'));
  migrate(database); migrate(database);
  return database;
}

describe('Phase 0 contracts', () => {
  it('uses the exact CSV fallback header', () => expect(CSV_HEADERS.join(',')).toBe('entity_id,type,amount,currency,fee,tax,credit,debit,settled,created_at,settled_at,settlement_id,settlement_utr,order_id,order_receipt,payment_id'));
  it('rejects unsafe environment secrets', () => expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'short', ADMIN_EMAIL: 'a@b.com', ADMIN_PASSWORD_HASH: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttx.5HjB5FP1is0hPS5.S0fY3H6u' })).toThrow('Invalid environment'));
});

describe('database and audit foundation', () => {
  it('migrates idempotently and enables integrity pragmas', () => { const db = databaseFixture(); expect(db.pragma('foreign_keys', { simple: true })).toBe(1); expect(db.pragma('journal_mode', { simple: true })).toBe('wal'); expect(db.prepare("SELECT count(*) count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").get().count).toBe(11); db.close(); });
  it('detects audit tampering', () => { const db = databaseFixture(); const first = appendAuditEvent(db, { eventType: 'CSV_UPLOAD', entityType: 'batch', requestId: 'req-1', payload: { count: 1 } }); appendAuditEvent(db, { eventType: 'MATCH_RESULT', entityType: 'order', requestId: 'req-2', payload: { status: 'matched' } }); expect(verifyAuditChain(db)).toEqual({ valid: true, checkedEvents: 2 }); db.prepare('UPDATE audit_logs SET payload_json = ? WHERE id = ?').run('{"count":2}', first.id); expect(verifyAuditChain(db).valid).toBe(false); db.close(); });
});

