import { appendAuditEvent } from '../audit/auditService.js';

export class ResetError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

const count = (database, table) => database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count;

export function resetAllData(database, { confirmation, userId, requestId }) {
  if (confirmation !== 'RESET ALL DATA') throw new ResetError('RESET_CONFIRMATION_INVALID', 'Confirmation must exactly match RESET ALL DATA');
  return database.transaction(() => {
    const deleted = {
      batches: count(database, 'batches'), orders: count(database, 'orders'), settlementRecords: count(database, 'settlement_records'),
      matches: count(database, 'matches'), reviewActions: count(database, 'review_actions'), explanations: count(database, 'ai_explanations'),
      auditLogs: count(database, 'audit_logs'), evaluationTruth: count(database, 'evaluation_truth'), dataImports: count(database, 'data_imports')
    };
    const finalEvent = appendAuditEvent(database, { userId, eventType: 'RESET', entityType: 'system', requestId, payload: { deleted } });
    console.info(JSON.stringify({ event: 'RESET', requestId, userId, eventHash: finalEvent.eventHash, deleted }));
    database.prepare('DELETE FROM audit_logs').run();
    database.prepare('DELETE FROM batches').run();
    return { deleted, sessionPreserved: true };
  })();
}

