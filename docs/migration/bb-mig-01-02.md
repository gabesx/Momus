# BB-MIG-01/02 — Bulk copy & reconciliation

Copy legacy QARATMS MySQL → Momus Postgres, then verify parity.

## Connection (local docker)

| | Value |
|---|---|
| Legacy | `127.0.0.1:3307`, database/user `qara` (not host `.env` `tms`/`3309`) |
| Target | `postgresql://postgres:postgres@127.0.0.1:54422/postgres` |
| QARATMS | http://localhost/performance |

```bash
export LEGACY_MYSQL_PASSWORD=qarapass
# optional overrides:
# export LEGACY_MYSQL_HOST=127.0.0.1 LEGACY_MYSQL_PORT=3307
# export LEGACY_MYSQL_DATABASE=qara LEGACY_MYSQL_USER=qara
# export TARGET_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54422/postgres

pnpm install
pnpm --filter @momus/migration copy -- --dry-run
pnpm --filter @momus/migration copy -- --truncate-target
pnpm --filter @momus/migration reconcile
```

`--truncate-target` is required for copy (refuses otherwise).

## Checks (BB-MIG-02)

- `COUNT(*)` legacy vs target
- Per-year counts
- SHA-256 over sorted `(jira_key, updated_date, is_open)`
- PRD §11.1 baseline compared informationally (4653 / years)
