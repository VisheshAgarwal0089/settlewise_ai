function ratio(numerator, denominator) { return denominator === 0 ? 0 : numerator / denominator; }

export function calculateMetrics(database, batchId) {
  const rows = database.prepare(`SELECT
      m.status, m.matched_by, m.settlement_record_id, m.variance_paise,
      t.expected_settlement_record_id, t.is_matchable, t.is_anomaly
    FROM matches m JOIN evaluation_truth t ON t.order_id = m.order_id
    WHERE m.batch_id = ?`).all(batchId);
  const totalOrders = rows.length;
  const eligibleOrders = rows.filter((row) => row.is_matchable === 1).length;
  const engineMatches = rows.filter((row) => row.status === 'matched' && row.matched_by === 'engine');
  const correctEngineMatches = engineMatches.filter((row) => row.settlement_record_id === row.expected_settlement_record_id).length;
  const anomalyRows = rows.filter((row) => row.is_anomaly === 1);
  const correctlyFlaggedAnomalies = anomalyRows.filter((row) => row.status !== 'matched').length;
  const pendingReviewOrders = rows.filter((row) => row.status === 'pending_review').length;
  const unexplainedVariancePaise = rows.filter((row) => row.status !== 'matched' && row.variance_paise != null).reduce((sum, row) => sum + Math.abs(row.variance_paise), 0);
  return {
    autoMatchRate: ratio(engineMatches.length, eligibleOrders),
    precision: ratio(correctEngineMatches, engineMatches.length),
    recall: ratio(correctEngineMatches, eligibleOrders),
    exceptionRecall: ratio(correctlyFlaggedAnomalies, anomalyRows.length),
    falseMatchRate: ratio(engineMatches.length - correctEngineMatches, engineMatches.length),
    manualReviewRate: ratio(pendingReviewOrders, totalOrders),
    unexplainedVariancePaise,
    denominators: { totalOrders, eligibleOrders, engineMatches: engineMatches.length, groundTruthMatchableOrders: eligibleOrders, groundTruthAnomalies: anomalyRows.length }
  };
}
