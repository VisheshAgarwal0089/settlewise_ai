export function StatusBadge({ status }) { return <span className={`badge ${String(status ?? 'unknown').replace('_', '-')}`}>{String(status ?? 'not started').replaceAll('_', ' ')}</span>; }
