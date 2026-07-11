# Bug Budget Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship full-parity Momus `/bug-budget` dashboard + detail page against existing Phase 3 APIs (BB-UI-02…08).

**Architecture:** Client `BugBudgetDashboard` owns URLSearchParams state (100ms debounce + `pushState`/`popstate`), fetches `GET /api/bug-budget`, and mounts header/stats/severity/filters/table/modals. Detail page at `/bug-budget/[id]` is separate. Filter dropdown options come from list API (uncached distincts; BB-CACHE-01 out of scope). Summary `year=all` fixed to pass `null` into domain builders.

**Tech Stack:** Next.js 15 App Router, React 19 client components, `@momus/domain` badges/stats, `@momus/shared` MESSAGES, existing `apiJson`, Momus `--bb-*` CSS.

**Spec:** `docs/superpowers/specs/2026-07-11-bug-budget-dashboard-design.md`  
**PRD:** §9.1–9.2 BB-UI-02…08, BB-UI-11

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/domain/src/filters/filter-options.ts` | Pure `extractFilterOptions(rows)` |
| `packages/domain/src/filters/stat-card-patches.ts` | Pure stat-card URL patches + Jakarta `date_from` −30d |
| `packages/domain/src/filters/filter-options.test.ts` | Tests for options extraction |
| `packages/domain/src/filters/stat-card-patches.test.ts` | Tests for patches |
| `packages/infra/src/supabase/bug-budget-query.ts` | Return filter options from `findFiltered` (or helper) |
| `apps/web/app/api/bug-budget/route.ts` | Include `filter_options` in JSON |
| `apps/web/app/api/bug-budget/open-*-summary/route.ts` | `year=all` → `null` |
| `apps/web/lib/bug-budget-url.ts` | Serialize/parse dashboard query state |
| `apps/web/lib/bug-budget-columns.ts` | Column defs + localStorage |
| `apps/web/lib/bug-budget-types.ts` | Client response types |
| `apps/web/components/bug-budget/*.tsx` | UI components |
| `apps/web/app/bug-budget/page.tsx` | Mount dashboard |
| `apps/web/app/bug-budget/[id]/page.tsx` | Detail |
| `apps/web/app/globals.css` | `.bb-dash-*` styles |

---

### Task 1: Domain — filter options + stat-card patches

**Files:**
- Create: `packages/domain/src/filters/filter-options.ts`
- Create: `packages/domain/src/filters/filter-options.test.ts`
- Create: `packages/domain/src/filters/stat-card-patches.ts`
- Create: `packages/domain/src/filters/stat-card-patches.test.ts`
- Modify: `packages/domain/src/index.ts` — re-export new modules

- [ ] **Step 1: Write failing tests for `extractFilterOptions`**

```ts
import { describe, expect, it } from 'vitest';
import { extractFilterOptions } from './filter-options';

describe('extractFilterOptions', () => {
  it('returns sorted unique projects, statuses, issue_types, reporters, years', () => {
    const opts = extractFilterOptions([
      {
        project: 'B',
        status: 'Open',
        issue_type: 'Bug',
        reporter: 'bob',
        created_year: 2025,
      },
      {
        project: 'A',
        status: 'Done',
        issue_type: 'Defect',
        reporter: 'ann',
        created_year: 2024,
      },
      {
        project: 'A',
        status: 'Open',
        issue_type: 'Bug',
        reporter: null,
        created_year: 2025,
      },
    ]);
    expect(opts.projects).toEqual(['A', 'B']);
    expect(opts.statuses).toEqual(['Done', 'Open']);
    expect(opts.issue_types).toEqual(['Bug', 'Defect']);
    expect(opts.reporters).toEqual(['ann', 'bob']);
    expect(opts.years).toEqual([2024, 2025]);
  });
});
```

- [ ] **Step 2: Write failing tests for stat-card patches**

```ts
import { describe, expect, it } from 'vitest';
import { applyStatCardPatch, type DashboardQueryState } from './stat-card-patches';

const base: DashboardQueryState = {
  not_done: '1',
  status_category: 'done',
  open_critical_major: '1',
  date_from: '2020-01-01',
  date_to: '2020-02-01',
  page: '2',
};

describe('applyStatCardPatch', () => {
  it('total clears scope quick filters and resets page', () => {
    const next = applyStatCardPatch(base, 'total', '2026-07-11T00:00:00+07:00');
    expect(next.not_done).toBeUndefined();
    expect(next.status_category).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
    expect(next.date_from).toBeUndefined();
    expect(next.date_to).toBeUndefined();
    expect(next.page).toBe('1');
  });

  it('open sets not_done=1', () => {
    const next = applyStatCardPatch(base, 'open', '2026-07-11T00:00:00+07:00');
    expect(next.not_done).toBe('1');
    expect(next.status_category).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
    expect(next.page).toBe('1');
  });

  it('closed sets status_category=done', () => {
    const next = applyStatCardPatch({ ...base, not_done: '1' }, 'closed', '2026-07-11T00:00:00+07:00');
    expect(next.status_category).toBe('done');
    expect(next.not_done).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
  });

  it('critical sets not_done + open_critical_major', () => {
    const next = applyStatCardPatch(base, 'critical', '2026-07-11T00:00:00+07:00');
    expect(next.not_done).toBe('1');
    expect(next.open_critical_major).toBe('1');
    expect(next.status_category).toBeUndefined();
  });

  it('recent sets date_from to today-30 in Asia/Jakarta (YYYY-MM-DD)', () => {
    const next = applyStatCardPatch(base, 'recent', '2026-07-11T15:00:00+07:00');
    expect(next.date_from).toBe('2026-06-11');
    expect(next.not_done).toBeUndefined();
    expect(next.status_category).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
pnpm --filter @momus/domain exec vitest run src/filters/filter-options.test.ts src/filters/stat-card-patches.test.ts
```

Expected: FAIL (modules missing)

- [ ] **Step 4: Implement**

`filter-options.ts`:

```ts
export type FilterOptions = {
  projects: string[];
  statuses: string[];
  issue_types: string[];
  reporters: string[];
  years: number[];
};

export type FilterOptionRow = {
  project?: string | null;
  status?: string | null;
  issue_type?: string | null;
  reporter?: string | null;
  created_year?: number | null;
};

function uniqSortedStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function extractFilterOptions(rows: FilterOptionRow[]): FilterOptions {
  return {
    projects: uniqSortedStrings(rows.map((r) => r.project)),
    statuses: uniqSortedStrings(rows.map((r) => r.status)),
    issue_types: uniqSortedStrings(rows.map((r) => r.issue_type)),
    reporters: uniqSortedStrings(rows.map((r) => r.reporter)),
    years: [
      ...new Set(
        rows
          .map((r) => r.created_year)
          .filter((y): y is number => typeof y === 'number' && Number.isFinite(y)),
      ),
    ].sort((a, b) => a - b),
  };
}
```

`stat-card-patches.ts`:

```ts
/** Serializable dashboard query keys (string values only). */
export type DashboardQueryState = Record<string, string | undefined>;

