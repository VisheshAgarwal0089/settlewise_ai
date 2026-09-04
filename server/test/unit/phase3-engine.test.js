import { describe, expect, it } from 'vitest';
import { aggregateRefunds, calculateActualNetPaise, calculateExpectedFeePaise, calculateExpectedNetPaise, calculateExpectedTaxPaise } from '../../src/modules/reconciliation/financial.js';
import { calendarDayDifferenceIst } from '../../src/modules/reconciliation/candidateBuilder.js';
import { classifyMatch, scoreCandidate } from '../../src/modules/reconciliation/scoreCandidate.js';
import { REASON_CODES } from '../../src/modules/reconciliation/reasonCodes.js';

function order(overrides = {}) {
  return { id: 'order-row', batch_id: 'batch', merchant_order_id: 'order_1', order_receipt: 'receipt_1', gross_amount_paise: 100000, refund_amount_paise: 0, expected_fee_paise: 2000, expected_tax_paise: 360, expected_net_paise: 97640, order_date_utc: '2026-09-01T18:30:00.000Z', ...overrides };
}
function candidate(days, overrides = {}, refunds = []) {
  const settled = new Date('2026-09-01T18:30:00.000Z'); settled.setUTCDate(settled.getUTCDate() + days);
  return { source: 'order_id', refunds, record: { id: 'settlement-row', batch_id: 'batch', entity_id: 'pay_1', type: 'payment', order_id: 'order_1', order_receipt: 'receipt_1', payment_id: 'pay_1', amount_paise: 100000, fee_paise: 2000, tax_paise: 360, credit_paise: 97640, settled_at_utc: settled.toISOString(), ...overrides } };
}

describe('integer-paise financial calculations', () => {
  it('calculates fee, GST, refund-adjusted expected net and actual net without rupee floats', () => {
    expect(calculateExpectedFeePaise(100000)).toBe(2000);
    expect(calculateExpectedTaxPaise(2000)).toBe(360);
    expect(calculateExpectedNetPaise({ grossAmountPaise: 100000, expectedFeePaise: 2000, expectedTaxPaise: 360, refundAmountPaise: 10000 })).toBe(87640);
    expect(calculateActualNetPaise(97640, 10000)).toBe(87640);
    expect(aggregateRefunds([{ id: 'refund-1', debit_paise: 4000 }, { id: 'refund-2', debit_paise: 6000 }])).toEqual({ refundDebitPaise: 10000, refundRecordIds: ['refund-1', 'refund-2'] });
  });
  it('rejects percentages that do not resolve to integer paise', () => expect(() => calculateExpectedFeePaise(101)).toThrow('whole paise'));
});

describe('classification boundaries', () => {
  it.each([[59, 'unresolved'], [60, 'pending_review'], [84, 'pending_review'], [85, 'matched'], [100, 'matched']])('classifies confidence %i as %s', (score, status) => expect(classifyMatch({ score })).toBe(status));
  it('keeps a hard-gated score of 100 in review', () => expect(classifyMatch({ score: 100, hardGatesPass: false })).toBe('pending_review'));
});

describe('IST date and evidence scoring', () => {
  it.each([[0, 15, true], [1, 15, true], [2, 12, true], [3, 8, true], [4, 0, false]])('scores an IST calendar difference of %i days', (days, datePoints, withinTolerance) => {
    const result = scoreCandidate(order(), candidate(days));
    expect(calendarDayDifferenceIst(order().order_date_utc, candidate(days).record.settled_at_utc)).toBe(days);
    expect(result.components.date).toBe(datePoints);
    expect(result.checks.dateWithinTolerance).toBe(withinTolerance);
    expect(result.hardGatesPass).toBe(withinTolerance);
  });
  it('scores a complete exact candidate at 100 with persisted evidence fields', () => {
    const result = scoreCandidate(order(), candidate(1));
    expect(result.score).toBe(100);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([REASON_CODES.EXACT_ORDER_ID, REASON_CODES.EXACT_GROSS_AMOUNT, REASON_CODES.DATE_WITHIN_TOLERANCE, REASON_CODES.FORMULA_AGREES]));
  });
  it('blocks amount mismatch from automatic matching', () => {
    const result = scoreCandidate(order(), candidate(1, { amount_paise: 102500, fee_paise: 2050, tax_paise: 369 }));
    expect(result.score).toBe(65);
    expect(result.hardGatesPass).toBe(false);
    expect(result.reasonCodes).toContain(REASON_CODES.AMOUNT_MISMATCH);
    expect(classifyMatch({ score: result.score, hardGatesPass: result.hardGatesPass })).toBe('pending_review');
  });
  it('links refund debits into actual net and formula evidence', () => {
    const refund = { id: 'refund-1', debit_paise: 10000 };
    const result = scoreCandidate(order({ refund_amount_paise: 10000, expected_net_paise: 87640 }), candidate(1, {}, [refund]));
    expect(result.actualNetPaise).toBe(87640);
    expect(result.refundRecordIds).toEqual(['refund-1']);
    expect(result.checks.refundAgrees).toBe(true);
    expect(result.score).toBe(100);
  });
});

