import { env } from '../config/env.js';
import { URL } from 'node:url';

export class RazorpayUnavailableError extends Error {
  constructor(message = 'Razorpay Settlement Recon is unavailable', providerHttpStatus) {
    super(message);
    this.code = 'RAZORPAY_UNAVAILABLE';
    this.status = 503;
    this.providerHttpStatus = providerHttpStatus;
  }
}

export class RazorpayClient {
  constructor({ fetchImpl = globalThis.fetch, config = env } = {}) {
    this.fetchImpl = fetchImpl;
    this.config = config;
  }

  async fetchSettlementRecon({ year, month, day }) {
    const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret } = this.config;
    if (!keyId || !keySecret) throw new RazorpayUnavailableError();
    const records = [];
    const pageSize = 100;
    for (let skip = 0; skip < 1500; skip += pageSize) {
      const url = new URL(`${this.config.RAZORPAY_API_BASE_URL}/settlements/recon/combined`);
      url.searchParams.set('year', String(year));
      url.searchParams.set('month', String(month));
      if (day != null) url.searchParams.set('day', String(day));
      url.searchParams.set('count', String(pageSize));
      url.searchParams.set('skip', String(skip));
      let response;
      try {
        response = await this.fetchImpl(url, {
          headers: { authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}` },
          signal: AbortSignal.timeout(this.config.RAZORPAY_TIMEOUT_MS)
        });
      } catch {
        throw new RazorpayUnavailableError();
      }
      if (!response.ok) throw new RazorpayUnavailableError(undefined, response.status);
      let body;
      try { body = await response.json(); } catch { throw new RazorpayUnavailableError(); }
      const page = Array.isArray(body) ? body : body?.items;
      if (!Array.isArray(page)) throw new RazorpayUnavailableError();
      records.push(...page);
      if (page.length < pageSize) return records;
    }
    throw new RazorpayUnavailableError('Razorpay response exceeded the source-record limit');
  }
}

export const razorpayClient = new RazorpayClient();
