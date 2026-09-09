# Tracker People Filters + Column Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Reporter/Creator/Owner filters (dropdown + text, URL-backed) and clickable asc/desc sort on all Defect Tracker table headers.

**Architecture:** Extend domain `TrackerFilterParams` + `applyTrackerFilters` + new `sortTrackerRows`. Build people option lists from the full tracker row set. Wire URL parse/serialize, advanced filter UI, sortable `<th>`, and `/api/tracker` filter → sort → paginate.

**Tech Stack:** TypeScript, Vitest, `@momus/domain`, Next.js 15 tracker UI, existing `apiJson` / URL state.

**Spec:** `docs/superpowers/specs/2026-09-09-tracker-people-filters-sort-design.md`

## Global Constraints

- Client-side on `listForFilters()` result — no SQL ORDER BY / WHERE for these features
- Owner filter/display key = `firstNonEmpty(owner, tester_assignee)`; empty → `Unassigned`
- One string param each: `reporter`, `creator`, `owner` (dropdown and text share the same draft string)
- Exact match if param equals a distinct option from the full row set; else case-insensitive contains; `Unassigned` matches empty
- Sort URL: `sort` + `direction` (`asc`|`desc`); toggle only (no clear-on-third); nulls/empty last
- No new API routes; no Bug Budget filter changes; no golden-fixture weakening

---

## File structure

| Path | Responsibility |
|---|---|
| `packages/domain/src/tracker/types.ts` | Params: `reporter`, `creator`, `owner`, `sort`, `direction` |
| `packages/domain/src/tracker/filter.ts` | People match + `trackerOwnerKey` + `extractTrackerPeopleOptions` |
| `packages/domain/src/tracker/sort.ts` | `TRACKER_SORT_COLUMNS`, `sortTrackerRows` |
| `packages/domain/src/tracker/filter.test.ts` | People filter tests (new or extend `m2.test.ts` — prefer dedicated file) |
| `packages/domain/src/tracker/sort.test.ts` | Sort tests |
| `packages/domain/src/index.ts` | Re-export sort module |
| `apps/web/lib/tracker-params.ts` | Parse/serialize new query keys |
| `apps/web/lib/tracker-params.test.ts` | Round-trip tests |
| `apps/web/app/api/tracker/route.ts` | People options + sort before slice |
| `apps/web/components/tracker/tracker-filters.tsx` | People controls + chips |
| `apps/web/components/tracker/tracker-table.tsx` | Sortable headers |
| `apps/web/components/tracker/defect-tracker-dashboard.tsx` | Pass sort + people options through state/URL |
| `apps/web/app/globals.css` | Sortable th / people filter row styles |

---

### Task 1: Domain — people filter helpers + applyTrackerFilters

**Files:**
- Modify: `packages/domain/src/tracker/types.ts`
- Modify: `packages/domain/src/tracker/filter.ts`
- Create: `packages/domain/src/tracker/filter-people.test.ts`

**Interfaces:**
- Produces:
  - `TrackerFilterParams` includes `reporter?`, `creator?`, `owner?`, `sort?`, `direction?: 'asc' | 'desc' | null`
  - `trackerOwnerKey(row): string` → resolved owner or `'Unassigned'`
  - `extractTrackerPeopleOptions(rows): { reporters: string[]; creators: string[]; owners: string[] }`
  - `applyTrackerFilters` applies people rules using distinct options computed from the **input `rows`** at call time

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  applyTrackerFilters,
  extractTrackerPeopleOptions,
  trackerOwnerKey,
} from './filter';
import type { TrackerIssueRow } from './types';

const base: TrackerIssueRow = {
  jira_key: 'BUG-1',
  project: 'AF',
  summary: 'x',
  has_linked_test_execution: false,
  created_year: 2026,
};

