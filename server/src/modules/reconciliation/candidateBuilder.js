const DAY_MS = 86_400_000;
const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
});

function istCalendarNumber(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(istDateFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY_MS;
}

export function calendarDayDifferenceIst(leftIso, rightIso) {
  if (!leftIso || !rightIso) return null;
  const left = istCalendarNumber(leftIso); const right = istCalendarNumber(rightIso);
  return left == null || right == null ? null : Math.abs(left - right);
}

function paymentQuery(database, where) {
  return database.prepare(`SELECT * FROM settlement_records WHERE batch_id = ? AND type = 'payment' AND ${where} ORDER BY entity_id`);
}

export function findRefundsForPayment(database, payment) {
  return database.prepare(`SELECT * FROM settlement_records
    WHERE batch_id = ? AND type = 'refund' AND
      ((order_id IS NOT NULL AND order_id = ?) OR (order_id IS NULL AND payment_id IS NOT NULL AND payment_id IN (?, ?)))
    ORDER BY entity_id`).all(payment.batch_id, payment.order_id, payment.entity_id, payment.payment_id);
}

export function buildCandidates(database, order) {
  const exactOrder = paymentQuery(database, 'order_id = ?').all(order.batch_id, order.merchant_order_id);
  if (exactOrder.length) return exactOrder.map((record) => ({ record, source: 'order_id', refunds: findRefundsForPayment(database, record) }));
  if (order.order_receipt) {
    const exactReceipt = paymentQuery(database, 'order_receipt = ? AND order_id IS NULL').all(order.batch_id, order.order_receipt);
    if (exactReceipt.length) return exactReceipt.map((record) => ({ record, source: 'order_receipt', refunds: findRefundsForPayment(database, record) }));
  }
  return paymentQuery(database, 'amount_paise = ?').all(order.batch_id, order.gross_amount_paise)
    .filter((record) => { const difference = calendarDayDifferenceIst(order.order_date_utc, record.settled_at_utc); return difference != null && difference <= 3; })
    .map((record) => ({ record, source: 'amount_date', refunds: findRefundsForPayment(database, record) }));
}
