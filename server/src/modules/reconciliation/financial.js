function requireIntegerPaise(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer paise value`);
  return BigInt(value);
}

function exactPercentage(value, numerator, denominator, name) {
  const scaled = requireIntegerPaise(value, name) * BigInt(numerator);
  const divisor = BigInt(denominator);
  if (scaled % divisor !== 0n) throw new RangeError(`${name} does not resolve to whole paise`);
  return Number(scaled / divisor);
}

export function calculateExpectedFeePaise(grossAmountPaise) {
  return exactPercentage(grossAmountPaise, 2, 100, 'grossAmountPaise');
}

export function calculateExpectedTaxPaise(expectedFeePaise) {
  return exactPercentage(expectedFeePaise, 18, 100, 'expectedFeePaise');
}

export function calculateExpectedNetPaise({ grossAmountPaise, expectedFeePaise, expectedTaxPaise, refundAmountPaise }) {
  for (const [name, value] of Object.entries({ grossAmountPaise, expectedFeePaise, expectedTaxPaise, refundAmountPaise })) requireIntegerPaise(value, name);
  return grossAmountPaise - expectedFeePaise - expectedTaxPaise - refundAmountPaise;
}

export function calculateActualNetPaise(paymentCreditPaise, refundDebitPaise) {
  requireIntegerPaise(paymentCreditPaise, 'paymentCreditPaise');
  requireIntegerPaise(refundDebitPaise, 'refundDebitPaise');
  return paymentCreditPaise - refundDebitPaise;
}

export function aggregateRefunds(refunds) {
  return refunds.reduce((summary, refund) => {
    requireIntegerPaise(refund.debit_paise, 'refund.debit_paise');
    summary.refundDebitPaise += refund.debit_paise;
    summary.refundRecordIds.push(refund.id);
    return summary;
  }, { refundDebitPaise: 0, refundRecordIds: [] });
}

