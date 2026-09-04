import { aggregateRefunds, calculateActualNetPaise, calculateExpectedFeePaise, calculateExpectedTaxPaise } from './financial.js';
import { calendarDayDifferenceIst } from './candidateBuilder.js';
import { REASON_CODES } from './reasonCodes.js';

export function classifyMatch({ score, ambiguous = false, hardGatesPass = true }) {
  if (ambiguous) return 'pending_review';
  if (score >= 85 && hardGatesPass) return 'matched';
  if (score >= 60) return 'pending_review';
  return 'unresolved';
}

export function scoreCandidate(order, candidate, { manuallyLinkedElsewhere = false } = {}) {
  const payment = candidate.record;
  const refundSummary = aggregateRefunds(candidate.refunds);
  const expectedFeePaise = calculateExpectedFeePaise(order.gross_amount_paise);
  const expectedTaxPaise = calculateExpectedTaxPaise(expectedFeePaise);
  const orderIdMatch = payment.order_id != null && payment.order_id === order.merchant_order_id;
  const receiptMatch = !orderIdMatch && payment.order_id == null && order.order_receipt != null && payment.order_receipt === order.order_receipt;
  const amountMatch = payment.amount_paise === order.gross_amount_paise;
  const dateDifferenceDays = calendarDayDifferenceIst(order.order_date_utc, payment.settled_at_utc);
  const dateWithinTolerance = dateDifferenceDays != null && dateDifferenceDays <= 3;
  const feeAgrees = payment.fee_paise === expectedFeePaise;
  const taxAgrees = payment.tax_paise === expectedTaxPaise;
  const refundAgrees = refundSummary.refundDebitPaise === order.refund_amount_paise;
  const formulaAgrees = feeAgrees && taxAgrees && refundAgrees;
  const components = {
    identifier: orderIdMatch ? 50 : receiptMatch ? 45 : 0,
    amount: amountMatch ? 25 : 0,
    date: dateDifferenceDays == null || dateDifferenceDays > 3 ? 0 : dateDifferenceDays <= 1 ? 15 : dateDifferenceDays === 2 ? 12 : 8,
    formula: formulaAgrees ? 10 : 0
  };
  const score = Math.min(100, Object.values(components).reduce((sum, value) => sum + value, 0));
  const reasonCodes = [];
  if (orderIdMatch) reasonCodes.push(REASON_CODES.EXACT_ORDER_ID);
  else if (receiptMatch) reasonCodes.push(REASON_CODES.EXACT_ORDER_RECEIPT);
  else reasonCodes.push(REASON_CODES.MISSING_REFERENCE);
  reasonCodes.push(amountMatch ? REASON_CODES.EXACT_GROSS_AMOUNT : REASON_CODES.AMOUNT_MISMATCH);
  reasonCodes.push(dateWithinTolerance ? REASON_CODES.DATE_WITHIN_TOLERANCE : REASON_CODES.DATE_OUTSIDE_TOLERANCE);
  if (formulaAgrees) reasonCodes.push(REASON_CODES.FORMULA_AGREES);
  else {
    if (!feeAgrees) reasonCodes.push(REASON_CODES.FEE_MISMATCH);
    if (!taxAgrees) reasonCodes.push(REASON_CODES.TAX_MISMATCH);
    if (!refundAgrees) reasonCodes.push(REASON_CODES.REFUND_MISMATCH);
  }
  if (manuallyLinkedElsewhere) reasonCodes.push(REASON_CODES.SETTLEMENT_ALREADY_LINKED);
  const actualNetPaise = calculateActualNetPaise(payment.credit_paise, refundSummary.refundDebitPaise);
  return {
    settlementRecordId: payment.id,
    entityId: payment.entity_id,
    score,
    components,
    actualNetPaise,
    variancePaise: actualNetPaise - order.expected_net_paise,
    refundRecordIds: refundSummary.refundRecordIds,
    checks: { orderIdMatch, receiptMatch, amountMatch, dateDifferenceDays, dateWithinTolerance, feeAgrees, taxAgrees, refundAgrees, formulaAgrees, manuallyLinkedElsewhere },
    reasonCodes,
    hardGatesPass: amountMatch && dateWithinTolerance && !manuallyLinkedElsewhere
  };
}
