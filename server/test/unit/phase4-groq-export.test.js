import { describe, expect, it, vi } from 'vitest';
import { GroqClient } from '../../src/providers/groqClient.js';
import { protectFormula } from '../../src/modules/exports/exportService.js';
import { loadEnv } from '../../src/config/env.js';

describe('Groq adapter contract', () => {
  it('defaults GROQ_MODEL to openai/gpt-oss-20b', () => expect(loadEnv().GROQ_MODEL).toBe('openai/gpt-oss-20b'));
  it('uses the configured model and structured JSON response mode', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"category":"other","summary":"Review","recommendedAction":"Inspect"}' } }] }) });
    const config = { GROQ_API_KEY: 'secret', GROQ_API_BASE_URL: 'https://groq.test/v1', GROQ_MODEL: 'configured-model', GROQ_TIMEOUT_MS: 1000 };
    const result = await new GroqClient({ fetchImpl, config }).explain({ reasonCodes: ['NO_CANDIDATE'] });
    expect(result.model).toBe('configured-model');
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('configured-model'); expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[1].content).not.toMatch(/password|authorization|evaluation_truth/i);
  });
  it('retries one retryable provider response', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: false, status: 503 }).mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) });
    const config = { GROQ_API_KEY: 'secret', GROQ_API_BASE_URL: 'https://groq.test/v1', GROQ_MODEL: 'model', GROQ_TIMEOUT_MS: 1000 };
    await new GroqClient({ fetchImpl, config }).explain({}); expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('CSV formula-injection protection', () => {
  it.each(['=cmd', '+SUM(A1)', '-2+3', '@payload'])('prefixes %s', (value) => expect(protectFormula(value)).toBe(`'${value}`));
  it('leaves ordinary text and integer paise unchanged', () => { expect(protectFormula('order_1')).toBe('order_1'); expect(protectFormula(100000)).toBe('100000'); });
});

