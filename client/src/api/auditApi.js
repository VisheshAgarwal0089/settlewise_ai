import { apiClient } from '../lib/apiClient.js';
const build = (params) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null)).toString();
export const getAuditLogs = (params = {}) => apiClient(`/api/v1/audit-logs?${build(params)}`);
export const verifyAuditLogs = (batchId) => apiClient(`/api/v1/audit-logs/verify?${build({ batchId })}`);
