import { apiClient } from '../lib/apiClient.js';
export const getBatches = () => apiClient('/api/v1/batches');