export type StatCardId = 'total' | 'open' | 'closed' | 'critical' | 'recent';

const SCOPE_KEYS = [
  'not_done',
  'status_category',
  'open_critical_major',
  'date_from',
  'date_to',
] as const;

function clearKeys(state: DashboardQueryState, keys: readonly string[]): DashboardQueryState {
  const next = { ...state };
  for (const k of keys) delete next[k];
  return next;
}

/** Format YYYY-MM-DD in Asia/Jakarta for an ISO instant, minus `days`. */
export function jakartaDateMinusDays(isoNow: string, days: number): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(isoNow));
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  // Construct noon UTC-equivalent calendar math via Date.UTC then subtract days
  const utc = Date.UTC(y, m - 1, d) - days * 86_400_000;
  const back = new Date(utc);
  const y2 = back.getUTCFullYear();
  const m2 = String(back.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(back.getUTCDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}

export function applyStatCardPatch(
  state: DashboardQueryState,
  card: StatCardId,
  isoNow: string,
): DashboardQueryState {
  let next = clearKeys(state, SCOPE_KEYS);
  next.page = '1';
  switch (card) {
    case 'total':
      return next;
    case 'open':
      return { ...next, not_done: '1' };
    case 'closed':
      return { ...next, status_category: 'done' };
    case 'critical':
      return { ...next, not_done: '1', open_critical_major: '1' };
    case 'recent':
      return { ...next, date_from: jakartaDateMinusDays(isoNow, 30) };
  }
}
```

Re-export from `packages/domain/src/index.ts`.

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @momus/domain exec vitest run src/filters/filter-options.test.ts src/filters/stat-card-patches.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add packages/domain/src/filters/filter-options.ts packages/domain/src/filters/filter-options.test.ts packages/domain/src/filters/stat-card-patches.ts packages/domain/src/filters/stat-card-patches.test.ts packages/domain/src/index.ts
git commit -m "feat(domain): filter options extractors and stat-card patches"
```

---

### Task 2: API — `filter_options` + summary `year=all`

**Files:**
- Modify: `packages/infra/src/supabase/bug-budget-query.ts`
- Modify: `apps/web/app/api/bug-budget/route.ts`
- Modify: `apps/web/app/api/bug-budget/open-bug-summary/route.ts`
- Modify: `apps/web/app/api/bug-budget/open-defect-summary/route.ts`

- [ ] **Step 1: Return `filter_options` from `findFiltered`**

In `bug-budget-query.ts`, import `extractFilterOptions` from `@momus/domain`. After `const all = await this.listAllForFilters()`:

```ts
const filter_options = extractFilterOptions(all);
```

Include `filter_options` in the return object of `findFiltered`.

- [ ] **Step 2: Expose on list route**

In `apps/web/app/api/bug-budget/route.ts`, destructure `filter_options` from `findFiltered` and add to `jsonOk({ ..., filter_options })`.

- [ ] **Step 3: Fix summary year parsing (both summary routes)**

Replace year coercion with:

```ts
const yearParam = new URL(request.url).searchParams.get('year');
let year: number | null;
if (!yearParam || yearParam === 'all') {
  year = null;
} else {
  year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2020 || year > 2030) {
    return jsonFail('year must be between 2020 and 2030', 422);
  }
}
// ...
const [rows, dbProjects] = await Promise.all([
  repo.listSummaryInputs(year),
  repo.listDistinctProjects(),
]);
const projects = buildOpenBugSummary(rows, dbProjects, config, year); // or buildOpenDefectSummary
return jsonOk({ projects, year: year ?? 'all' });
```

Same pattern for defect summary.

- [ ] **Step 4: Typecheck packages**

```bash
pnpm --filter @momus/infra typecheck && pnpm --filter @momus/web typecheck
```

Expected: PASS (or only pre-existing unrelated errors)

- [ ] **Step 5: Commit**

```bash
git add packages/infra/src/supabase/bug-budget-query.ts apps/web/app/api/bug-budget/route.ts apps/web/app/api/bug-budget/open-bug-summary/route.ts apps/web/app/api/bug-budget/open-defect-summary/route.ts
git commit -m "feat(api): expose filter_options; fix summary year=all"
```

---

### Task 3: Web libs — URL state, columns, types

**Files:**
- Create: `apps/web/lib/bug-budget-types.ts`
- Create: `apps/web/lib/bug-budget-url.ts`
- Create: `apps/web/lib/bug-budget-columns.ts`
- Modify: `apps/web/lib/bug-budget-params.ts` — keep `bugBudgetParamsFromUrl`; URL builder uses same keys

- [ ] **Step 1: Add types matching API**

```ts
// apps/web/lib/bug-budget-types.ts
import type { FilterOptions, StatsResult } from '@momus/domain';

export type BugBudgetIssueRow = {
  jira_key: string;
  project: string;
  summary?: string | null;
  priority?: string | null;
  severity_issue?: string | null;
  status?: string | null;
  reporter?: string | null;
  created_date?: string | null;
  defect_age_days?: number | null;
  is_open: boolean;
  final_issue_type?: string | null;
  issue_type?: string | null;
  status_category?: string | null;
  assignee_final?: string | null;
  tested_by?: string | null;
  end_date?: string | null;
  actual_end?: string | null;
  resolved_date?: string | null;
  updated_at?: string | null;
};

export type BugBudgetListResponse = {
  success: boolean;
  message?: string;
  stats: StatsResult;
  issues: BugBudgetIssueRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    last_page: number;
  };
  per_page_capped: boolean;
  notice: string | null;
  jira_browse_base: string;
  active_filter_count: number;
  database_total: number;
  filter_options: FilterOptions;
};
```

Export `SummaryProject` from domain already — reuse for modal types.

Confirm `StatsResult` is exported from `@momus/domain` (`filters/stats.ts`). If not exported, export it.

- [ ] **Step 2: URL helpers**

```ts
// apps/web/lib/bug-budget-url.ts
import type { DashboardQueryState } from '@momus/domain';

const KNOWN_KEYS = [
  'project', 'status', 'status_category', 'issue_type', 'issue_type_group',
  'reporter', 'year', 'quarter', 'ac_related', 'assignee',
  'date_from', 'date_to', 'age_min', 'age_max',
  'show_all', 'include_all_projects', 'not_done', 'open_critical_major',
  'page', 'per_page', 'sort', 'direction',
] as const;

export function parseDashboardQuery(sp: URLSearchParams): DashboardQueryState {
  const state: DashboardQueryState = {};
  for (const key of KNOWN_KEYS) {
    const v = sp.get(key);
    if (v !== null && v !== '') state[key] = v;
  }
  return state;
}

export function toSearchParams(state: DashboardQueryState): URLSearchParams {
  const sp = new URLSearchParams();
  for (const key of KNOWN_KEYS) {
    const v = state[key];
    if (v !== undefined && v !== '') sp.set(key, v);
  }
  return sp;
}

export function toQueryString(state: DashboardQueryState): string {
  const s = toSearchParams(state).toString();
  return s ? `?${s}` : '';
}

export function interpolateM01(n: number, m: number): string {
  // import MESSAGES from @momus/shared in real file
  return `Metrics reflect your current filters — ${n} of ${m} records in database`;
}
```

Use `MESSAGES.M01.replace('{N}', String(n)).replace('{M}', String(m))` in the real file.

- [ ] **Step 3: Column visibility**

```ts
// apps/web/lib/bug-budget-columns.ts
export type ColumnId =
  | 'key' | 'project' | 'summary' | 'status' | 'priority' | 'severity'
  | 'assignee' | 'tested_by' | 'reporter' | 'created' | 'age'
  | 'issue_type' | 'closed' | 'complete_date' | 'resolution_date';

export const COLUMN_DEFS: { id: ColumnId; label: string; required?: boolean; optional?: boolean }[] = [
  { id: 'key', label: 'Key', required: true },
  { id: 'project', label: 'Project' },
  { id: 'summary', label: 'Summary' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'severity', label: 'Severity' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'tested_by', label: 'Test Assignee' },
  { id: 'reporter', label: 'Reporter' },
  { id: 'created', label: 'Created' },
  { id: 'age', label: 'Age' },
  { id: 'issue_type', label: 'Issue Type', optional: true },
  { id: 'closed', label: 'Closed', optional: true },
  { id: 'complete_date', label: 'Complete Date', optional: true },
  { id: 'resolution_date', label: 'Resolution Date', optional: true },
];

const STORAGE_KEY = 'momus.bugBudget.columns';

export function defaultVisibleColumns(): Record<ColumnId, boolean> {
  const vis = {} as Record<ColumnId, boolean>;
  for (const c of COLUMN_DEFS) {
    vis[c.id] = c.required ? true : !c.optional;
  }
  return vis;
}

export function loadVisibleColumns(): Record<ColumnId, boolean> {
  const defaults = defaultVisibleColumns();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
    return { ...defaults, ...parsed, key: true };
  } catch {
    return defaults;
  }
}

export function saveVisibleColumns(vis: Record<ColumnId, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...vis, key: true }));
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/bug-budget-types.ts apps/web/lib/bug-budget-url.ts apps/web/lib/bug-budget-columns.ts packages/domain/src/filters/stats.ts
git commit -m "feat(web): bug budget URL, columns, and response types"
```

---

### Task 4: Dashboard CSS

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Append dashboard styles** under existing settings styles:

Use classes:
- `.bb-dash` page shell (max-width 1280, padding)
- `.bb-dash-header` flex title + toolbar
- `.bb-stat-grid` 6-col responsive grid
- `.bb-stat-card` / `.bb-stat-card--clickable` / accents `--primary|danger|success|critical|info|neutral`
- `.bb-severity` bars (width %)
- `.bb-filters` collapsible
- `.bb-table-wrap` overflow-x
- `.bb-badge` + modifiers matching `BadgeColor`
- `.bb-modal` fullscreen overlay, `.bb-modal__panel`
- `.bb-toast` top-right
- `.bb-progress` budget usage bar
- `.bb-summary-grid` project cards; header tint by `status_color`

Reuse `.btn`, `.btn-primary`, `.btn-success`, `.btn-outline`, `.settings-card`, `.field`, `.settings-alert` where possible.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): bug budget dashboard CSS"
```

---

### Task 5: Presentational components

**Files (create all under `apps/web/components/bug-budget/`):**
- `dashboard-header.tsx`
- `stat-cards.tsx`
- `severity-panel.tsx`
- `filter-panel.tsx`
- `issues-table.tsx`
- `column-visibility-modal.tsx`
- `summary-modal.tsx`
- `scope-banner.tsx`

- [ ] **Step 1: `DashboardHeader`**

Props: `onOpenBug`, `onOpenDefect`, `onColumns`, `exportHref`, `settingsHref` (default `/settings/atlassian#bug-budget`).

