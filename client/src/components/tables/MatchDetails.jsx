import { formatPaise } from '../../lib/currency.js';
import { StatusBadge } from '../feedback/StatusBadge.jsx';

const money = (value) => value == null ? '—' : formatPaise(value);

export function MatchDetails({ match, onClose }) {
  const candidates = match.deterministicEvidence?.rankedCandidates ?? [];
  const selectedEvidence = candidates.find((candidate) => candidate.settlementRecordId === match.settlementRecordId) ?? candidates[0] ?? null;
  const settlement = match.settlement;
  return <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="details-drawer" role="dialog" aria-modal="true" aria-labelledby="match-details-title">
      <div className="detail-heading"><div><span className="eyebrow">Authoritative match details</span><h3 id="match-details-title">{match.order.merchantOrderId}</h3></div><button className="secondary" onClick={onClose} aria-label="Close match details">Close</button></div>
      <div className="details-status"><StatusBadge status={match.status} /><strong>{match.confidenceScore}/100</strong></div>
      <dl className="details-grid">
        <div><dt>Merchant order ID</dt><dd>{match.order.merchantOrderId}</dd></div><div><dt>Settlement record ID</dt><dd>{settlement?.id ?? '—'}</dd></div>
        <div><dt>Payment ID</dt><dd>{settlement?.paymentId ?? '—'}</dd></div><div><dt>Settlement UTR</dt><dd>{settlement?.settlementUtr ?? '—'}</dd></div>
        <div><dt>Gross amount</dt><dd>{money(match.order.grossAmountPaise)}</dd></div><div><dt>Expected fee</dt><dd>{money(match.order.expectedFeePaise)}</dd></div>
        <div><dt>Actual fee</dt><dd>{money(settlement?.feePaise)}</dd></div><div><dt>Expected GST</dt><dd>{money(match.order.expectedTaxPaise)}</dd></div>
        <div><dt>Actual GST</dt><dd>{money(settlement?.taxPaise)}</dd></div><div><dt>Refund</dt><dd>{money(settlement?.refundAmountPaise)} actual · {money(match.order.refundAmountPaise)} expected</dd></div>
        <div><dt>Expected net</dt><dd>{money(match.expectedNetPaise)}</dd></div><div><dt>Actual net</dt><dd>{money(match.actualNetPaise)}</dd></div>
        <div><dt>Variance</dt><dd>{money(match.variancePaise)}</dd></div><div><dt>Matching source</dt><dd>{selectedEvidence?.source ?? match.matchedBy}</dd></div>
      </dl>
      <section className="evidence-panel"><h4>Deterministic evidence</h4><p>Confidence components</p><div className="component-list">{Object.entries(selectedEvidence?.components ?? {}).map(([name, value]) => <span key={name}><strong>{value}</strong> {name}</span>)}</div><div className="reason-list">{match.reasonCodes.map((code) => <code key={code}>{code}</code>)}</div></section>
      <section className="ai-panel"><h4>AI explanation · advisory only</h4>{match.aiExplanation ? <><p>{match.aiExplanation.summary}</p><strong>Suggested review action</strong><p>{match.aiExplanation.recommendedAction}</p><code>{match.aiExplanation.status}{match.aiExplanation.model ? ` · ${match.aiExplanation.model}` : ''}</code></> : <p>No AI explanation has been generated. Deterministic evidence above remains authoritative.</p>}</section>
    </section>
  </div>;
}
