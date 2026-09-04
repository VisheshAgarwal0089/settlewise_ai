import { randomUUID } from 'node:crypto';

export function createBatch(database, input) {
  const now = new Date().toISOString();
  const batch = { id: randomUUID(), name: input.name, sourceMode: input.sourceMode, status: 'uploaded', requestedCount: input.requestedCount, orderCount: 0, settlementRecordCount: 0, createdAt: now, updatedAt: now };
  database.prepare(`INSERT INTO batches (id,name,source_mode,status,requested_count,order_count,settlement_record_count,created_at,updated_at)
    VALUES (@id,@name,@sourceMode,@status,@requestedCount,@orderCount,@settlementRecordCount,@createdAt,@updatedAt)`).run(batch);
  return batch;
}

export function getBatch(database, id) {
  const row = database.prepare('SELECT id,name,source_mode, status,requested_count,order_count,settlement_record_count,created_at,updated_at FROM batches WHERE id = ?').get(id);
  if (!row) return null;
  return { id: row.id, name: row.name, sourceMode: row.source_mode, status: row.status, requestedCount: row.requested_count, orderCount: row.order_count, settlementRecordCount: row.settlement_record_count, createdAt: row.created_at, updatedAt: row.updated_at };
}
