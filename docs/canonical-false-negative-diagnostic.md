# Canonical False-Negative Diagnostic

Canonical seed: `phase6-held-out-seed`. Stable provider entity IDs are used for settlement records because database UUIDs are intentionally regenerated on each isolated evaluation.

Measured result: 150 total, 146 ground-truth matchable, 123 automatic matches, 123 correct automatic matches, 0 false positives, 100% precision, 84.25% recall/automatic-match rate, 23 pending review, 4 unresolved.

Score columns are `identifier/amount/date/formula`. Money comparisons are integer paise. Refund entries are `expected / linked debit total / linked record IDs`.

| Order ID | Case | Expected settlement | Top candidate | Score | Components | IST days | Gross order/source | Fee expected/actual | GST expected/actual | Refund linkage | Reason codes | Blocking hard gate | Diagnosis |
|---|---|---|---|---:|---|---:|---|---|---|---|---|---|---|
| provider-order-2 | amount_mismatch | entity-2 | entity-2 | 65 | 50/0/15/0 | 1 | 105000/102500 | 2100/2050 | 378/369 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-52 | amount_mismatch | entity-52 | entity-52 | 65 | 50/0/15/0 | 1 | 167500/165000 | 3350/3300 | 603/594 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-64 | amount_mismatch | entity-64 | entity-64 | 65 | 50/0/15/0 | 1 | 182500/180000 | 3650/3600 | 657/648 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-66 | amount_mismatch | entity-66 | entity-66 | 65 | 50/0/15/0 | 1 | 185000/182500 | 3700/3650 | 666/657 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-110 | date_mismatch | entity-110 | entity-110 | 85 | 50/25/0/10 | 4 | 237500/237500 | 4750/4750 | 855/855 | 0/0/[] | EXACT_ORDER_ID, EXACT_GROSS_AMOUNT, DATE_OUTSIDE_TOLERANCE, FORMULA_AGREES | ±3 IST days | dataset design |
| provider-order-123 | date_mismatch | entity-123 | entity-123 | 85 | 50/25/0/10 | 4 | 252500/252500 | 5050/5050 | 909/909 | 0/0/[] | EXACT_ORDER_ID, EXACT_GROSS_AMOUNT, DATE_OUTSIDE_TOLERANCE, FORMULA_AGREES | ±3 IST days | dataset design |
| provider-order-30 | date_mismatch | entity-30 | entity-30 | 85 | 50/25/0/10 | 4 | 137500/137500 | 2750/2750 | 495/495 | 0/0/[] | EXACT_ORDER_ID, EXACT_GROSS_AMOUNT, DATE_OUTSIDE_TOLERANCE, FORMULA_AGREES | ±3 IST days | dataset design |
| provider-order-71 | date_mismatch | entity-71 | entity-71 | 85 | 50/25/0/10 | 4 | 187500/187500 | 3750/3750 | 675/675 | 0/0/[] | EXACT_ORDER_ID, EXACT_GROSS_AMOUNT, DATE_OUTSIDE_TOLERANCE, FORMULA_AGREES | ±3 IST days | dataset design |
| SW-MISSING-phase6-held-out-seed-124 | duplicate_candidate | entity-75 | entity-74 | 50 | 0/25/15/10 | 1 | 192500/192500 | 3850/3850 | 693/693 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| SW-MISSING-phase6-held-out-seed-125 | duplicate_candidate | entity-90 | entity-90 | 50 | 0/25/15/10 | 1 | 212500/212500 | 4250/4250 | 765/765 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| SW-MISSING-phase6-held-out-seed-68 | duplicate_candidate | entity-145 | entity-144 | 50 | 0/25/15/10 | 1 | 280000/280000 | 5600/5600 | 1008/1008 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| SW-MISSING-phase6-held-out-seed-73 | duplicate_candidate | entity-137 | entity-136 | 50 | 0/25/15/10 | 1 | 270000/270000 | 5400/5400 | 972/972 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| provider-order-100 | fee_mismatch | entity-100 | entity-100 | 65 | 50/0/15/0 | 1 | 227500/225000 | 4550/4500 | 819/810 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-127 | fee_mismatch | entity-127 | entity-127 | 65 | 50/0/15/0 | 1 | 260000/257500 | 5200/5150 | 936/927 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-27 | fee_mismatch | entity-27 | entity-27 | 65 | 50/0/15/0 | 1 | 135000/132500 | 2700/2650 | 486/477 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-32 | fee_mismatch | entity-32 | entity-32 | 65 | 50/0/15/0 | 1 | 142500/140000 | 2850/2800 | 513/504 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| SW-MISSING-phase6-held-out-seed-100 | missing_reference | entity-53 | entity-52 | 50 | 0/25/15/10 | 1 | 165000/165000 | 3300/3300 | 594/594 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| SW-MISSING-phase6-held-out-seed-109 | missing_reference | entity-5 | entity-4 | 50 | 0/25/15/10 | 1 | 105000/105000 | 2100/2100 | 378/378 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| SW-MISSING-phase6-held-out-seed-144 | missing_reference | entity-96 | entity-96 | 50 | 0/25/15/10 | 1 | 220000/220000 | 4400/4400 | 792/792 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| SW-MISSING-phase6-held-out-seed-39 | missing_reference | entity-62 | entity-62 | 50 | 0/25/15/10 | 1 | 177500/177500 | 3550/3550 | 639/639 | 0/0/[] | MISSING_REFERENCE, EXACT_GROSS_AMOUNT, DATE_WITHIN_TOLERANCE, FORMULA_AGREES, AMBIGUOUS_CANDIDATES | ambiguity | intentional ambiguity rule |
| provider-order-40 | tax_mismatch | entity-40 | entity-40 | 65 | 50/0/15/0 | 1 | 152500/150000 | 3050/3000 | 549/540 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-46 | tax_mismatch | entity-46 | entity-46 | 65 | 50/0/15/0 | 1 | 160000/157500 | 3200/3150 | 576/567 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |
| provider-order-80 | tax_mismatch | entity-80 | entity-80 | 65 | 50/0/15/0 | 1 | 202500/200000 | 4050/4000 | 729/720 | 0/0/[] | EXACT_ORDER_ID, AMOUNT_MISMATCH, DATE_WITHIN_TOLERANCE, FEE_MISMATCH, TAX_MISMATCH | exact gross | dataset design |

## Root-cause distribution

- Implementation error: 0.
- Dataset design, exact-gross hard gate: 11 (4 amount, 4 fee, 3 tax).
- Dataset design, ±3-day IST hard gate: 4.
- Specification intentional ambiguity rule: 8 (4 duplicate-candidate, 4 missing-reference).

All 15 non-ambiguous false negatives selected the labelled expected settlement as the top candidate. They were blocked by explicit specification hard gates. The remaining eight were correctly withheld by ambiguity protection. No candidate lookup, identifier comparison, IST calculation, fee/GST calculation, refund aggregation, score addition, accidental hard-gate, or metric-denominator defect was found.

Meeting 90% recall while preserving the current labels, weights, thresholds and hard gates requires at least nine additional correct automatic matches (132/146 = 90.41%). The minimal dataset-distribution change is therefore to replace nine of the fifteen deliberately hard-gated matchable cases with cases that satisfy the existing exact-gross and ±3-day gates. This proposal is not applied.
