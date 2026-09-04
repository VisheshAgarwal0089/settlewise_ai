import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../src/lib/apiClient.js';

afterEach(() => vi.unstubAllGlobals());

describe('frontend API client', () => {
  it('preserves safe backend codes needed to expose CSV fallback', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'RAZORPAY_UNAVAILABLE', message: 'Provider unavailable', requestId: 'request-1' } }), { status: 503, headers: { 'Content-Type': 'application/json' } })));
    await expect(apiClient('/api/v1/batches/batch/settlements/fetch')).rejects.toMatchObject({ code: 'RAZORPAY_UNAVAILABLE', requestId: 'request-1', status: 503 });
  });

  it('does not override the multipart boundary for CSV uploads', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: {}, meta: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData(); body.append('file', new Blob(['entity_id']), 'fallback.csv');
    await apiClient('/upload', { method: 'POST', body });
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Content-Type');
  });
});
