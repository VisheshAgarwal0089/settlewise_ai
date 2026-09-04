import { createHash, randomUUID } from 'node:crypto';

function canonicalEvent(event) {
  return JSON.stringify({
    id: event.id, batchId: event.batchId ?? null, userId: event.userId ?? null,
    eventType: event.eventType, entityType: event.entityType, entityId: event.entityId ?? null,
    requestId: event.requestId, payload: JSON.parse(event.payloadJson),
    previousHash: event.previousHash ?? null, createdAt: event.createdAt
  });
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function appendAuditEvent(database, input) {
  const previous = database.prepare('SELECT event_hash FROM audit_logs ORDER BY rowid DESC LIMIT 1').get();
  const event = {
    id: randomUUID(), batchId: input.batchId ?? null, userId: input.userId ?? null,
    eventType: input.eventType, entityType: input.entityType, entityId: input.entityId ?? null,
    requestId: input.requestId, payloadJson: JSON.stringify(input.payload ?? {}),
    previousHash: previous?.event_hash ?? null, createdAt: new Date().toISOString()
  };
  const eventHash = digest(canonicalEvent(event));
  database.prepare(`INSERT INTO audit_logs
    (id,batch_id,user_id,event_type,entity_type,entity_id,request_id,payload_json,previous_hash,event_hash,created_at)
    VALUES (@id,@batchId,@userId,@eventType,@entityType,@entityId,@requestId,@payloadJson,@previousHash,@eventHash,@createdAt)`)
    .run({ ...event, eventHash });
  return { ...event, eventHash };
}

export function verifyAuditChain(database, batchId) {
  const rows = batchId
    ? database.prepare('SELECT * FROM audit_logs WHERE batch_id = ? ORDER BY rowid').all(batchId)
    : database.prepare('SELECT * FROM audit_logs ORDER BY rowid').all();
  let previousHash = null;
  for (const row of rows) {
    const event = {
      id: row.id, batchId: row.batch_id, userId: row.user_id, eventType: row.event_type,
      entityType: row.entity_type, entityId: row.entity_id, requestId: row.request_id,
      payloadJson: row.payload_json, previousHash: row.previous_hash, createdAt: row.created_at
    };
    if (row.previous_hash !== previousHash || digest(canonicalEvent(event)) !== row.event_hash) {
      return { valid: false, checkedEvents: rows.indexOf(row) + 1, firstInvalidEventId: row.id };
    }
    previousHash = row.event_hash;
  }
  return { valid: true, checkedEvents: rows.length };
}

