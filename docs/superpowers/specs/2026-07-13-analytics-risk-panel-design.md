# Defect Analytics — Open Risk Panel — Design

**Date:** 2026-07-13  
**Status:** Awaiting review  
**Approach:** Dedicated Risk panel on Defect Analytics (Approach 2) — no click-through  
**Scope:** Aging + severity risk for **open** issues on `localhost:3000` / Defect Analytics homepage  
**Depends on:** Existing analytics module (`packages/domain/src/analytics/*`, `GET /api/analytics`, `DefectAnalyticsDashboard`)

## North star

A Test Engineering Manager opens Defect Analytics and immediately sees whether open backlog risk is concentrated in Critical/Major severity and/or long-overdue aging — without leaving the volume KPIs or opening Bug Budget.

## Current baseline

| Layer | Exists |
|---|---|
| Domain age | `defectAgeBucket` — fresh ≤5, aging ≤20, stale ≤80, long overdue >80 business days |
| Domain analytics | Summary MoM (total/open/resolved/rate/avg_age), trends, period-detail severity matrices |
| Bug Budget stats | `open_critical`, `open_critical_major` (exact `severity_issue` match) |
| UI | Summary cards → trend chart → period detail; **no** open-risk aging/severity panel |

## Product rules

1. **Open only** — All risk metrics use `is_open === true` within the current analytics filter set (same rows as `computeAnalyticsSummary`).
2. **Age buckets** — Use `defectAgeBucket(defect_age_days)`. Rows with missing or `≤ 0` `defect_age_days` are **excluded** from bucket counts (do not inflate `fresh`).
3. **Critical / Major** — Match Bug Budget: `severity_issue === 'Critical'` or `'Major'` (exact casing as stored).
4. **Percentages** — `*_pct_of_open` = 0 when `open === 0`; otherwise `round1((count / open) * 100)`.
5. **MoM** — Same created-in-current-calendar-month vs previous-month pattern as existing summary MoM. Prior month empty or zero denominator → `null`.
6. **Timezone** — Asia/Jakarta via existing analytics month keys / synced `defect_age_days`.
7. **No new routes** — Extend `summary` on `GET /api/analytics` only.
8. **No schema changes** — Use existing `defect_age_days` and `severity_issue` on `bug_budget`.

## Data contract

Extend `AnalyticsSummaryResult`:

```ts
risk: {
  open_critical: number;
  open_major: number;
  open_critical_major: number;
  open_critical_major_pct_of_open: number;
  open_long_overdue: number;
  open_long_overdue_pct_of_open: number;
  open_age_buckets: {
    fresh: number;
    aging: number;
    stale: number;
    long_overdue: number;
  };
  open_severity: Record<string, number>;
  mom: {
    open_critical_major: number | null;
    open_long_overdue: number | null;
  };
}
```

Notes:
- `open_long_overdue` equals `open_age_buckets.long_overdue`.
- `open_severity` keys use display labels (`Critical`, `Major`, …); null/empty severity → `Unknown`.
- Existing summary fields (`total`, `open`, `resolved`, `resolution_rate`, `avg_age`, `mom`) remain unchanged.

## Thresholds

Add to `ANALYTICS_KPI_THRESHOLDS` (constants only; no settings UI):

| Key | Default | Sentiment |
|---|---|---|
| `open_critical_major_pct_warning` | 25 | higher is worse |
| `open_long_overdue_pct_warning` | 20 | higher is worse |

Tone helpers follow existing pattern: **danger** at threshold, **warning** at ≥ 70% of threshold, else **ok**. Apply tones to the Critical/Major and Long overdue KPI tiles using `*_pct_of_open`.

## UI

Insert a **Risk** panel between summary cards and the trend chart:

```
[Filters]
[SummaryCards — unchanged]
[Risk panel]          ← new
[Trend chart]
[Period detail]
```

Panel contents:
1. Header: “Open risk” + subtitle “Aging and severity of currently open issues”
2. Two KPI tiles: Open Critical / Major; Long overdue — value, `% of open` meta, MoM, threshold tone
3. Aging distribution for open issues (Fresh · Aging · Stale · Long overdue) with counts; empty copy when no open issues or no aged open issues in buckets
4. Open severity mix — ordered Critical → Major → Minor → Low → Unknown → any other keys; omit zero buckets except keep Unknown if count > 0

Loading: skeleton matching panel height. No click-through / filter patches in this slice.

## API

- `GET /api/analytics` returns extended `summary` including `risk`.
- Handler remains thin: `computeAnalyticsSummary(filtered, nowIso)` owns risk computation (inline or private helper in domain).
- Auth: unchanged (`requireViewAnalytics`).

## Edge cases

| Case | Behavior |
|---|---|
| No open issues | KPIs 0, pcts 0, empty aging message, empty severity mix |
| Filters yield zero rows | Same as above |
| Unknown severity | Counted under `Unknown`; not Critical/Major |
| Missing / ≤0 age | Excluded from buckets; long overdue unaffected |
| MoM prior month empty | `mom.open_critical_major` / `mom.open_long_overdue` = `null` |

## Out of scope

- Click-through to Bug Budget or filter patches from risk tiles  
- Changing the top five summary cards or trend/period-detail charts  
- Escape ratio, MTTR, inflow/outflow, squad heat (other TEM lenses)  
- Configurable thresholds in Settings  
- DB migrations  

## Success criteria

- [ ] Domain tests cover open-only scoping, Critical/Major parity with Bug Budget, bucket boundaries, age exclusion, zero-open pcts, MoM nulls  
- [ ] `/api/analytics` summary includes `risk` for filtered data  
- [ ] Defect Analytics shows Risk panel between summary and trends with loading/empty states  
- [ ] Existing analytics summary MoM KPIs and golden/contract tests remain green  

## Implementation order

1. Domain types + `computeAnalyticsSummary` risk fields + thresholds/tones (TDD)  
2. Contract/fixture updates  
3. UI `RiskPanel` + wire into `DefectAnalyticsDashboard`  
4. Manual check on `http://localhost:3000/` with filters  
