# Momus Operations Runbook

Living ops guide for Bug Budget (Momus). Planning summary also lives in `plan.md` §14; **this file is the on-call source of truth**.

## 1. Required components

| Component | Platform | Health check |
|---|---|---|
| Web app | Vercel / Next.js | `GET /api/health` |
| Database | Supabase Postgres | Included in `/api/health` via `momus_health_check` RPC |
| Background worker | Inngest | Inngest dashboard + `GET /api/health/worker` |
| Scheduler tick | Inngest cron `* * * * *` | Function id `bug-budget-scheduler-tick` (Phase 5) |
| Retention prune | Inngest cron `0 20 * * *` UTC | Function id `bug-budget-retention-prune` (Phase 5) |
| Stuck-run sweeper | Inngest cron `*/15 * * * *` | Function id `bug-budget-stuck-run-sweeper` |

Local URLs:

- App health: http://localhost:3000/api/health
- Worker health: http://localhost:3000/api/health/worker

Both endpoints are **public** (usable by uptime probes). Responses must never include raw Jira API tokens (`jira_token` is masked as `****************` when present).

### Worker health semantics

`GET /api/health/worker` reports:

- Boolean presence of `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` (values never echoed)
- Whether `SYNC_INLINE_AFTER_RESPONSE=true` (dev inline fallback)
- Latest `bug_budget_sync_runs` row summary (`id`, `status`, timestamps, `error_message`)

Returns **503** if the database is unreachable **or** neither Inngest event key nor inline fallback is configured. A `queued`/`running` sync is informational — it does not alone force 503.

## 2. Common operations

| Operation | Action |
|---|---|
| Manual sync | Settings → Sync with Database (requires `access_settings`) |
| Full reconciliation sync | Use JQL **without** a date filter (BB-EDGE-01 project-move cleanup) |
| Check stuck runs | Sweeper auto-marks `running` older than 2× job timeout; manual SQL: `status = 'running' AND started_at < now() - interval '40 minutes'` |
| Rotate Jira token | Settings → connection → update token (masked placeholder keeps stored secret) |
| Add holiday | Insert into `indonesian_holidays` (admin / SQL) |
| Rollback | DNS/route flip to legacy; re-point downstream consumers |

### Useful SQL

```sql
-- Active / stuck sync runs
SELECT id, status, started_at, error_message
FROM bug_budget_sync_runs
WHERE status IN ('queued', 'running')
ORDER BY created_at DESC;

-- Recent terminal runs
SELECT id, status, created_at, completed_at, error_message
FROM bug_budget_sync_runs
WHERE status IN ('completed', 'failed')
ORDER BY created_at DESC
LIMIT 20;
```

## 3. Monitoring alerts (suggested)

- Sync failure rate > 2 in 24h
- Stuck run detected (`running` beyond sweeper threshold)
- Jira 429 rate spike
- Dashboard p95 > 1.5s
- DB connection errors / `/api/health` degraded
- `/api/health/worker` degraded (missing worker config)

## 4. Inngest function registry

| Id | Trigger | Purpose |
|---|---|---|
| `bug-budget-sync` | Event `bug-budget/sync` | Execute sync run |
| `bug-budget-stuck-run-sweeper` | `*/15 * * * *` | Mark stuck runs failed (BB-NFR-05) |
| `bug-budget-scheduler-tick` | `* * * * *` | Fire due cron schedules (BB-SCHED-01) |
| `bug-budget-retention-prune` | `0 20 * * *` | Prune old sync runs (BB-LIFE-02) |

Serve functions via `apps/web/app/api/inngest/route.ts`.

## 5. Environment

| Variable | Purpose |
|---|---|
| `INNGEST_EVENT_KEY` | Send events / enqueue sync |
| `INNGEST_SIGNING_KEY` | Verify Inngest webhooks |
| `SYNC_INLINE_AFTER_RESPONSE` | Dev-only inline worker when set to `true` |
| Supabase URL + service role | Server routes and health DB probes |

Never commit real tokens. Prefer Vault (DEV-9) once available; until then treat `settings.jira_api_token` as secret.

### Wire Inngest on Vercel (Momus)

App serve path is already public: `https://momus.vercel.app/api/inngest` (`apps/web/app/api/inngest/route.ts`, middleware allowlist).

1. Open [Inngest for Vercel](https://vercel.com/marketplace/inngest) → **Install** / **Connect Account**.
2. Sign in to Inngest (or create an account) and select the Vercel project **`momus`** (`prj_H8LDfC9MnWsDrRBROCcd7eiynksj`).
3. Confirm Vercel env now has **`INNGEST_EVENT_KEY`** and **`INNGEST_SIGNING_KEY`** for Production (+ Preview if desired).
4. If Deployment Protection is on: enable **Protection Bypass for Automation** on the Vercel project, copy the secret into Inngest → Integrations → Vercel → Deployment protection key, then **redeploy**.
5. Redeploy Momus (or wait for the next git push) so the new env vars land on the runtime.
6. Verify: `GET https://momus.vercel.app/api/health/worker` shows `inngest_event_key: true`, `inngest_signing_key: true`, `status: "healthy"`.
7. Trigger Settings → Sync; run should enqueue (`queued`) instead of failing with “No sync worker available”.

Local fallback (not for production): leave keys unset and run `next dev` — `shouldRunInlineSync` auto-inlines when `NODE_ENV !== 'production'`.

## 6. Related docs

- Spec: `docs/superpowers/specs/2026-07-11-health-ops-runbook-design.md`
- Plan §14: `plan.md`
- Phase 5 scheduler / retention: `docs/superpowers/specs/2026-07-11-scheduler-tick-design.md`, `docs/superpowers/specs/2026-07-11-retention-audit-design.md`
