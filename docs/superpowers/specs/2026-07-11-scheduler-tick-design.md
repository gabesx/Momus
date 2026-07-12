# Scheduler Tick (BB-SCHED-01/02) — Design Spec

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Branch context:** `phase5`  
**Scope:** Minutely Inngest scheduler tick + Jakarta-correct `next_run_at`

## Goal

Automatically fire Bug Budget Jira sync when an active `cron_schedules` row is due (`next_run_at <= now`), reusing the existing Inngest `bug-budget/sync` worker, and keep `next_run_at` / `last_run_*` accurate in Asia/Jakarta.

## Non-goals

- Sync-run retention prune (BB-LIFE-02)
- Settings `audit_logs` (DEV-10)
- Dedicated 1h DB lock column
- Ops runbook (§14)
- Updating `last_run_status` from completed sync outcome (post-run callback) — tick records “triggered/queued” only

## Decisions

| Topic | Choice |
|---|---|
| Completeness | Core tick + Jakarta `computeNextRunAt` |
| Architecture | Inngest minutely cron → enqueue existing sync event |
| Overlap | Skip if sync already queued/running |
| Automated actor | System user `automated@system` |

## Architecture

```
Inngest cron (* * * * *)
        │
        ▼
scheduler-tick
        │  list due cron_schedules (is_active ∧ next_run_at ≤ now)
        ▼
overlap? findActive sync ──yes──► skip schedule
        │ no
        ▼
create sync run (command_params + automated@system)
        │
        ▼
inngest.send(bug-budget/sync)
        │
        ▼
markCronTriggered: last_run_* + next_run_at (Jakarta)
```

Existing pieces reused:
- `SyncRunRepository`, `EVENT_BUG_BUDGET_SYNC`, `syncBugBudget` worker
- Settings GET/POST `/api/settings/bug-budget/cron-schedule` (save already sets `next_run_at`)

## Data flow

1. **Due query** — `cron_schedules` with `is_active` and `next_run_at <= now()`. Prefer rows with `command = 'bug-budget:sync'` / name `bug_budget_sync`.
2. **Overlap guard** — if `findActive()` returns queued/running → skip (no new run).
3. **Params** — from `command_params`: `{ jql, batch_size, max_total_issues }`; JQL falls back to default Bug Budget JQL when null/empty; batch default 50; max_total default 0.
4. **Sync run** — `requested_by` = id of `automated@system` (ensure user exists: seed or lazy create, non-candidate); label `automated@system`.
5. **Enqueue** — `inngest.send({ name: EVENT_BUG_BUDGET_SYNC, data: { syncRunId, requestedByLabel, requestedById } })`.
6. **Schedule update (after dispatch)** —
   - `last_run_at = now`
   - `last_run_status = 'queued'` (or `'triggered'`)
   - `last_run_result = 'Triggered sync run #{id}'`
   - `next_run_at = computeNextRunAtJakarta(schedule fields, from: now)`

## Jakarta `computeNextRunAt`

- Pure domain helper (`packages/domain`) with unit tests.
- Timezone: Asia/Jakarta.
- Supports `daily` | `weekly` | `monthly` | `custom` using existing fields: `time` (HH:MM), `day_of_week`, `day_of_month`, `interval_days`.
- Infra `saveCronSchedule` and the tick both call this helper (replace simplified local-time implementation).

## Errors

- Per-schedule try/catch inside the tick; one failure must not abort other due schedules.
- Log failures with schedule name / id; do not leave `next_run_at` stuck in the past without attempt logging (on hard failure before dispatch, leave due for next minute retry unless permanently invalid).

## Files

| Path | Role |
|---|---|
| `packages/domain/src/schedule/next-run-at.ts` | Jakarta next-run math |
| `packages/domain/src/schedule/next-run-at.test.ts` | Unit tests |
| `packages/infra/.../config.ts` | Use domain helper; due-list + mark triggered helpers |
| `packages/jobs/src/scheduler-tick.ts` | Minutely Inngest function |
| `packages/jobs/src/index.ts` | Register function |
| Seed/migration or infra ensure | `automated@system` user |

## Done when

- [ ] Active due schedule creates sync run + enqueues `bug-budget/sync`
- [ ] Overlap skip when sync already active
- [ ] `next_run_at` and `last_run_*` updated after trigger
- [ ] Settings save uses Jakarta `computeNextRunAt`
- [ ] Domain tests for next-run cases; packages typecheck

## Traceability

| Ref | Coverage |
|---|---|
| BB-SCHED-01 | Minutely tick, due rows, dispatch sync, recompute next |
| BB-SCHED-02 | Inngest-based replacement for legacy tick + queue worker |
| BB-DATA-04 | `bug_budget_sync` row + `command_params` |
| Phase 5 plan | Scheduler tick + next_run_at on save (Jakarta fix) |
