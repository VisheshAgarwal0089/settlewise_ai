# SettleWise AI

Phases 0–3 of the verification-first finance controller: npm workspaces, React/Vite shell, Express ESM API, validated environment, SQLite migrations, one seeded bcrypt login, JWT cookie authentication, protected frontend routes, health check, SHA-256 audit chain, Razorpay Recon ingestion, atomic CSV fallback, deterministic synthetic order generation, and deterministic reconciliation with measured ground-truth metrics.

## Setup

Copy `server/.env.example` to `server/.env` or provide its values in the environment. Generate a bcrypt hash by piping a password to `npm run password:hash --workspace server`; never commit the password or `.env`.

```sh
npm ci
npm run db:migrate --workspace server
npm run user:seed --workspace server
npm test
npm run build
```

Phases 0–3 are implemented. Review actions, AI explanations, and exports remain intentionally out of scope. `evaluation_truth` is queried only by the separate metrics function after matching and is never passed to matching functions or exposed through API responses. Groq does not participate in reconciliation.
