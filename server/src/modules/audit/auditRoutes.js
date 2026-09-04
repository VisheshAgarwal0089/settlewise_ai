import { Router } from 'express';
import { verifyAuditChain } from './auditService.js';

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? '20', 10) || 20));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function createAuditRouter(database) {
  const router = Router();
  router.get('/verify', (req, res) => res.json({ data: verifyAuditChain(database, req.query.batchId), meta: {} }));
  router.get('/', (req, res) => {
    const { page, pageSize, offset } = pagination(req.query);
    const clauses = []; const params = { pageSize, offset };
    if (req.query.batchId) { clauses.push('batch_id=@batchId'); params.batchId = req.query.batchId; }
    if (req.query.eventType) { clauses.push('event_type=@eventType'); params.eventType = req.query.eventType; }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const total = database.prepare(`SELECT COUNT(*) count FROM audit_logs ${where}`).get(params).count;
    const rows = database.prepare(`SELECT id,batch_id,user_id,event_type,entity_type,entity_id,request_id,payload_json,previous_hash,event_hash,created_at FROM audit_logs ${where} ORDER BY rowid DESC LIMIT @pageSize OFFSET @offset`).all(params);
    res.json({ data: rows.map((row) => ({ id: row.id, batchId: row.batch_id, userId: row.user_id, eventType: row.event_type, entityType: row.entity_type, entityId: row.entity_id, requestId: row.request_id, payload: JSON.parse(row.payload_json), previousHash: row.previous_hash, eventHash: row.event_hash, createdAt: row.created_at })), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  });
  return router;
}
