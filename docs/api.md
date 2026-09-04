# Phase 0–3 API

- `GET /health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/audit-logs/verify`
- `POST /api/v1/batches`
- `GET /api/v1/batches/:batchId`
- `POST /api/v1/batches/:batchId/settlements/fetch`
- `POST /api/v1/batches/:batchId/settlements/upload`
- `POST /api/v1/batches/:batchId/orders/generate`
- `POST /api/v1/batches/:batchId/reconcile`

Responses use the specification's success and error envelopes.

The generator response includes counts and case distribution only. Hidden `evaluation_truth` rows have no API route and are never serialized.

Reconciliation is deterministic and returns measured status counts, metrics, denominators, and matching duration. AI providers do not participate in matching.
