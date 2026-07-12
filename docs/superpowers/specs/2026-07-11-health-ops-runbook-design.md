# Health Endpoints & Ops Runbook — Design Spec

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Branch:** `chore/health-ops-runbook` (off `master`; short PR independent of Phase 5 stack where possible)  
**Scope:** `GET /api/health` (keep/harden), `GET /api/health/worker`, `docs/ops/runbook.md`, README links  
**Approach:** Thin routes + shared helpers (Approach 1)

## Goal

Document and expose operability checks for web, DB, and background sync worker so AC-6/AC-9 ops story and plan §14 health matrix are satisfied without coupling to Inngest’s external API.

## Non-goals

- Inngest HTTP/dashboard API probe
- Upstash/Redis ping
- Structured logging overhaul
- DEV-9 Vault
- Health UI / dashboard
- Auth-gated health (must stay public for uptime probes)

## Decisions

| Topic | Choice |
|---|---|
| Worker depth | Env flags (`INNGEST_EVENT_KEY` / signing key presence) + latest `bug_budget_sync_runs` summary from DB |
| Auth | Public; middleware allows health paths when signed-out; never return raw secrets |
| Runbook | `docs/ops/runbook.md` + README link (not expand plan.md as living ops) |
| HTTP status | App health: 200 iff DB probe ok, else 503. Worker: 200 if env configured and DB readable; stuck/active runs are reported fields, not automatic 503 |

## Architecture

```
Uptime probe ──► GET /api/health          ──► momus_health_check RPC + masked Jira settings
Uptime / ops ──► GET /api/health/worker   ──► env flags + latest sync-run row
On-call      ──► docs/ops/runbook.md
```

| Piece | Responsibility |
|---|---|
| `apps/web/app/api/health/route.ts` | Existing app health; keep contract; ensure no raw token |
| `apps/web/app/api/health/worker/route.ts` | Worker/env + last sync activity |
| `apps/web/lib/health.ts` | Shared helpers: Inngest env check, last sync-run snapshot |
| `apps/web/middleware.ts` | Bypass signed-out 401 for `/api/health` and `/api/health/worker` |
| `docs/ops/runbook.md` | Components, health URLs, common ops, alerts, stuck runs, token rotate |
| `README.md` | Link runbook + health URLs |

## Data flow

### `GET /api/health`

Response shape (existing, preserved):

```json
{
  "status": "healthy" | "degraded",
  "service": "momus",
  "version": "0.0.0",
  "checks": {
    "app": "ok",
    "database": "ok" | "degraded" | "error: …",
    "settings_reachable": true,
    "bug_budget_config_count": 0,
    "bug_budget_table": true,
    "jira_url": "…",
    "jira_enabled": true,
    "jira_username_set": true,
    "jira_token": "****************"
  },
  "timestamp": "ISO-8601"
}
```

- DB via `momus_health_check` RPC (already migrated).
- Jira via `getJiraSettings` + `maskJiraToken` / public fields only.

### `GET /api/health/worker`

```json
{
  "status": "healthy" | "degraded",
  "service": "momus-worker",
  "checks": {
    "inngest_event_key": true,
    "inngest_signing_key": true,
    "sync_inline_fallback": false,
    "database": "ok",
    "latest_sync_run": {
      "id": 1,
      "status": "completed",
      "created_at": "…",
      "started_at": "…",
      "completed_at": "…",
      "error_message": null
    }
  },
  "timestamp": "ISO-8601"
}
```

- `inngest_event_key` / `inngest_signing_key`: boolean presence only (never echo values).
- `sync_inline_fallback`: `SYNC_INLINE_AFTER_RESPONSE === 'true'` (informational).
- `latest_sync_run`: newest row by `created_at` (or null if none).
- Degraded (503) when DB unreachable **or** neither Inngest event key nor inline fallback is configured (no way to run sync workers).

## Errors

| Case | Behavior |
|---|---|
| DB RPC fails | `/api/health` → degraded 503 |
| Jira settings load fails | Field error string; does not alone force 503 if DB ok |
| No sync runs yet | `latest_sync_run: null`; still healthy if env OK |
| Signed-out cookie | Health routes still 200/503 (middleware allowlist) |

## Runbook contents (`docs/ops/runbook.md`)

Expand plan §14 into actionable Momus docs:

1. Required components + health URLs  
2. Common operations (manual sync, full recon JQL, stuck runs, rotate token, holidays, rollback)  
3. Monitoring alert suggestions  
4. Pointers to Inngest functions: sync, stuck sweeper, scheduler tick, retention prune (document as deployed once Phase 5 is live)  
5. Env vars needed for workers (`INNGEST_EVENT_KEY`, signing key, optional inline)

## Testing / done when

- [ ] `/api/health` still returns masked token; typecheck green  
- [ ] `/api/health/worker` returns env booleans + latest run; 503 when misconfigured  
- [ ] Middleware allowlists both paths  
- [ ] `docs/ops/runbook.md` exists; README links it  
- [ ] No secrets in responses or runbook examples  

## Traceability

| Ref | Coverage |
|---|---|
| BB-NFR-05 | Documented health checks for web + worker |
| Plan §14 | Runbook + health matrix |
| AC-6 / AC-9 ops story | Operability endpoints + runbook |
| Security | Public probes; masked/absent secrets |
