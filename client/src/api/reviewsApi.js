import { apiClient } from '../lib/apiClient.js';
const build = (params) => new URLSearchParams(Object.entries(params).filter(([, value]) => value != null)).toString();
export const getReviewQueue = (batchId, params = {}) => apiClient(`/api/v1/batches/${batchId}/review-queue?${build(params)}`);
export const getMatch = (matchId) => apiClient(`/api/v1/matches/${matchId}`);
export const approveMatch = (matchId, note) => apiClient(`/api/v1/matches/${matchId}/approve`, { method: 'POST', body: JSON.stringify({ note: note || undefined }) });
export const rejectMatch = (matchId, note) => apiClient(`/api/v1/matches/${matchId}/reject`, { method: 'POST', body: JSON.stringify({ note: note || undefined }) });
export const manualLink = (matchId, settlementRecordId, note) => apiClient(`/api/v1/matches/${matchId}/manual-link`, { method: 'POST', body: JSON.stringify({ settlementRecordId, note: note || undefined }) });
export const explainMatch = (matchId) => apiClient(`/api/v1/matches/${matchId}/explanation/retry`, { method: 'POST', body: '{}' });
