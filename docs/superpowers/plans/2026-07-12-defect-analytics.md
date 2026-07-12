# Defect Analytics (Momus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the full Momus Defect Analytics module (M1–M5) by extending the existing domain/API/UI MVP.

**Architecture:** Pure rules in `packages/domain/src/analytics/*`; Next API in `apps/web/app/api/analytics/*`; UI on homepage dashboard components. Momus `bug_budget` only; Asia/Jakarta; `issue_type` for Analytics scope.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Supabase (read via existing repo).

**Spec:** `docs/superpowers/specs/2026-07-12-defect-analytics-design.md`

---

## File map

| Path | Role |
|---|---|
| `packages/domain/src/analytics/types.ts` | Filter/result types |
| `packages/domain/src/analytics/filter.ts` | Window + filters |
| `packages/domain/src/analytics/trends.ts` | Grain trends |
| `packages/domain/src/analytics/period-detail.ts` | Drill-down matrices (new) |
| `packages/domain/src/analytics/thresholds.ts` | KPI threshold helpers (new) |
| `packages/domain/src/index.ts` | Re-exports |
| `apps/web/app/api/analytics/route.ts` | Main API |
| `apps/web/app/api/analytics/period-detail/route.ts` | Lazy detail (new) |
| `apps/web/lib/analytics-params.ts` | URL ↔ params |
| `apps/web/components/analytics/*` | Dashboard UI |

---

### Task 1: M1 — Freeze types + contract tests

**Files:**
- Modify: `packages/domain/src/analytics/types.ts`
- Modify: `packages/domain/src/analytics/filter.test.ts`
- Create: `packages/domain/src/analytics/contract.test.ts` (optional co-locate)

- [ ] **Step 1:** Extend `AnalyticsFilterParams` and add stub types for grain + period detail (no behavior yet for unused fields).
- [ ] **Step 2:** Add failing tests for: default 24‑mo window edge, bugs vs defects via `issue_type` preferred over `final_issue_type` when both set, `in-progress` status_category, resolved/closed ≡ `!is_open`.
- [ ] **Step 3:** Minimal filter tweaks if tests fail on preferred `issue_type`.
- [ ] **Step 4:** `pnpm --filter @momus/domain test`
- [ ] **Step 5:** Commit `test(analytics): M1 contract fixtures and extended filter types`

### Task 2: M2 — Advanced filters + multi-grain trends + period detail

**Files:** `filter.ts`, `trends.ts`, new `period-detail.ts`, tests

- [ ] Implement advanced filters (severity, ac_related, priority/no-priority, date_from/to).
- [ ] `computeTrends(rows, grain, nowIso)`.
- [ ] `computePeriodDetail(...)`.
- [ ] Commit `feat(domain): analytics advanced filters, grains, period detail`

### Task 3: M3 — API

**Files:** `api/analytics/route.ts`, `period-detail/route.ts`, `analytics-params.ts`, optional cache

- [ ] Wire query params; return grain trends; period-detail route.
- [ ] Optional TTL / cache_versions bump on sync (if cheap).
- [ ] Commit `feat(web): analytics API grain and period-detail`

### Task 4: M4 — Filters UI

**Files:** `analytics-filters.tsx`, `defect-analytics-dashboard.tsx`, params helpers

- [ ] Grain switcher + advanced panel + URL sync.
- [ ] Commit `feat(web): analytics advanced filters UI`

### Task 5: M5 — Chart drill-down + thresholds

**Files:** `summary-cards.tsx`, `trend-chart.tsx`, dashboard, `thresholds.ts`

- [ ] Threshold tones; period-detail fetch on chart interaction; matrices panel.
- [ ] Commit `feat(web): analytics drill-down and KPI thresholds`

### Task 6: PR

- [ ] Push `feat/defect-analytics`, open PR with M1–M5 summary + test plan.

---

## Execution

Start Task 1 immediately after this plan is saved. Prefer inline execution in this session.