describe('tracker people filters', () => {
  it('trackerOwnerKey prefers owner then tester_assignee then Unassigned', () => {
    expect(trackerOwnerKey({ ...base, owner: 'Ada', tester_assignee: 'Bob' })).toBe('Ada');
    expect(trackerOwnerKey({ ...base, owner: null, tester_assignee: 'Bob' })).toBe('Bob');
    expect(trackerOwnerKey({ ...base, owner: '  ', tester_assignee: null })).toBe('Unassigned');
  });

  it('extractTrackerPeopleOptions returns sorted distinct people', () => {
    const opts = extractTrackerPeopleOptions([
      { ...base, reporter: 'Ann', creator: 'Carl', owner: null, tester_assignee: 'Dana' },
      { ...base, reporter: 'Bob', creator: 'Carl', owner: 'Eve', tester_assignee: null },
      { ...base, reporter: 'Ann', creator: null, owner: null, tester_assignee: null },
    ]);
    expect(opts.reporters).toEqual(['Ann', 'Bob']);
    expect(opts.creators).toEqual(['Carl']);
    expect(opts.owners).toEqual(['Dana', 'Eve']);
  });

  it('exact option match is case-sensitive equality', () => {
    const rows = [
      { ...base, jira_key: 'A', reporter: 'Alice' },
      { ...base, jira_key: 'B', reporter: 'alice' },
    ];
    expect(applyTrackerFilters(rows, { tab: 'all', reporter: 'Alice' }).map((r) => r.jira_key)).toEqual([
      'A',
    ]);
  });

  it('non-option text uses case-insensitive contains', () => {
    const rows = [
      { ...base, jira_key: 'A', creator: 'Catherine' },
      { ...base, jira_key: 'B', creator: 'Dan' },
    ];
    expect(applyTrackerFilters(rows, { tab: 'all', creator: 'cath' }).map((r) => r.jira_key)).toEqual([
      'A',
    ]);
  });

  it('owner Unassigned and owner‖tester_assignee', () => {
    const rows = [
      { ...base, jira_key: 'A', owner: null, tester_assignee: null },
      { ...base, jira_key: 'B', owner: null, tester_assignee: 'Pat' },
      { ...base, jira_key: 'C', owner: 'Pat', tester_assignee: 'Other' },
    ];
    expect(applyTrackerFilters(rows, { tab: 'all', owner: 'Unassigned' }).map((r) => r.jira_key)).toEqual([
      'A',
    ]);
    expect(applyTrackerFilters(rows, { tab: 'all', owner: 'Pat' }).map((r) => r.jira_key)).toEqual([
      'B',
      'C',
    ]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter @momus/domain test -- src/tracker/filter-people.test.ts`

- [ ] **Step 3: Implement**

In `types.ts`, add to `TrackerFilterParams`:

```ts
  reporter?: string | null;
  creator?: string | null;
  owner?: string | null;
  sort?: string | null;
  direction?: 'asc' | 'desc' | null;
```

In `filter.ts`:

```ts
export function trackerOwnerKey(row: TrackerIssueRow): string {
  return firstNonEmpty(row.owner, row.tester_assignee) ?? 'Unassigned';
}

export function extractTrackerPeopleOptions(rows: TrackerIssueRow[]): {
  reporters: string[];
  creators: string[];
  owners: string[];
} {
  const uniq = (values: Array<string | null | undefined>) =>
    [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) =>
      a.localeCompare(b),
    );
  return {
    reporters: uniq(rows.map((r) => r.reporter)),
    creators: uniq(rows.map((r) => r.creator)),
    owners: uniq(
      rows.map((r) => {
        const k = trackerOwnerKey(r);
        return k === 'Unassigned' ? null : k;
      }),
    ),
  };
}

function matchPeople(
  resolved: string | null | undefined,
  param: string,
  exactOptions: Set<string>,
): boolean {
  const needle = param.trim();
  if (!needle) return true;
  const value = resolved?.trim() ? resolved.trim() : 'Unassigned';
  if (needle === 'Unassigned') return value === 'Unassigned';
  if (exactOptions.has(needle)) return value === needle;
  return value.toLowerCase().includes(needle.toLowerCase());
}
```

At start of `applyTrackerFilters`, build option sets from `rows`, then after existing filters:

```ts
  const people = extractTrackerPeopleOptions(rows);
  const reporterOpts = new Set(people.reporters);
  const creatorOpts = new Set(people.creators);
  const ownerOpts = new Set(people.owners);

  if (params.reporter?.trim()) {
    out = out.filter((row) => matchPeople(row.reporter, params.reporter!, reporterOpts));
  }
  if (params.creator?.trim()) {
    out = out.filter((row) => matchPeople(row.creator, params.creator!, creatorOpts));
  }
  if (params.owner?.trim()) {
    out = out.filter((row) =>
      matchPeople(trackerOwnerKey(row), params.owner!, ownerOpts),
    );
  }
```

Note: `matchPeople` for owner already resolves via `trackerOwnerKey` which returns `'Unassigned'` — pass that string as `resolved`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/tracker/types.ts packages/domain/src/tracker/filter.ts packages/domain/src/tracker/filter-people.test.ts
git commit -m "feat(domain): tracker people filters for reporter/creator/owner"
```

---

### Task 2: Domain — sortTrackerRows

**Files:**
- Create: `packages/domain/src/tracker/sort.ts`
- Create: `packages/domain/src/tracker/sort.test.ts`
- Modify: `packages/domain/src/index.ts` — `export * from './tracker/sort'`

**Interfaces:**
- Consumes: `TrackerIssueRow`, `trackerOwnerKey`, `getMissingFields` / display helpers as needed
- Produces:
  - `TRACKER_SORT_DIRECTIONS = ['asc', 'desc'] as const`
  - `TrackerSortDirection = 'asc' | 'desc'`
  - `TRACKER_SORT_COLUMNS` (readonly string array of allowed ids)
  - `isTrackerSortColumn(value: string): value is …`
  - `sortTrackerRows(rows, sort, direction): TrackerIssueRow[]`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { sortTrackerRows } from './sort';
import type { TrackerIssueRow } from './types';

const row = (partial: Partial<TrackerIssueRow> & Pick<TrackerIssueRow, 'jira_key'>): TrackerIssueRow => ({
  project: 'AF',
  summary: 's',
  has_linked_test_execution: false,
  ...partial,
});

describe('sortTrackerRows', () => {
  it('returns same order when sort missing', () => {
    const rows = [row({ jira_key: 'B' }), row({ jira_key: 'A' })];
    expect(sortTrackerRows(rows, null, 'asc').map((r) => r.jira_key)).toEqual(['B', 'A']);
  });

  it('sorts jira_key asc and desc', () => {
    const rows = [row({ jira_key: 'B-2' }), row({ jira_key: 'A-1' }), row({ jira_key: 'C-3' })];
    expect(sortTrackerRows(rows, 'jira_key', 'asc').map((r) => r.jira_key)).toEqual([
      'A-1',
      'B-2',
      'C-3',
    ]);
    expect(sortTrackerRows(rows, 'jira_key', 'desc').map((r) => r.jira_key)).toEqual([
      'C-3',
      'B-2',
      'A-1',
    ]);
  });

  it('puts null/empty last in both directions for summary', () => {
    const rows = [
      row({ jira_key: 'A', summary: '' }),
      row({ jira_key: 'B', summary: 'Beta' }),
      row({ jira_key: 'C', summary: 'Alpha' }),
    ];
    expect(sortTrackerRows(rows, 'summary', 'asc').map((r) => r.jira_key)).toEqual(['C', 'B', 'A']);
    expect(sortTrackerRows(rows, 'summary', 'desc').map((r) => r.jira_key)).toEqual(['B', 'C', 'A']);
  });

  it('sorts created_date chronologically', () => {
    const rows = [
      row({ jira_key: 'A', created_date: '2026-03-01' }),
      row({ jira_key: 'B', created_date: '2026-01-15' }),
      row({ jira_key: 'C', created_date: null }),
    ];
    expect(sortTrackerRows(rows, 'created_date', 'asc').map((r) => r.jira_key)).toEqual([
      'B',
      'A',
      'C',
    ]);
  });

  it('sorts owner via owner‖tester_assignee', () => {
    const rows = [
      row({ jira_key: 'A', owner: null, tester_assignee: 'Zoe' }),
      row({ jira_key: 'B', owner: 'Ann', tester_assignee: null }),
    ];
    expect(sortTrackerRows(rows, 'owner', 'asc').map((r) => r.jira_key)).toEqual(['B', 'A']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm --filter @momus/domain test -- src/tracker/sort.test.ts`

- [ ] **Step 3: Implement `sort.ts`**

Include column ids from the spec. Implement `sortKey(row, column): { empty: boolean; value: string | number }` — dates as timestamp number; strings lowercased for compare; owner uses `trackerOwnerKey`; linked_issues/labels/missing_fields as stable joined display strings (reuse simple JSON/stringify or existing formatters inline).

```ts
export function sortTrackerRows(
  rows: TrackerIssueRow[],
  sort: string | null | undefined,
  direction: 'asc' | 'desc' | null | undefined,
): TrackerIssueRow[] {
  if (!sort || !isTrackerSortColumn(sort)) return rows;
  const dir = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const ka = sortKey(a, sort);
    const kb = sortKey(b, sort);
    if (ka.empty && kb.empty) return a.jira_key.localeCompare(b.jira_key);
    if (ka.empty) return 1;
    if (kb.empty) return -1;
    if (ka.value < kb.value) return -1 * dir;
    if (ka.value > kb.value) return 1 * dir;
    return a.jira_key.localeCompare(b.jira_key);
  });
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/tracker/sort.ts packages/domain/src/tracker/sort.test.ts packages/domain/src/index.ts
git commit -m "feat(domain): sortTrackerRows for defect tracker columns"
```

---

### Task 3: URL params + API route

**Files:**
- Modify: `apps/web/lib/tracker-params.ts`
- Create: `apps/web/lib/tracker-params.test.ts`
- Modify: `apps/web/app/api/tracker/route.ts`

**Interfaces:**
- Consumes: domain people options + `sortTrackerRows`, `isTrackerSortColumn`
- Produces: URL round-trip for people + sort; API `filter_options.reporters|creators|owners`

- [ ] **Step 1: Failing params tests**

```ts
import { describe, expect, it } from 'vitest';
import { trackerParamsFromUrl, trackerParamsToQuery } from './tracker-params';

describe('tracker people/sort params', () => {
  it('round-trips reporter creator owner sort direction', () => {
    const qs = trackerParamsToQuery({
      tab: 'all',
      year: '2026',
      reporter: 'Ann',
      creator: 'Bob',
      owner: 'Unassigned',
      sort: 'jira_key',
      direction: 'desc',
      page: 1,
      page_size: 50,
    });
    const parsed = trackerParamsFromUrl(new URL(`http://x.local${qs}`));
    expect(parsed.reporter).toBe('Ann');
    expect(parsed.creator).toBe('Bob');
    expect(parsed.owner).toBe('Unassigned');
    expect(parsed.sort).toBe('jira_key');
    expect(parsed.direction).toBe('desc');
  });

  it('drops invalid direction and unknown sort', () => {
    const parsed = trackerParamsFromUrl(
      new URL('http://x.local/tracker?year=2026&sort=not_a_col&direction=sideways'),
    );
    expect(parsed.sort).toBeUndefined();
    expect(parsed.direction).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (or fail on assertions)

Run: `pnpm --filter @momus/web test -- lib/tracker-params.test.ts`

- [ ] **Step 3: Update `tracker-params.ts`**

Import `isTrackerSortColumn` from domain. Parse `reporter`/`creator`/`owner` via `get()`. Parse `sort` only if `isTrackerSortColumn`; `direction` only if `asc`|`desc`. Serialize when present.

- [ ] **Step 4: Update `/api/tracker/route.ts`**

```ts
import {
  applyTrackerFilters,
  countTrackerProjects,
  extractFilterOptions,
  extractTrackerPeopleOptions,
  sortTrackerRows,
  // ...
} from '@momus/domain';

// after building `all`:
const people = extractTrackerPeopleOptions(all);
const filter_options = {
  projects: opts.projects,
  years: yearsDesc,
  missing_fields: missing_field_options,
  reporters: people.reporters,
  creators: people.creators,
  owners: people.owners,
};

const filtered = applyTrackerFilters(all, withExcluded);
const sorted = sortTrackerRows(filtered, params.sort, params.direction);
const total = sorted.length;
const rows = sorted.slice(start, start + pageSize);
```

- [ ] **Step 5: Run domain + web tests — PASS**

```bash
pnpm --filter @momus/domain test -- src/tracker/
pnpm --filter @momus/web test -- lib/tracker-params.test.ts
pnpm --filter @momus/web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/tracker-params.ts apps/web/lib/tracker-params.test.ts apps/web/app/api/tracker/route.ts
git commit -m "feat(tracker): URL + API for people filters and sort"
```

---

### Task 4: Filter UI + chips + dashboard options

**Files:**
- Modify: `apps/web/components/tracker/tracker-filters.tsx`
- Modify: `apps/web/components/tracker/defect-tracker-dashboard.tsx`
- Modify: `apps/web/app/globals.css` (people filter layout)

**Interfaces:**
- Consumes: `filter_options.reporters|creators|owners`
- Produces: draft/apply for people fields; chips removable

- [ ] **Step 1: Extend `FilterOptions` type in filters + dashboard `TrackerResponse`**

```ts
reporters?: string[];
creators?: string[];
owners?: string[];
```

- [ ] **Step 2: Add people field UI helper inside `tracker-filters.tsx`**

For each of Reporter / Creator / Owner:

```tsx
<label className="field">
  <span>Reporter</span>
  <select
    value={
      (draft.reporter && reporters.includes(draft.reporter)) || draft.reporter === 'Unassigned'
        ? draft.reporter
        : draft.reporter
          ? '__custom__'
          : ''
    }
    onChange={(e) => {
      const v = e.target.value;
      if (v === '__custom__') return;
      onDraftChange({ reporter: v || undefined, page: 1 });
    }}
  >
    <option value="">All</option>
    <option value="Unassigned">Unassigned</option>
    {reporters.map((name) => (
      <option key={name} value={name}>{name}</option>
    ))}
  </select>
  <input
    type="search"
    placeholder="Or type to search…"
    value={draft.reporter ?? ''}
    onChange={(e) => onDraftChange({ reporter: e.target.value || undefined, page: 1 })}
  />
</label>
```

Simpler approved behavior (prefer this): **dropdown and text bind to the same `draft.reporter` string** — selecting a dropdown option sets the string; typing updates it; dropdown `value` is the draft if it matches an option or Unassigned/All, else show empty All while text still shows custom (or keep select uncontrolled display via `value={reporters.includes(draft) || draft==='Unassigned' ? draft : ''}` while text shows full draft). Implement the simpler shared-string pattern from the spec.

- [ ] **Step 3: Extend chip keys + remove handlers** for `reporter` | `creator` | `owner`

- [ ] **Step 4: Dashboard** — store people arrays from API in `filterOptions` state; ensure reset clears people params

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @momus/web typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/tracker/tracker-filters.tsx apps/web/components/tracker/defect-tracker-dashboard.tsx apps/web/app/globals.css
git commit -m "feat(tracker): people filter controls for reporter/creator/owner"
```

---

### Task 5: Sortable table headers

**Files:**
- Modify: `apps/web/components/tracker/tracker-table.tsx`
- Modify: `apps/web/components/tracker/defect-tracker-dashboard.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `sort`, `direction` from state; `onSortChange(columnId)`
- Produces: toggles via parent → URL → refetch

- [ ] **Step 1: Extend `TrackerTable` props**

```ts
  sort?: string | null;
  direction?: 'asc' | 'desc' | null;
  onSortChange: (column: string) => void;
```

- [ ] **Step 2: Add `SortableTh` helper in the same file**

```tsx
function SortableTh({
  column,
  label,
  sort,
  direction,
  onSortChange,
}: {
  column: string;
  label: string;
  sort?: string | null;
  direction?: 'asc' | 'desc' | null;
  onSortChange: (column: string) => void;
}) {
  const active = sort === column;
  const ariaSort = !active ? 'none' : direction === 'desc' ? 'descending' : 'ascending';
  return (
    <th aria-sort={ariaSort}>
      <button type="button" className="bb-tracker-sort-th" onClick={() => onSortChange(column)}>
        {label}
        <span className="bb-tracker-sort-th__ind" aria-hidden>
          {active ? (direction === 'desc' ? '▼' : '▲') : '↕'}
        </span>
      </button>
    </th>
  );
}
```

Replace every data `<th>` in both views with `SortableTh` using the column ids from the domain list.

- [ ] **Step 3: Dashboard `onSortChange`**

```ts
const onSortChange = (column: string) => {
  setState((prev) => {
    const nextDir =
      prev.sort === column && prev.direction === 'asc' ? 'desc' : 'asc';
    return { ...prev, sort: column, direction: nextDir, page: 1 };
  });
};
```

Pass into `TrackerTable`.

- [ ] **Step 4: CSS for `.bb-tracker-sort-th`** — borderless button, inherit font, flex label + indicator, muted inactive indicator

- [ ] **Step 5: Manual smoke** on `http://localhost:3000/tracker?year=2026`

1. Open advanced filters — set Reporter from dropdown; Apply — rows narrow; chip appears  
2. Type partial Creator text; Apply — contains match  
3. Owner Unassigned works  
4. Click JIRA Key header — URL has `sort=jira_key&direction=asc`; click again → `desc`  
5. Pagination still coherent  

- [ ] **Step 6: Typecheck + tests**

```bash
pnpm --filter @momus/domain test -- src/tracker/
pnpm --filter @momus/web test
pnpm --filter @momus/web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/tracker/tracker-table.tsx apps/web/components/tracker/defect-tracker-dashboard.tsx apps/web/app/globals.css
git commit -m "feat(tracker): sortable column headers with URL state"
```

---

## Spec coverage self-review

| Spec item | Task |
|---|---|
| reporter/creator/owner params + match rules | 1 |
| Owner ‖ tester_assignee + Unassigned | 1 |
| extract people options | 1, 3 |
| sortTrackerRows + nulls last | 2 |
| URL sort/direction + people | 3 |
| API filter→sort→slice | 3 |
| Filter UI shared string + chips | 4 |
| All sortable headers + toggle | 5 |
| Domain/params tests | 1, 2, 3 |

No placeholders remaining after implementation steps above.