Buttons: Open Bug Summary, Open Defect Summary, Settings (Link), Columns, Export CSV (`<a className="btn btn-success" href={exportHref}>`).

Title: "Bug Budget"; subtitle: `MESSAGES.M19`.

- [ ] **Step 2: `StatCards`**

Props: `stats: StatsResult`, `onSelect: (id: StatCardId) => void`, `loading?: boolean`.

Six cards per PRD meta lines. Avg Age shows `MESSAGES.M02`, not clickable. Others call `onSelect`.

- [ ] **Step 3: `SeverityPanel`**

Props: `breakdown: StatsResult['severity_breakdown']`.

Order Critical → Major → Moderate → Minor → Low (from `SEVERITY_ORDER`); hide zero totals. Bar width = `total / max`. Collapse "Show AC / priority detail" toggles counts; persist open state in `sessionStorage` key `momus.bugBudget.severityDetail`.

- [ ] **Step 4: `FilterPanel`**

Props: `state`, `options: FilterOptions`, `activeCount`, `open`, `onToggle`, `onChange(patch)`, `onReset`.

Collapsed by default. Toggle label `Filters (${activeCount})`.

Fields (native selects/inputs):
- Project, Status, Status Category (`todo|in_progress|done`), Issue Type, Issue Group (`bug|defect`), Reporter, Year (All + options.years), Quarter (Q1–Q4), AC Related
- Assignee text; Date From/To date inputs
- Switches: `show_all`, `include_all_projects`, `not_done` (label: Exclude Done / Not Done)
- Age quick buttons: `<7d` → age_max=6; `7–30d` → age_min=7,age_max=30; `30–120d` → 30–120; `>120d` → age_min=121 (clear the other bound as needed)
- Reset button clears all filter keys (keep sort/per_page)

