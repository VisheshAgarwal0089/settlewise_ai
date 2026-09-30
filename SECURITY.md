# Security Policy

## Supported version

Security fixes currently target the latest version on the `main` branch.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue.

Use GitHub's private vulnerability reporting feature if enabled. If it is unavailable, contact the repository owner through the GitHub profile.

A useful report should include:

- affected endpoint, module, or workflow
- reproduction steps
- expected vs. actual behavior
- potential security impact
- suggested mitigation, if known

## Security boundaries

SettleWise AI is a synthetic single-merchant demonstration and must not be treated as a production financial system.

The repository intentionally keeps sensitive runtime values out of source control:

- JWT secrets
- password hashes
- provider credentials
- API keys
- runtime SQLite databases
- uploaded data
- environment files other than documented examples

The server remains authoritative for reconciliation state, metrics, and financial calculations. Optional AI-generated explanations are advisory only and cannot change links, scores, amounts, statuses, or metrics.

## Deployment hygiene

For any deployment:

- use unique production secrets
- keep provider credentials server-side
- restrict the permitted client origin
- use HTTPS
- keep runtime databases and uploads outside source control
- review dependency and security updates
- rotate credentials immediately if accidental exposure is suspected
