# SettleWise AI

Phase 0 and Phase 1 of the verification-first finance controller: npm workspaces, React/Vite shell, Express ESM API, validated environment, SQLite migrations, one seeded bcrypt login, JWT cookie authentication, protected frontend routes, health check, and SHA-256 audit chain.

## Setup

Copy `server/.env.example` to `server/.env` or provide its values in the environment. Generate a bcrypt hash by piping a password to `npm run password:hash --workspace server`; never commit the password or `.env`.

```sh
npm ci
npm run db:migrate --workspace server
npm run user:seed --workspace server
npm test
npm run build
```

Only Phases 0–1 are implemented. Ingestion, generation, reconciliation, review actions, AI explanations, and exports remain intentionally out of scope for this phase.

