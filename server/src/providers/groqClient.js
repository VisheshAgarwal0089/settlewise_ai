import { env } from '../config/env.js';

export class GroqUnavailableError extends Error {
  constructor() { super('Groq explanation is unavailable'); this.code = 'AI_EXPLANATION_FAILED'; }
}

export class GroqClient {
  constructor({ fetchImpl = globalThis.fetch, config = env } = {}) { this.fetchImpl = fetchImpl; this.config = config; }

  async explain(input) {
    if (!this.config.GROQ_API_KEY) throw new GroqUnavailableError();
    const body = {
      model: this.config.GROQ_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Explain the anomaly from deterministic evidence only. Return JSON with category, summary, and recommendedAction. Never propose changing scores, amounts, links, or statuses.' },
        { role: 'user', content: JSON.stringify(input) }
      ]
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response;
      try {
        response = await this.fetchImpl(`${this.config.GROQ_API_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: { authorization: `Bearer ${this.config.GROQ_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.GROQ_TIMEOUT_MS)
        });
      } catch {
        if (attempt === 0) continue;
        throw new GroqUnavailableError();
      }
      if (!response.ok) {
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
        throw new GroqUnavailableError();
      }
      try {
        const payload = await response.json();
        const content = payload?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') throw new Error();
        return { model: this.config.GROQ_MODEL, content };
      } catch { throw new GroqUnavailableError(); }
    }
    throw new GroqUnavailableError();
  }
}

export const groqClient = new GroqClient();
