# SettleWise AI

Phases 0–4 of the verification-first finance controller: npm workspaces, React/Vite shell, Express ESM API, validated environment, SQLite migrations, one seeded bcrypt login, JWT cookie authentication, protected frontend routes, health check, SHA-256 audit chain, Razorpay Recon ingestion, atomic CSV fallback, deterministic synthetic order generation and reconciliation, transactional human review, advisory Groq explanations, safe CSV export, and exact-confirmation reset.

## Setup

Copy `server/.env.example` to `server/.env` or provide its values in the environment. Generate a bcrypt hash by piping a password to `npm run password:hash --workspace server`; never commit the password or `.env`.

```sh
npm ci
npm run db:migrate --workspace server
npm run user:seed --workspace server
npm test
npm run build
```

Phases 0–4 are implemented. Frontend workflows and deployment remain for later phases. `evaluation_truth` is queried only by the separate metrics function after matching and is never passed to matching or explanation functions or exposed through API responses. Groq uses the environment-configured `GROQ_MODEL` (default `openai/gpt-oss-20b`) and can only write separate advisory explanation records.
