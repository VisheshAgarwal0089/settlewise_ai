import { describe, expect, it, vi } from 'vitest';
import { normalizeSourceRecord } from '../../src/modules/reconciliation/normalize.js';
import { parseCsvBuffer } from '../../src/modules/ingestion/ingestionService.js';
import { RazorpayClient, RazorpayUnavailableError } from '../../src/providers/razorpayClient.js';

const apiRow = { entity_id: ' pay_1 ', type: 'payment', amount: 100000, currency: 'INR', fee: 2000, tax: 360, credit: 97640, debit: 0, settled: true, created_at: 1788451200, settled_at: 1788537600, settlement_id: ' setl_1 ', settlement_utr: '', order_id: 'order_1', order_receipt: '', payment_id: 'pay_1' };

describe('shared source normalization', () => {
  it('normalizes equivalent API and CSV records through the same contract', () => {
    const fromApi = normalizeSourceRecord(apiRow);
    const csv = Buffer.from('entity_id,type,amount,currency,fee,tax,credit,debit,settled,created_at,settled_at,settlement_id,settlement_utr,order_id,order_receipt,payment_id\npay_1,payment,100000,INR,2000,360,97640,0,1,1788451200,1788537600,setl_1,,order_1,,pay_1\n');
    const fromCsv = parseCsvBuffer(csv)[0];
    const project = ({ rawPayloadJson: _, ...record }) => record;
    expect(project(fromCsv)).toEqual(project(fromApi));
    expect(fromApi.amountPaise).toBe(100000);
    expect(fromApi.settlementUtr).toBeNull();
  });
});

describe('Razorpay adapter', () => {
  const config = { RAZORPAY_KEY_ID: 'key', RAZORPAY_KEY_SECRET: 'secret', RAZORPAY_API_BASE_URL: 'https://api.example.test/v1', RAZORPAY_TIMEOUT_MS: 1000 };
  it('paginates until a short page and sends Basic auth', async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...apiRow, entity_id: `pay_${index}` }));
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ items: first }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ ...apiRow, entity_id: 'pay_100' }] }) });
    const records = await new RazorpayClient({ fetchImpl, config }).fetchSettlementRecon({ year: 2026, month: 9, day: 4 });
    expect(records).toHaveLength(101);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1][0])).toContain('skip=100');
    expect(fetchImpl.mock.calls[0][1].headers.authorization).toMatch(/^Basic /);
  });
  it('maps provider failures to a safe unavailable error', async () => {
    const client = new RazorpayClient({ fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 503 }), config });
    await expect(client.fetchSettlementRecon({ year: 2026, month: 9 })).rejects.toBeInstanceOf(RazorpayUnavailableError);
  });
});
