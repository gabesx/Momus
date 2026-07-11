# Defect Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/analytics` core-first Defect Analytics (filters, 5 cards + MoM, monthly Chart.js dual-axis) via `GET /api/analytics`, and update `/` hub links.

**Architecture:** Domain pure aggregators → infra loads `bug_budget` → single API → client dashboard with Chart.js. Hub stays at `/`.

**Tech Stack:** TypeScript, Next.js 15, Chart.js, `@momus/domain` / `@momus/infra`, Vitest, Momus `--bb-*` CSS.

**Spec:** `docs/superpowers/specs/2026-07-11-defect-analytics-design.md`

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/domain/src/analytics/types.ts` | Shared analytics input/output types |
| `packages/domain/src/analytics/filter.ts` | Apply core analytics filters + 24m window |
| `packages/domain/src/analytics/summary.ts` | Summary metrics + MoM % |
| `packages/domain/src/analytics/trends.ts` | Monthly series |
| `packages/domain/src/analytics/*.test.ts` | Unit tests |
| `packages/domain/src/index.ts` | Re-exports |
| `apps/web/app/api/analytics/route.ts` | `GET /api/analytics` |
| `apps/web/lib/analytics-params.ts` | Parse query params |
| `apps/web/components/analytics/*` | UI |
| `apps/web/app/analytics/page.tsx` | Page mount |
| `apps/web/app/page.tsx` | Hub links |
| `apps/web/app/globals.css` | `.bb-analytics-*` styles |
| `apps/web/package.json` | Add `chart.js` |

---

### Task 1: Domain — analytics filter + summary + trends

**Files:**
- Create: `packages/domain/src/analytics/types.ts`
- Create: `packages/domain/src/analytics/filter.ts`
- Create: `packages/domain/src/analytics/summary.ts`
- Create: `packages/domain/src/analytics/trends.ts`
- Create: `packages/domain/src/analytics/filter.test.ts`
- Create: `packages/domain/src/analytics/summary.test.ts`
- Create: `packages/domain/src/analytics/trends.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write types**

```ts
// packages/domain/src/analytics/types.ts
export type AnalyticsStatusFilter = 'open' | 'in-progress' | 'resolved' | 'closed';
export type AnalyticsIssueTypeFilter = 'bugs' | 'defects';

export type AnalyticsFilterParams = {
  year?: string | number | null;
  project?: string | null;
  issue_type?: AnalyticsIssueTypeFilter | '' | null;
  status?: AnalyticsStatusFilter | '' | null;
};

export type AnalyticsIssueRow = {
  project: string;
  created_date?: string | null;
  created_year?: number | null;
  is_open: boolean;
  issue_type?: string | null;
  final_issue_type?: string | null;
  status_category?: string | null;
  defect_age_days?: number | null;
  updated_at?: string | null;
};

export type AnalyticsSummaryMetrics = {
  total: number;
  open: number;
  resolved: number;
  resolution_rate: number;
  avg_age: number;
};

export type AnalyticsSummaryResult = AnalyticsSummaryMetrics & {
  mom: {
    total: number | null;
    open: number | null;
    resolved: number | null;
    resolution_rate: number | null;
    avg_age: number | null;
  };
};

export type AnalyticsTrendsResult = {
  labels: string[];
  bugs: number[];
  defects: number[];
  total: number[];
  resolution_rate: number[];
};
```

- [ ] **Step 2: Write failing tests**

```ts
// filter.test.ts — year filter, 24m default window, bugs-only, status open
// summary.test.ts — totals, resolution_rate, mom % vs prior month
// trends.test.ts — monthly labels in Asia/Jakarta, bug/defect split, resolution rate
```

Concrete `summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeAnalyticsSummary } from './summary';
import type { AnalyticsIssueRow } from './types';

describe('computeAnalyticsSummary', () => {
  it('computes totals and MoM percent change', () => {
    const rows: AnalyticsIssueRow[] = [
      // current month Jul 2026
      {
        project: 'A',
        created_date: '2026-07-05T00:00:00+07:00',
        is_open: true,
        final_issue_type: 'Bug',
        defect_age_days: 10,
      },
      {
        project: 'A',
        created_date: '2026-07-06T00:00:00+07:00',
        is_open: false,
        final_issue_type: 'Defect',
        defect_age_days: 20,
      },
      // prior month Jun 2026 — 4 issues all closed
      {
        project: 'A',
        created_date: '2026-06-01T00:00:00+07:00',
        is_open: false,
        final_issue_type: 'Bug',
        defect_age_days: 5,
      },
      {
        project: 'A',
        created_date: '2026-06-02T00:00:00+07:00',
        is_open: false,
        final_issue_type: 'Bug',
        defect_age_days: 5,
      },
      {
        project: 'A',
        created_date: '2026-06-03T00:00:00+07:00',
        is_open: false,
        final_issue_type: 'Bug',
        defect_age_days: 5,
      },
      {
        project: 'A',
        created_date: '2026-06-04T00:00:00+07:00',
        is_open: false,
        final_issue_type: 'Bug',
        defect_age_days: 5,
      },
    ];
    const result = computeAnalyticsSummary(rows, '2026-07-11T12:00:00+07:00');
    expect(result.total).toBe(6);
    expect(result.open).toBe(1);
    expect(result.resolved).toBe(5);
    expect(result.resolution_rate).toBe(83.3);
    // Jul total=2 vs Jun total=4 → -50%
    expect(result.mom.total).toBe(-50);
  });
});
```

- [ ] **Step 3: Implement filter helpers**

```ts
// packages/domain/src/analytics/filter.ts
import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES, STATUS_CATEGORY_GROUPS } from '../constants/defaults';
import type { AnalyticsFilterParams, AnalyticsIssueRow } from './types';

export function jakartaYearMonth(iso: string): { y: number; m: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(iso));
  return {
    y: Number(parts.find((p) => p.type === 'year')!.value),
    m: Number(parts.find((p) => p.type === 'month')!.value),
  };
}

export function monthKeyFromIso(iso: string): string {
  const { y, m } = jakartaYearMonth(iso);
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** Inclusive start of the last `months` calendar months ending at `nowIso` (Jakarta). */
export function defaultWindowStartIso(nowIso: string, months = 24): string {
  const { y, m } = jakartaYearMonth(nowIso);
  const total = y * 12 + (m - 1) - (months - 1);
  const sy = Math.floor(total / 12);
  const sm = (total % 12) + 1;
  return `${sy}-${String(sm).padStart(2, '0')}-01T00:00:00+07:00`;
}

