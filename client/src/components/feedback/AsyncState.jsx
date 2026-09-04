export function LoadingState({ label = 'Loading data' }) { return <div className="state" role="status"><span className="spinner" />{label}…</div>; }
export function EmptyState({ title, detail, action }) { return <div className="state empty"><strong>{title}</strong><p>{detail}</p>{action}</div>; }
export function ErrorState({ error, retry }) { return <div className="state error" role="alert"><strong>Something went wrong</strong><p>{error?.message ?? 'The request could not be completed.'}</p>{error?.code && <code>{error.code}</code>}{retry && <button className="secondary" onClick={retry}>Try again</button>}</div>; }
export function SuccessBanner({ children }) { return children ? <div className="banner success" role="status">{children}</div> : null; }
