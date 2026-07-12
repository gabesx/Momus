# Defect Analytics (Momus) — Design

**Date:** 2026-07-12  
**Status:** Awaiting review  
**Approach:** Extend existing Momus analytics MVP (`packages/domain` + `/api/analytics` + homepage dashboard)  
**Scope:** Milestones M1–M5 (full Analytics module). Tracker / Leaderboard are later epics.

## North star

QA leads use Momus Defect Analytics to see how bugs and defects are trending, where age/risk is rising, and which filters isolate the problem — all from Momus `bug_budget` data only.

## Current baseline

| Layer | Exists |
|---|---|
| Domain | `packages/domain/src/analytics/*` — filters, summary MoM, monthly trends |
| API | `GET /api/analytics` — summary + monthly trends + filter options |
| UI | Homepage `DefectAnalyticsDashboard` — year/type/project/status, KPI cards, monthly chart |

## Product rules (Momus)

1. **Issue scope** — Analytics uses `issue_type` (bugs = Bug; defects = Defect / Defect Sub-task / Defect Task). Do not use Bug Budget’s `final_issue_type` for Analytics grouping.
2. **Timezone** — Asia/Jakarta for month/quarter/year buckets and default windows.
3. **Default window** — When year is unset/`all`, last **24** calendar months (inclusive).
4. **Status buckets** — Prefer clear Momus rules: `open` → `is_open`; `resolved`/`closed` → `!is_open` (closed may alias resolved for UI); `in-progress` → open issues whose `status_category` indicates in-progress when present, else open non-todo heuristics. Document exact rule in M1 fixtures.
5. **KPI thresholds** (configurables in `bug_budget_config` or constants): open warning ≥ 100; avg age warning ≥ 30 days; resolution rate healthy ≥ 70%.
6. **Caching** — Optional TTL cache for trend/period-detail; invalidate (or bump version) when Bug Budget sync completes successfully.

## Milestones

### M1 — Contract + fixtures
- Expand Vitest coverage for summary MoM, issue-type scope, 24‑month window, status buckets.
- Freeze types for advanced filter params and period-detail result shapes (even if not implemented yet).

### M2 — Domain aggregations
- Extend `AnalyticsFilterParams`: `severity`, `ac_related`, `priority` (+ no-priority), `date_from` / `date_to`, `trend_grain` (`month` \| `quarter` \| `year`), optional `quarter`.
- `applyAnalyticsFilters` implements advanced filters.
- `computeTrends(rows, grain, nowIso)` generalizes monthly → quarter/year.
- `computePeriodDetail(rows, periodKey, grain)` → severity×priority and severity×AC matrices + counts.

### M3 — API
- `GET /api/analytics` accepts new query params; returns `trends` for selected grain; optional `sections`.
- `GET /api/analytics/period-detail?period=&grain=` for lazy drill-down.
- Wire optional cache + sync flush (reuse `cache_versions` pattern if present).

### M4 — Filters UI
- Grain switcher (Monthly / Quarterly / Yearly); quarter selector when needed.
- Collapsible advanced filters; Reset; URL query sync (`analyticsParamsFromUrl` / pushState).
- Keep homepage as Analytics entry (optional `/analytics` alias already redirects).

### M5 — Chart + thresholds
- KPI card threshold tones from config.
- Chart click / tooltip loads period-detail; show severity×priority and severity×AC panels.
- Polish empty/loading/error states.

## Out of scope

- Defect Tracker module and Jira write-backs  
- Leaderboard menu  
- Performance module  
- Rewriting Bug Budget dashboard  

## Success criteria

- [ ] M1–M5 merged; Analytics usable for QA leads without any deleted legacy app  
- [ ] Domain tests cover contract; API + UI support grain + advanced filters + drill-down  
- [ ] Sync does not leave stale analytics caches beyond TTL/version bump  

## Implementation order

Strict: **M1 → M2 → M3 → M4 → M5** (TDD in domain first).