function issueTypeOf(row: AnalyticsIssueRow): string {
  return row.issue_type ?? row.final_issue_type ?? '';
}

export function applyAnalyticsFilters(
  rows: AnalyticsIssueRow[],
  params: AnalyticsFilterParams,
  nowIso: string,
): AnalyticsIssueRow[] {
  let out = rows;
  const year = params.year;
  if (year !== undefined && year !== null && year !== '' && year !== 'all') {
    const y = Number(year);
    out = out.filter((r) => r.created_year === y || (r.created_date && jakartaYearMonth(r.created_date).y === y));
  } else {
    const start = new Date(defaultWindowStartIso(nowIso)).getTime();
    out = out.filter((r) => {
      if (!r.created_date) return false;
      return new Date(r.created_date).getTime() >= start;
    });
  }
  if (params.project) out = out.filter((r) => r.project === params.project);
  if (params.issue_type === 'bugs') {
    out = out.filter((r) => (BUG_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)));
  } else if (params.issue_type === 'defects') {
    out = out.filter((r) => (DEFECT_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)));
  }
  if (params.status === 'open') {
    out = out.filter((r) => r.is_open);
  } else if (params.status === 'in-progress') {
    out = out.filter((r) => {
      const c = (r.status_category ?? '').toLowerCase();
      return c.includes('progress') || c.includes('testing') || c.includes('waiting');
    });
  } else if (params.status === 'resolved' || params.status === 'closed') {
    out = out.filter((r) => !r.is_open);
  }
  return out;
}
```

(No separate “fix in-progress” block — mapping is included above.)

- [ ] **Step 4: Implement summary + trends**

```ts
// summary.ts
import { round1 } from '../budget/status';
import { monthKeyFromIso } from './filter';
import type { AnalyticsIssueRow, AnalyticsSummaryMetrics, AnalyticsSummaryResult } from './types';