Any change → `onChange` with merged patch + `page: '1'`.

- [ ] **Step 5: `IssuesTable`**

Props: `issues`, `pagination`, `jiraBrowseBase`, `visible`, `state`, `loading`, `onChange`, `onClearFilters`.

- Header: "Bug/Defect Issues" + total badge + "Showing X to Y of Z"
- Per-page: 25/50/100 + option that navigates to export CSV
- Sort select mapping:
  - Newest First → `sort=created_date&direction=desc`
  - Oldest First → `created_date` asc
  - Priority → `priority` desc
  - Severity → `severity_issue` desc
  - Project → `project` asc
  - Assignee → `assignee_final` asc
  - Recently Closed → `end_date` desc
  - Oldest Issues → `defect_age_days` desc
- Badges via `statusColor` / `priorityColor` / `severityColor` / `ageBadgeColor` / `isRecent`
- Key: link `{jiraBrowseBase}/{jira_key}` if base non-empty; `stopPropagation`
- Row click: open same Jira URL in new tab (BB-UI-06)
- Empty: M-05/M-06 + Clear Filters
- Pagination buttons update `page`

- [ ] **Step 6: `ColumnVisibilityModal`**

Checkbox list from `COLUMN_DEFS`; Key disabled checked. Apply → `saveVisibleColumns` + `onApplied` (parent shows M-04 toast). Cancel closes.

