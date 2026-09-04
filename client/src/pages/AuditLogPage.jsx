import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, verifyAuditLogs } from '../api/auditApi.js';
import { useActiveBatch } from '../hooks/useActiveBatch.js';
import { formatIst } from '../lib/dates.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/feedback/AsyncState.jsx';
import { Pagination } from '../components/tables/Pagination.jsx';

export function AuditLogPage() {
  const active = useActiveBatch(); const [page, setPage] = useState(1); const [eventType, setEventType] = useState('');
  const logs = useQuery({ queryKey: ['audit', active.activeBatchId, eventType, page], queryFn: () => getAuditLogs({ batchId: active.activeBatchId, eventType, page, pageSize: 20 }), enabled: Boolean(active.activeBatchId) });
  const verify = useQuery({ queryKey: ['audit-verify', active.activeBatchId], queryFn: () => verifyAuditLogs(active.activeBatchId), enabled: Boolean(active.activeBatchId) });
  return <main><PageHeader eyebrow="Tamper evidence" title="Audit log" description="Append-only financial workflow events linked by SHA-256 hashes." actions={<select aria-label="Event type" value={eventType} onChange={(event) => { setEventType(event.target.value); setPage(1); }}><option value="">All events</option>{['API_FETCH','CSV_UPLOAD','GENERATE','MATCH_RESULT','APPROVE','REJECT','MANUAL_LINK','EXPORT'].map((type) => <option key={type}>{type}</option>)}</select>} />
    {verify.isPending ? <LoadingState label="Verifying hash chain" /> : verify.isError ? <ErrorState error={verify.error} retry={verify.refetch} /> : verify.data && <div className={`integrity ${verify.data.data.valid ? 'valid' : 'invalid'}`}><span>{verify.data.data.valid ? '✓' : '!'}</span><div><strong>{verify.data.data.valid ? 'Hash chain verified' : 'Integrity check failed'}</strong><small>{verify.data.data.checkedEvents} events checked{verify.data.data.firstInvalidEventId ? ` · first invalid ${verify.data.data.firstInvalidEventId}` : ''}</small></div></div>}
    {!active.activeBatchId ? <EmptyState title="No audit scope" detail="Select or create a batch to inspect its events." /> : logs.isPending ? <LoadingState label="Loading audit events" /> : logs.isError ? <ErrorState error={logs.error} retry={logs.refetch} /> : logs.data.data.length === 0 ? <EmptyState title="No audit events" detail="Events appear after import, generation, matching, review or export." /> : <><div className="audit-list">{logs.data.data.map((event) => <article key={event.id}><span className="audit-icon">{event.eventType.slice(0, 1)}</span><div><div><strong>{event.eventType.replaceAll('_', ' ')}</strong><time>{formatIst(event.createdAt)}</time></div><p>{event.entityType} · {event.entityId ?? 'batch-wide event'}</p><code title={event.eventHash}>{event.eventHash.slice(0, 16)}…</code></div></article>)}</div><Pagination meta={logs.data.meta} onPage={setPage} /></>}
  </main>;
}
