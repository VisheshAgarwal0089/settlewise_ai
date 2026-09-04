import { apiClient } from '../lib/apiClient.js';
export const getRecords = (batchId) => apiClient(`/api/v1/batches/${batchId}/records`);