- [ ] **Step 7: `SummaryModal`**

Props: `kind: 'bug' | 'defect'`, `open`, `onClose`, `initialYear` (string | 'all').

On open / year change: `apiJson` to `/api/bug-budget/open-bug-summary?year=` or `open-defect-summary`.

Year select: All Years + 2020…currentYear+1.

Render legend `MESSAGES.M20`; project cards with `status_color` header, counts, cost, left, progress bar `min(usage,100)%`, severity-grouped issue tables (bug vs defect columns per PRD §9.1).

Empty: M-09 / M-10. Loading spinner. Error inline alert.

- [ ] **Step 8: `ScopeBanner`**

Show when `active_filter_count > 0`: M-01 text + "View all {database_total} records" button calling reset.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/bug-budget
git commit -m "feat(web): bug budget dashboard presentational components"
```

---

### Task 6: `BugBudgetDashboard` + page mount

**Files:**
- Create: `apps/web/components/bug-budget/bug-budget-dashboard.tsx`
- Modify: `apps/web/app/bug-budget/page.tsx`

- [ ] **Step 1: Implement dashboard shell**

Client component responsibilities:
1. Init `state` from `window.location.search` via `parseDashboardQuery`
2. `fetchData(state)` → `apiJson<BugBudgetListResponse>('/api/bug-budget' + toQueryString(state))`
3. On state change (except first paint sync): debounce 100ms → `history.pushState(null, '', '/bug-budget' + qs)` → fetch
4. `popstate` listener → re-parse + fetch
5. Wire all children; toast state for M-04; error alert dismissible; keep last good data on error
6. Loading skeletons when `!data && loading`
7. Export href: `/api/bug-budget/export/csv` + current qs (or `/bug-budget/export/csv`)
8. Stat card → `applyStatCardPatch(state, id, new Date().toISOString())`

- [ ] **Step 2: Replace placeholder page**

```tsx
import { BugBudgetDashboard } from '@/components/bug-budget/bug-budget-dashboard';

