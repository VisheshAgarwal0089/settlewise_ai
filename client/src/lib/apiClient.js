const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
export async function apiClient(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`${baseUrl}${path}`, { credentials: 'include', ...options, headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  const body = await response.json();
  if (!response.ok) { const error = new Error(body.error?.message ?? 'Request failed'); error.code = body.error?.code; error.requestId = body.error?.requestId; error.status = response.status; throw error; }
  return body;
}

export async function downloadCsv(path) {
  const response = await fetch(`${baseUrl}${path}`, { credentials: 'include' });
  if (!response.ok) { const body = await response.json(); const error = new Error(body.error?.message ?? 'Export failed'); error.code = body.error?.code; throw error; }
  return { blob: await response.blob(), fileName: /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'settlewise-export.csv' };
}
