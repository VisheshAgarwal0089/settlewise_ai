import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { env } from '../../config/env.js';

const categories = ['amount_mismatch', 'date_mismatch', 'missing_reference', 'ambiguous_candidate', 'fee_mismatch', 'tax_mismatch', 'refund_mismatch', 'missing_settlement', 'other'];
const outputSchema = z.object({
  category: z.enum(categories),
  summary: z.string().trim().min(1).max(600),
  recommendedAction: z.string().trim().min(1).max(300)
}).strict();

export class ExplanationError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}

function fallback(reasonCodes) {
  const mappings = [
    ['AMBIGUOUS_CANDIDATES', 'ambiguous_candidate', 'Multiple candidates have similar deterministic scores.', 'Compare the ranked candidates before approving or manually linking.'],
    ['AMOUNT_MISMATCH', 'amount_mismatch', 'The order and proposed settlement gross amounts differ.', 'Verify the merchant order amount against the provider record.'],
    ['DATE_OUTSIDE_TOLERANCE', 'date_mismatch', 'The settlement date is outside the three-day IST window.', 'Confirm the settlement timing before making a review decision.'],
    ['REFUND_MISMATCH', 'refund_mismatch', 'Observed refund debits do not match the expected refund.', 'Review linked refund records and the merchant refund amount.'],
    ['FEE_MISMATCH', 'fee_mismatch', 'The observed provider fee differs from the fixed expected fee.', 'Review the provider fee without changing the imported source record.'],
    ['TAX_MISMATCH', 'tax_mismatch', 'The observed provider tax differs from expected GST.', 'Review the provider tax without changing the imported source record.'],
    ['MISSING_REFERENCE', 'missing_reference', 'No exact order reference supports the candidate.', 'Use deterministic evidence to select a candidate or leave unresolved.'],
    ['NO_CANDIDATE', 'missing_settlement', 'No eligible settlement candidate was found.', 'Confirm the source import and leave unresolved unless a valid payment is found.']
  ];
  const selected = mappings.find(([code]) => reasonCodes.includes(code)) ?? [null, 'other', 'Deterministic checks require human review.', 'Review the persisted evidence before taking action.'];
  return { category: selected[1], summary: selected[2], recommendedAction: selected[3] };
}

function safeInput(match) {
  const evidence = JSON.parse(match.evidence_json); const top = evidence.rankedCandidates?.[0];
  return {
    status: match.status,
    confidenceScore: match.confidence_score,
    variancePaise: match.variance_paise,
    reasonCodes: JSON.parse(match.reason_codes_json),
    candidateCount: evidence.candidateCount ?? 0,
    ambiguous: Boolean(evidence.ambiguous),
    topCandidate: top ? { score: top.score, components: top.components, checks: top.checks, refundCount: top.refundRecordIds?.length ?? 0 } : null
  };
}

function saveExplanation(database, { matchId, model, inputSha256, status, output, errorCode }) {
  const now = new Date().toISOString();
  database.prepare(`INSERT INTO ai_explanations
    (id,match_id,provider,model,prompt_version,input_sha256,status,category,summary,recommended_action,error_code,created_at,completed_at)
    VALUES (?,?, 'groq',?,'1.0.0',?,?,?,?,?,?,?,?)
    ON CONFLICT(match_id,input_sha256) DO UPDATE SET model=excluded.model,status=excluded.status,category=excluded.category,summary=excluded.summary,recommended_action=excluded.recommended_action,error_code=excluded.error_code,completed_at=excluded.completed_at`)
    .run(randomUUID(), matchId, model, inputSha256, status, output.category, output.summary, output.recommendedAction, errorCode ?? null, now, now);
  return database.prepare('SELECT id,provider,model,prompt_version,input_sha256,status,category,summary,recommended_action,error_code,created_at,completed_at FROM ai_explanations WHERE match_id=? AND input_sha256=?').get(matchId, inputSha256);
}

export async function explainMatch(database, { matchId, client }) {
  const match = database.prepare('SELECT * FROM matches WHERE id=?').get(matchId);
  if (!match) throw new ExplanationError('MATCH_NOT_FOUND', 'Match not found', 404);
  if (!['pending_review', 'unresolved'].includes(match.status)) throw new ExplanationError('EXPLANATION_NOT_APPLICABLE', 'Explanations are only generated for anomalous matches', 409);
  const input = safeInput(match);
  const inputSha256 = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const deterministic = fallback(input.reasonCodes);
  let model = env.GROQ_MODEL; let status = 'failed'; let output = deterministic; let errorCode = 'AI_EXPLANATION_FAILED';
  try {
    const response = await client.explain(input); model = response.model;
    const parsed = outputSchema.safeParse(JSON.parse(response.content));
    if (!parsed.success) throw new Error('Invalid structured output');
    output = parsed.data; status = 'succeeded'; errorCode = null;
  } catch { /* deterministic fallback is authoritative for display */ }
  const saved = saveExplanation(database, { matchId, model, inputSha256, status, output, errorCode });
  return { id: saved.id, provider: saved.provider, model: saved.model, promptVersion: saved.prompt_version, status: saved.status, category: saved.category, summary: saved.summary, recommendedAction: saved.recommended_action, errorCode: saved.error_code, createdAt: saved.created_at, completedAt: saved.completed_at };
}