export default function BugBudgetPage() {
  return <BugBudgetDashboard />;
}
```

- [ ] **Step 3: Manual smoke (dev server)**

Open `http://127.0.0.1:3000/bug-budget` with `MOMUS_DEV_AUTH_BYPASS=true`. Confirm stats + table load; click Open Issues; URL updates; back works; Export downloads; Columns toast; Bug Summary opens.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/bug-budget/bug-budget-dashboard.tsx apps/web/app/bug-budget/page.tsx
git commit -m "feat(web): mount bug budget dashboard with URL-driven fetch"
```

---

### Task 7: Detail page BB-UI-08

**Files:**
- Create: `apps/web/app/bug-budget/[id]/page.tsx` (client or server+client hybrid)
- Create: `apps/web/components/bug-budget/issue-detail.tsx`

- [ ] **Step 1: Client detail loader**

Fetch `GET /api/bug-budget/${encodeURIComponent(id)}`.

Render:
- Back link to `/bug-budget`
- Key badge, status/priority badges, summary H3, project · type
- Open in Jira if `jira_browse_url`
- Issue details card (fields from `issue`)
- Timeline / important dates / work info when present
- Labels/components if present on row
- Collapsible Raw JIRA Data (`<pre>{JSON.stringify(issue.raw_jira_data, null, 2)}</pre>`); auto-expand if `?debug=true` or `?raw=true`
- 404 / error states

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @momus/web typecheck
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/bug-budget/\[id\] apps/web/components/bug-budget/issue-detail.tsx
git commit -m "feat(web): bug budget issue detail page"
```

---

### Task 8: Verification

- [ ] **Step 1: Domain tests**

```bash
pnpm --filter @momus/domain test
```

- [ ] **Step 2: Web typecheck**

```bash
pnpm --filter @momus/web typecheck
```

- [ ] **Step 3: Checklist vs spec**

Confirm: header, stats click, severity, filters debounce/pushState, table columns/CSV, both summaries, detail, empty/error/loading.

- [ ] **Step 4: Final commit only if fixes needed**

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| Client dashboard + URL debounce | 6 |
| Header actions | 5, 6 |
| Stat cards + patches | 1, 5 |
| Severity panel | 5 |
| Filters + options | 1, 2, 5 |
| Table / columns / pagination / Jira | 3, 5 |
| Summary modals + year=all | 2, 5 |
| Detail page | 7 |
| CSV export | 5–6 |
| M-01/04/05/06/09/10/19/20 | 5–6 |
| CSS tokens | 4 |
| filter_options API gap | 2 |

**Jira Key URL:** use `{jira_browse_base}/{jira_key}` (base already includes `/browse`).
