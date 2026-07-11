# Defect Analytics Dashboard — Design Spec

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Route:** `/analytics` (Momus hub remains at `/`)  
**Scope:** Core-first Defect Analytics (filters + summary cards + monthly Chart.js trend)

## Goal

Ship a Momus Defect Analytics page that shows bug/defect summary metrics (with month-over-month deltas when computable) and a monthly dual-axis trend chart, fed by synced `bug_budget` data. Keep `/` as a Momus hub linking to Analytics, Bug Budget, and Settings.

## Non-goals (this pass)

- Advanced filters (severity, AC-related, priority, date from/to)
- Quarterly / yearly trend view types
- QARATMS global chrome (sidebar, Bootstrap Icons CDN)
- BB-CACHE-01 cache layer
- Replacing `MOMUS_DEV_AUTH_BYPASS` with production auth

## Decisions (approved)

| Topic | Choice |
|---|---|
| Home vs analytics | Hub at `/`; analytics at `/analytics` |
| Completeness | Core-first (year / project / issue type / status + cards + monthly chart) |
| Chart | Chart.js, dual Y-axis (counts + resolution rate %) |
| Architecture | Single `GET /api/analytics` returning summary + trends |

## Architecture

```
Browser (/analytics)
        │  filters → 100ms debounce → refetch
        ▼
GET /api/analytics?year&project&issue_type&status
        │
        ▼
infra: load bug_budget rows
        │
        ▼
domain: filter → computeSummary (+ MoM) → computeMonthlyTrends
        │
        ▼
JSON { summary, trends, filter_options, meta }
```

- Pure aggregations live in `packages/domain`
- Row loading in `packages/infra` (reuse Phase-3 list-all pattern)
- UI client components under `apps/web/components/analytics/`
- Full-bleed layout (no centered max-width container)

## Layout (`/analytics`)

1. **Header** — title “Defect Analytics Dashboard”, subtitle, Last Updated + Refresh  
2. **Filters** — Year, Issue Type (All / Bugs / Defects), Project, Status (All / Open / In Progress / Resolved / Closed), Reset, scope hint  
3. **Five summary cards** — Total Issues, Open Issues, Resolved Issues, Resolution Rate %, Avg Age (days); MoM chip when prior month comparable  
4. **Trend card** — Chart.js ~400px: Bug Count, Defect Count, Total Issues, Overall Resolution Rate % (dashed, right axis)

## Components

| Component | Role |
|---|---|
| `DefectAnalyticsDashboard` | URL/local filter state, fetch, alerts, refresh |
| `AnalyticsFilters` | Core filter controls + reset |
| `SummaryCards` | Five metrics + MoM indicators |
| `TrendChart` | Chart.js client canvas (dynamic import / `'use client'`) |

Also: update `apps/web/app/page.tsx` hub links; add `apps/web/app/analytics/page.tsx`.

## API contract

**`GET /api/analytics`** — permission `view_analytics`

**Query**

| Param | Values |
|---|---|
| `year` | empty = all (default window last 24 months for trends) |
| `project` | Jira project key |
| `issue_type` | `bugs` \| `defects` \| empty |
| `status` | `open` \| `in-progress` \| `resolved` \| `closed` \| empty |

**Success body**

```ts
{
  success: true;
  summary: {
    total: number;
    open: number;
    resolved: number;
    resolution_rate: number; // 0–100, 1 decimal
    avg_age: number;
    mom: {
      total: number | null;
      open: number | null;
      resolved: number | null;
      resolution_rate: number | null;
      avg_age: number | null;
    }; // percent change vs prior calendar month
  };
  trends: {
    labels: string[]; // "Jul 2024"
    bugs: number[];
    defects: number[];
    total: number[];
    resolution_rate: number[];
  };
  filter_options: { projects: string[]; years: number[] };
  meta: { last_updated: string | null; scope_hint: string };
}
```

## Aggregation rules

- Timezone: Asia/Jakarta  
- Default window (no year): last 24 months of `created_date`  
- Monthly buckets by Jakarta calendar month of `created_date`  
- Bugs / defects via existing issue-type group helpers (`final_issue_type` / group lists)  
- Open / resolved via existing `is_open` / status-category semantics  
- Status filter maps: open → open issues; in-progress → in-progress category; resolved/closed → done category  
- MoM: metrics for current calendar month vs previous month under the same filters; null when prior base is zero / missing  
- Rows missing `created_date` skipped for trend series  

## UX states

| State | Behavior |
|---|---|
| Loading | Skeleton / spinner for cards + chart overlay |
| Empty | Zero metrics + empty chart message |
| Error | Dismissible alert; keep last good data if any |
| Success | Cards + chart; update Last Updated |

## Dependencies

- Add `chart.js` (and React wrapper only if needed; canvas + Chart.js direct is fine)

## Done when

- [ ] `/` hub links to `/analytics`, `/bug-budget`, settings  
- [ ] `/analytics` shows filters, 5 cards (MoM when possible), monthly Chart.js dual-axis chart  
- [ ] Live data via `GET /api/analytics` from `bug_budget`  
- [ ] Domain unit tests for summary + monthly trend helpers  
- [ ] `pnpm --filter @momus/web typecheck` passes  

## Traceability

| Item | Notes |
|---|---|
| PRD | Defect Analytics is a sibling consumer of `bug_budget` (explicitly in-scope for this Momus page by product request) |
| Data | Read-only over existing `bug_budget` table |
| Follow-ups | Advanced filters; quarterly/yearly views; cache TTL |
