# SettleWise AI

Phases 0–2 of the verification-first finance controller: npm workspaces, React/Vite shell, Express ESM API, validated environment, SQLite migrations, one seeded bcrypt login, JWT cookie authentication, protected frontend routes, health check, SHA-256 audit chain, Razorpay Recon ingestion, atomic CSV fallback, and deterministic synthetic order generation.

## Setup

Copy `server/.env.example` to `server/.env` or provide its values in the environment. Generate a bcrypt hash by piping a password to `npm run password:hash --workspace server`; never commit the password or `.env`.

```sh
npm ci
npm run db:migrate --workspace server
npm run user:seed --workspace server
npm test
npm run build
```

Phases 0–2 are implemented. Reconciliation, review actions, AI explanations, and exports remain intentionally out of scope. `evaluation_truth` is stored separately for later held-out evaluation and is not exposed through API responses.
