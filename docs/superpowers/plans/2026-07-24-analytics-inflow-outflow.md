# Analytics Inflow/Outflow (Net-Flow & Backlog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inflow/outflow lens to the Defect Analytics dashboard — bugs *created* vs *resolved* per period, their net, and the resulting open backlog over time — so the homepage answers "is the backlog growing or shrinking?".

**Architecture:** Pure rules extend the existing per-period loop in `packages/domain/src/analytics/trends.ts`; the main analytics API already returns `trends`, so new arrays flow through with no route logic change; a new chart component renders under the existing trend chart on the homepage dashboard. Momus `bug_budget` only; Asia/Jakarta; respects all existing filters + grain (month/quarter/year).

**Tech Stack:** TypeScript, Vitest, Next.js App Router, chart.js (already a dependency), Supabase (read via existing repo).

**Spec:** Realizes the "inflow/outflow" lens listed as out-of-scope in `docs/superpowers/specs/2026-07-13-analytics-risk-panel-design.md`; extends `docs/superpowers/specs/2026-07-12-defect-analytics-design.md`.

**Branch:** `feat/analytics-inflow-outflow`

---

## Definitions

Per period (bucketed on the existing month/quarter/year grain):

| Metric | Definition | Source field |
|---|---|---|
| **Inflow** (created) | issues whose `created_date` falls in the period | `created_date` |
| **Outflow** (resolved) | issues whose `resolved_date` falls in the period (open rows excluded) | `resolved_date`, `is_open` |
| **Net** | `inflow − outflow` (positive = backlog grew) | derived |
| **Backlog** | open count at period end = created on/before period end AND (still open OR resolved after period end) | derived |

Notes:
- `inflow` equals the existing `total[]` array (which already buckets by `created_date`), but is emitted explicitly to decouple the chart from that coincidence.
- The period range must span **first created period → now** so late resolutions (resolved after the last *created* period but ≤ now) are still counted in outflow. Today `computeTrends` ends at `min(lastCreatedKey, nowKey)`; extend `end` to also cover the last resolved key ≤ `nowKey`.
- Backlog is computed as a true open-at-period-end count (O(periods × rows), fine at current data volume), **not** a naive cumulative sum of net — that avoids drift from issues created before the window.

---

## File map

| Path | Role |
|---|---|
| `packages/domain/src/analytics/types.ts` | Add `created?`, `resolved?`, `net?`, `backlog?` to `AnalyticsTrendsResult` |
| `packages/domain/src/analytics/trends.ts` | Emit the four new arrays from the period loop |
| `packages/domain/src/analytics/trends.test.ts` | New cases (inflow/outflow/net/backlog, open-row exclusion, late resolve) |
| `packages/domain/src/analytics/contract.test.ts` | Update frozen-shape assertions |
| `apps/web/app/api/analytics/route.ts` | No logic change — verify payload carries new arrays |
| `apps/web/components/analytics/inflow-outflow-chart.tsx` | New chart component (create) |
| `apps/web/components/analytics/defect-analytics-dashboard.tsx` | Mount new chart under `TrendChart` |
| `packages/domain/src/analytics/csv.ts` | (Optional) add created/resolved/net/backlog columns to trend CSV |

---

### Task 1: Domain — compute inflow/outflow/net/backlog

**Files:**
- Modify: `packages/domain/src/analytics/types.ts`
- Modify: `packages/domain/src/analytics/trends.ts`
- Modify: `packages/domain/src/analytics/trends.test.ts`

- [ ] **Step 1:** Extend `AnalyticsTrendsResult` with optional parallel arrays `created?: number[]`, `resolved?: number[]`, `net?: number[]`, `backlog?: number[]` (keeps the shape backward-compatible).
- [ ] **Step 2:** In `computeTrends`, widen the loop `end` to `max(min(lastCreatedKey, nowKey), lastResolvedKey ≤ nowKey)` so outflow periods are covered.
- [ ] **Step 3:** In the period loop, compute `created` (= bucket length), `resolved` (rows with `resolved_date` in period and `!is_open`), `net = created − resolved`, and `backlog` (open-at-period-end count).
- [ ] **Step 4:** Add failing-first Vitest cases: multi-grain flow, open rows excluded from outflow, an issue resolved in a later period than created, backlog non-negative and matching hand-computed fixture, empty-window returns empty arrays.
- [ ] **Step 5:** `pnpm --filter @momus/domain test`
- [ ] **Step 6:** Commit `feat(domain): analytics inflow/outflow/net/backlog trend arrays`

### Task 2: API + contract

**Files:** `apps/web/app/api/analytics/route.ts`, `packages/domain/src/analytics/contract.test.ts`, (optional) `csv.ts`

- [ ] Confirm `/api/analytics` returns the new arrays inside `trends` (they pass through `computeTrends` automatically); no new params.
- [ ] Update `contract.test.ts` frozen-shape assertions to include the optional arrays.
- [ ] (Optional) Add created/resolved/net/backlog columns to the analytics trend CSV export.
- [ ] Commit `test(analytics): extend trends contract for flow arrays`

### Task 3: UI — Inflow/Outflow chart on homepage

**Files:** `apps/web/components/analytics/inflow-outflow-chart.tsx` (new), `defect-analytics-dashboard.tsx`

- [ ] Build `InflowOutflowChart`: grouped/overlaid bars for Created (inflow) vs Resolved (outflow), a **Net** line, and a **Backlog** line on a secondary y-axis. Reuse chart.js + the existing `period_keys`/`labels`, loading skeleton, and PNG-download pattern from `trend-chart.tsx`.
- [ ] Mount it in `defect-analytics-dashboard.tsx` in its own `bb-analytics-chart-card` section directly below the existing Trends chart; feed it `data?.trends`, `loading`, and (optionally) the same `onPeriodSelect` for drill-down parity.
- [ ] Empty/negative-net states styled; respects current filters + grain since it reads the same `trends` payload.
- [ ] Commit `feat(web): inflow/outflow net-flow & backlog chart on analytics homepage`

### Task 4: Verify

- [ ] `pnpm --filter @momus/domain test`
- [ ] `pnpm lint && pnpm typecheck`
- [ ] `pnpm --filter web build`
- [ ] Manual: load homepage, toggle grain (month/quarter/year) and a project filter, confirm inflow/outflow/net/backlog update and backlog reconciles with the open count in the summary cards.

### Task 5: PR

- [ ] Push `feat/analytics-inflow-outflow`; open PR with before/after screenshots + test plan; reference this plan and the risk-panel spec's out-of-scope note.

---

## Execution

Start Task 1 after this plan is saved. Domain-first (pure functions + tests), then API/contract, then UI. Prefer inline execution in this session.
