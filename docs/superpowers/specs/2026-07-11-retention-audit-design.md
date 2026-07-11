# Sync-run Retention & Settings Audit — Design Spec

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Branch context:** `phase5`  
**Scope:** BB-LIFE-02 retention prune + DEV-10 / BB-LIFE-05 settings audit  
**Approach:** Domain retention rules + infra I/O + route-level audit (Approach 1)

## Goal

Prune old `bug_budget_sync_runs` on a daily schedule without dropping recent or active history, and write `audit_logs` rows (who, before/after) when Bug Budget settings are saved — including Jira connection with masked token.

## Non-goals

- Ops runbook / health endpoints / structured logging beyond error logs (follow-up)
- UI to browse audit history
- Transactional wrap of settings save + audit (best-effort audit this pass)
- Pruning `bug_budget` or `raw_jira_data` (BB-LIFE-01/03: retain)
- Auditing sync triggers, test-connection, or read-only GETs

## Decisions

| Topic | Choice |
|---|---|
| Bundle | Retention + audit together; runbook/health later |
| Credentials in audit | Non-secret connection fields + token always `****************` via `toPublicJiraConnection` |
| Audit write failure | Best-effort: log error, settings save still succeeds |
| Active sync runs | Never prune `queued` / `running` |
| Retention policy | Keep **union** of (created within last 180 days) ∪ (newest 500 by `created_at`); delete the rest if terminal |
| Architecture | Domain eligibility → infra delete + audit repo → daily Inngest job + settings route hooks |

## Architecture

```
Retention                          Audit
─────────                          ─────
domain: prune eligibility          (I/O only — no domain)
infra: SyncRunRepository.prune     infra: AuditLogRepository.write
jobs: retention-prune (daily)      web: settings POST routes
```

| Piece | Responsibility |
|---|---|
| `packages/domain/.../sync-run-retention.ts` | Pure: given `{ id, created_at, status }[]` + `now`, return ids to delete |
| `packages/infra` prune | Load lightweight rows, call domain, delete by id in batches |
| `packages/jobs/src/retention-prune.ts` | Inngest daily cron; register in `functions` |
| `packages/infra` `AuditLogRepository` | Insert into `audit_logs` |
| Settings POST routes | Read before → save → best-effort audit |

## Retention data flow

1. Job loads `id`, `created_at`, `status` from `bug_budget_sync_runs` (order by `created_at` desc).
2. Domain keep-set = IDs among newest **500** ∪ IDs with `created_at >= now - 180 days`.
3. Delete candidates = IDs not in keep-set whose status ∉ `{queued, running}`.
4. Infra deletes in batches (e.g. 200); returns `{ deleted, kept }`.
5. Fewer than 500 total runs → keep all (nothing outside keep-set).

**Cron:** daily at 03:00 Asia/Jakarta → Inngest expression `0 20 * * *` (UTC).

## Audit data flow

| Route | `entity_type` | `entity_key` | before/after payload |
|---|---|---|---|
| `save-multipliers` | `bug_budget_config` | `multipliers` | multiplier maps |
| `save-project-settings` | `bug_budget_config` | `project_settings` | budgets / mappings / excluded |
| `save-sync-query` | `bug_budget_config` | `sync_query` | sync query config |
| `cron-schedule` POST | `cron_schedules` | `bug_budget_sync` | schedule fields (no secrets) |
| `save-connection` | `settings` | `jira` | `toPublicJiraConnection` (masked token) |
| `confluence` POST | `settings` | `confluence` | `toPublicConfluenceSettings` |

- `action`: `update` (or `create` when no prior value exists).
- `user_id`: authenticated settings user from `requireAccessSettings`.
- Pattern: load before → mutate → `try { audit.write(...) } catch { console.error('[audit]', ...) }` → unchanged success response.
- Never persist raw Jira API token in `before_value` / `after_value`.

## Errors

| Case | Behavior |
|---|---|
| Audit insert fails | Log; settings HTTP success unchanged |
| Empty sync-run table | No-op prune `{ deleted: 0 }` |
| Delete batch fails mid-job | Step throws → Inngest retry; partial OK, next day continues |
| `queued`/`running` would match age/count | Domain excludes; never deleted |

## Testing

- Domain Vitest: >500 and older than 180d → prune; old but in newest 500 → keep; within 180d beyond 500th → keep; queued/running never pruned; small table keeps all.
- Jobs: `retentionPrune` registered; package typecheck.
- Audit: public connection payloads never contain raw token; `AuditLogRepository.write` shapes insert correctly (unit/mock as available).
- Optional smoke: save multipliers → `audit_logs` row; plant old terminal runs → prune deletes them.

## Files (expected)

| Path | Role |
|---|---|
| `packages/domain/src/sync/sync-run-retention.ts` | Pure prune eligibility |
| `packages/domain/src/sync/sync-run-retention.test.ts` | Unit tests |
| `packages/domain/src/index.ts` | Re-export |
| `packages/infra/.../sync-runs.repository.ts` | Load + batch delete |
| `packages/infra/.../audit-logs.repository.ts` | Write audit row |
| `packages/jobs/src/retention-prune.ts` | Daily Inngest function |
| `packages/jobs/src/index.ts` | Register function |
| Settings POST routes under `apps/web/app/api/settings/...` | Best-effort audit hooks |

## Done when

- [ ] Daily retention job registered and typechecks
- [ ] Domain retention tests green for BB-LIFE-02 policy + active-run guard
- [ ] Six settings POSTs write best-effort `audit_logs` with masked Jira token
- [ ] `@momus/domain`, `@momus/infra`, `@momus/jobs`, `@momus/web` typecheck

## Traceability

| Ref | Coverage |
|---|---|
| BB-LIFE-02 | 180d ∪ last 500 prune; scheduled job |
| BB-EDGE-13 | Unbounded sync-run growth mitigated |
| BB-LIFE-05 / DEV-10 | Settings changes → `audit_logs` |
| Phase 5 / M5 exit | Retention prunes; audit on settings save |
| Security | No raw token in audit payloads |
