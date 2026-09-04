import { apiClient } from '../lib/apiClient.js';
export const login = (credentials) => apiClient('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
export const logout = () => apiClient('/api/v1/auth/logout', { method: 'POST' });
export const getCurrentUser = () => apiClient('/api/v1/auth/me');