function metrics(rows: AnalyticsIssueRow[]): AnalyticsSummaryMetrics {
  const total = rows.length;
  const open = rows.filter((r) => r.is_open).length;
  const resolved = total - open;
  const resolution_rate = total > 0 ? round1((resolved / total) * 100) : 0;
  const ages = rows.map((r) => r.defect_age_days ?? 0).filter((a) => a > 0);
  const avg_age = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
  return { total, open, resolved, resolution_rate, avg_age };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

export function computeAnalyticsSummary(
  rows: AnalyticsIssueRow[],
  nowIso: string,
): AnalyticsSummaryResult {
  const base = metrics(rows);
  const curKey = monthKeyFromIso(nowIso);
  const { y, m } = (() => {
    const [yy, mm] = curKey.split('-').map(Number);
    const d = new Date(Date.UTC(yy, mm - 2, 1)); // previous month
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  })();
  const prevKey = `${y}-${String(m).padStart(2, '0')}`;

  const curRows = rows.filter((r) => r.created_date && monthKeyFromIso(r.created_date) === curKey);
  const prevRows = rows.filter((r) => r.created_date && monthKeyFromIso(r.created_date) === prevKey);
  const cur = metrics(curRows);
  const prev = metrics(prevRows);

  return {
    ...base,
    mom: {
      total: pctChange(cur.total, prev.total),
      open: pctChange(cur.open, prev.open),
      resolved: pctChange(cur.resolved, prev.resolved),
      resolution_rate: pctChange(cur.resolution_rate, prev.resolution_rate),
      avg_age: pctChange(cur.avg_age, prev.avg_age),
    },
  };
}
```

```ts
// trends.ts
import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { round1 } from '../budget/status';
import { jakartaYearMonth, monthKeyFromIso } from './filter';
import type { AnalyticsIssueRow, AnalyticsTrendsResult } from './types';

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function computeMonthlyTrends(rows: AnalyticsIssueRow[], nowIso: string): AnalyticsTrendsResult {
  const withDate = rows.filter((r) => r.created_date);
  if (withDate.length === 0) {
    return { labels: [], bugs: [], defects: [], total: [], resolution_rate: [] };
  }
  const keys = [...new Set(withDate.map((r) => monthKeyFromIso(r.created_date!)))].sort();
  // Ensure contiguous months from min to now
  const start = keys[0];
  const end = monthKeyFromIso(nowIso);
  const labels: string[] = [];
  const bugs: number[] = [];
  const defects: number[] = [];
  const total: number[] = [];
  const resolution_rate: number[] = [];

  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const bucket = withDate.filter((r) => monthKeyFromIso(r.created_date!) === key);
    const b = bucket.filter((r) =>
      (BUG_GROUP_TYPES as readonly string[]).includes(r.issue_type ?? r.final_issue_type ?? ''),
    ).length;
    const d = bucket.filter((r) =>
      (DEFECT_GROUP_TYPES as readonly string[]).includes(r.issue_type ?? r.final_issue_type ?? ''),
    ).length;
    const t = bucket.length;
    const resolved = bucket.filter((r) => !r.is_open).length;
    labels.push(`${MONTH_LABELS[m - 1]} ${y}`);
    bugs.push(b);
    defects.push(d);
    total.push(t);
    resolution_rate.push(t > 0 ? round1((resolved / t) * 100) : 0);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { labels, bugs, defects, total, resolution_rate };
}
```

Export from `index.ts`.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @momus/domain exec vitest run src/analytics
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/analytics packages/domain/src/index.ts
git commit -m "feat(domain): analytics summary and monthly trend aggregators"
```

---

### Task 2: API route `GET /api/analytics`

**Files:**
- Create: `apps/web/lib/analytics-params.ts`
- Create: `apps/web/app/api/analytics/route.ts`

- [ ] **Step 1: Params helper**

```ts
import type { AnalyticsFilterParams } from '@momus/domain';

export function analyticsParamsFromUrl(url: URL): AnalyticsFilterParams {
  const sp = url.searchParams;
  return {
    year: sp.get('year') || undefined,
    project: sp.get('project') || undefined,
    issue_type: (sp.get('issue_type') as AnalyticsFilterParams['issue_type']) || undefined,
    status: (sp.get('status') as AnalyticsFilterParams['status']) || undefined,
  };
}
```

- [ ] **Step 2: Route**

```ts
import {
  applyAnalyticsFilters,
  computeAnalyticsSummary,
  computeMonthlyTrends,
  extractFilterOptions,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { analyticsParamsFromUrl } from '@/lib/analytics-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;
  try {
    const params = analyticsParamsFromUrl(new URL(request.url));
    const nowIso = new Date().toISOString();
    const repo = new BugBudgetQueryRepository(createServerClient());
    const all = await repo.listAllForFilters();
    const filter_options = {
      projects: extractFilterOptions(all).projects,
      years: extractFilterOptions(all).years,
    };
    const filtered = applyAnalyticsFilters(all, params, nowIso);
    const summary = computeAnalyticsSummary(filtered, nowIso);
    const trends = computeMonthlyTrends(filtered, nowIso);
    const last_updated =
      all
        .map((r) => r.updated_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    const scope_hint = params.year
      ? `Showing data for year ${params.year}`
      : 'Showing recent bug/defect data (default last 24 months)';
    return jsonOk({
      summary,
      trends,
      filter_options,
      meta: { last_updated, scope_hint },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load analytics', 500);
  }
}
```

- [ ] **Step 3: Typecheck + smoke**

```bash
pnpm --filter @momus/web typecheck
curl -sS 'http://127.0.0.1:3000/api/analytics' | head -c 400
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/analytics-params.ts apps/web/app/api/analytics/route.ts
git commit -m "feat(api): add GET /api/analytics for defect analytics"
```

---

### Task 3: Install Chart.js + CSS + hub

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Install**

```bash
pnpm --filter @momus/web add chart.js
```

- [ ] **Step 2: Hub page**

Replace placeholder list with full-bleed hub linking to `/analytics`, `/bug-budget`, `/settings/atlassian#bug-budget`.

- [ ] **Step 3: CSS** — `.bb-analytics`, filter grid, summary metric cards, chart card, MoM positive/negative colors. Full-bleed (`width: 100%`, `min-height: 100vh`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/app/page.tsx apps/web/app/globals.css
git commit -m "feat(web): hub links and analytics page styles; add chart.js"
```

---

### Task 4: Analytics UI components + page

**Files:**
- Create: `apps/web/components/analytics/analytics-filters.tsx`
- Create: `apps/web/components/analytics/summary-cards.tsx`
- Create: `apps/web/components/analytics/trend-chart.tsx`
- Create: `apps/web/components/analytics/defect-analytics-dashboard.tsx`
- Create: `apps/web/app/analytics/page.tsx`

- [ ] **Step 1: Filters + SummaryCards** — controlled props; MoM shows `↑/↓ X% vs previous month` with positive/negative classes (age: decrease = positive).

- [ ] **Step 2: TrendChart** — `'use client'`; `useEffect` creates Chart.js line chart on canvas with dual y-axes; destroy on cleanup / data change.

```ts
scales: {
  y: { type: 'linear', position: 'left', title: { display: true, text: 'Number of Issues' } },
  y1: {
    type: 'linear',
    position: 'right',
    min: 0,
    max: 100,
    grid: { drawOnChartArea: false },
    title: { display: true, text: 'Resolution Rate (%)' },
  },
}
```

Datasets: bugs (blue), defects (red), total (teal), resolution_rate (purple dashed, `yAxisID: 'y1'`).

- [ ] **Step 3: Dashboard shell** — parse filters from URLSearchParams; debounce 100ms; `pushState`; fetch `/api/analytics`; Refresh; Last Updated from `meta.last_updated`.

- [ ] **Step 4: Page**

```tsx
import { DefectAnalyticsDashboard } from '@/components/analytics/defect-analytics-dashboard';
export default function AnalyticsPage() {
  return <DefectAnalyticsDashboard />;
}
```

- [ ] **Step 5: Typecheck + manual smoke** at `http://127.0.0.1:3000/analytics`

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/analytics apps/web/app/analytics
git commit -m "feat(web): Defect Analytics dashboard with Chart.js trends"
```

---

### Task 5: Verification

- [ ] **Step 1:** `pnpm --filter @momus/domain exec vitest run src/analytics`
- [ ] **Step 2:** `pnpm --filter @momus/web typecheck`
- [ ] **Step 3:** Curl API + open `/` and `/analytics` in browser
- [ ] **Step 4:** Fix any gaps; commit if needed

---

## Spec coverage

| Spec item | Task |
|---|---|
| Hub at `/` | 3 |
| `/analytics` UI | 4 |
| Core filters | 1, 2, 4 |
| Summary + MoM | 1, 4 |
| Monthly Chart.js dual-axis | 3, 4 |
| `GET /api/analytics` | 2 |
| Domain tests | 1, 5 |
| Full-bleed | 3 |
| Out of scope advanced filters | — |

## Self-review notes

- MoM compares **current vs previous calendar month created issues** within the already-filtered set (matches spec).
- In-progress status mapping uses `status_category` heuristics compatible with stored Jira categories.
- `extractFilterOptions` reused for project/year dropdowns from full unfiltered set.
