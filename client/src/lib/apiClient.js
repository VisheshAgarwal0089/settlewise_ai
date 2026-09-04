const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
export async function apiClient(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...options.headers }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Request failed');
  return body;
}

