# Weekly Digest — Real Weekly Content (WoW) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the digest so it reports the **last 7 days** with **week-over-week** deltas instead of all-time totals with month-over-month deltas, plus a current-state snapshot.

**Problem:** `runAnalyticsDigest` builds from `applyAnalyticsFilters(all, {}, now)` — empty params apply **no window**, so the digest aggregates the entire dataset ("Issues: 4685 total") and shows MoM deltas. Not weekly.

**Decisions (confirmed):** rolling 7-day windows (this = last 7 days ending now; prev = the 7 days before). Include a "right now" snapshot (open backlog, open Critical/Major, long-overdue).

**Architecture:** New domain computation over `created_date` / `resolved_date` / `is_open` (same fields as inflow/outflow) + a dedicated weekly text builder. The infra `runAnalyticsDigest` switches to them. Folds into `feat/analytics-digest-schedule-trigger`.

---

## Proposed message

```
*Momus weekly defect digest — 2026-07-25*
_Last 7 days vs previous 7 days (Asia/Jakarta)_
• Created: 42 (↑ +11% WoW)
• Resolved: 35 (↓ −13% WoW)
• Net this week: +7 — backlog 159 → 166
• Open now: 166 total · 47 Critical/Major · 91 long overdue
• Top squads (created this week): AL (12), AO (8), XTEAM (5)
Open the dashboard: <url>
```

---

## File map

| Path | Role |
|---|---|
| `packages/domain/src/analytics/weekly-digest.ts` (new) | `computeWeeklyDigest(rows, nowIso)` + `AnalyticsWeeklyDigest` type |
| `packages/domain/src/analytics/weekly-digest.test.ts` (new) | Window/WoW/backlog/snapshot cases |
| `packages/domain/src/analytics/digest.ts` | New `buildWeeklyDigest(data, options)` text builder (keep `linkStyle`) |
| `packages/domain/src/analytics/digest.test.ts` | Weekly builder text cases |
| `packages/domain/src/index.ts` | Re-export |
| `packages/infra/src/analytics/digest-runner.ts` | Use `computeWeeklyDigest` + `buildWeeklyDigest` |

---

### Task 1: Domain — weekly computation + builder

- [ ] `computeWeeklyDigest(rows, nowIso)` (rolling windows by instant, `Date.parse`): `this_week`/`prev_week` `{ created, resolved, net }`; `backlog_now` (open now) and `backlog_prev` (open as of 7 days ago); `open_critical_major` + `open_long_overdue` (current snapshot); `top_squads` created this week (reuse the `real_project ?? project` key), plus the window range.
- [ ] `buildWeeklyDigest(data, { dateLabel, dashboardUrl, linkStyle })` — the message above; WoW percent via a shared helper (`n/a` when prev is 0); provider-aware link (reuse the existing `linkStyle` logic).
- [ ] Tests: created/resolved counted in the right window; resolved excludes open rows; `net` and `backlog_now − backlog_prev` reconcile; WoW percent + zero-prev guard; top-squads ordering; empty-scope safe.
- [ ] Commit `feat(domain): weekly (WoW) digest computation and builder`

### Task 2: Infra — runner uses weekly content

- [ ] Switch `runAnalyticsDigest` to `computeWeeklyDigest` + `buildWeeklyDigest` (drop the all-time summary/trends path). Keep provider linkStyle + dashboardUrl. Snapshot risk (Critical/Major, long-overdue) computed inside the weekly computation so the runner stays thin.
- [ ] Commit `feat(infra): weekly digest runner uses last-7-days content`

### Task 3: Verify

- [ ] `pnpm --filter @momus/domain test && pnpm --filter @momus/infra test`; typecheck (domain/infra/jobs/web); `pnpm --filter web build`.
- [ ] Real send: click **Send digest now** (Google Chat) → confirm the message shows last-7-days created/resolved/net with WoW deltas + snapshot, not all-time totals.

### Task 4: PR

- [ ] Combined PR for the digest branch (manual trigger + configurable schedule + weekly content). Test plan + before/after digest screenshots.

---

## Execution

Domain-first (compute + builder + tests), then the runner swap, then verify with a real Google Chat send. Prefer inline execution in this session.
