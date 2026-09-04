import { apiClient } from '../lib/apiClient.js';
const build = (params) => new URLSearchParams(Object.entries(params).filter(([, value]) => value !== '' && value != null)).toString();
export const getRecords = (batchId, params = {}) => apiClient(`/api/v1/batches/${batchId}/records?${build(params)}`);
