# Leaderboard SSR + Slim Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SSR initial leaderboard data into `/leaderboard` and load only narrow, period-scoped rows from `bug_budget`.

**Architecture:** Add `listForLeaderboard(range)` on `BugBudgetQueryRepository` (14 columns + optional `created_date` window). Share `loadLeaderboard(params)` between the API and an async `page.tsx`. Client dashboard seeds from `initialData` and skips the first duplicate fetch.

**Tech Stack:** TypeScript, Vitest, Next.js 15 App Router, Supabase JS client, `@momus/domain` period helpers.

**Spec:** `docs/superpowers/specs/2026-07-13-leaderboard-ssr-slim-query-design.md`

---

## File map

| Path | Role |
|---|---|
| `packages/infra/src/supabase/bug-budget-query.ts` | `LEADERBOARD_COLUMNS`, `listForLeaderboard`, date bound helper |
| `packages/infra/src/supabase/bug-budget-query.leaderboard.test.ts` | Unit tests for column list + date bound helper (no live DB) |
| `apps/web/lib/load-leaderboard.ts` | Shared auth + query + `computeLeaderboard` + filter_options |
| `apps/web/app/api/leaderboard/route.ts` | Use shared loader + `listForLeaderboard` |
| `apps/web/app/api/leaderboard/reporter-issues/route.ts` | Use `listForLeaderboard` with same period range |
| `apps/web/app/leaderboard/page.tsx` | Async SSR: parse params, load, pass props |
| `apps/web/components/leaderboard/leaderboard-dashboard.tsx` | Accept `initialData` / `initialParams`; skip first refetch |
| `apps/web/lib/leaderboard-params.ts` | Optional helper to parse Next `searchParams` Record |

---

### Task 1: Infra — `listForLeaderboard` + date bounds

**Files:**
- Modify: `packages/infra/src/supabase/bug-budget-query.ts`
- Create: `packages/infra/src/supabase/bug-budget-query.leaderboard.test.ts`

- [ ] **Step 1: Write failing tests for column constant + exclusive end bound**

```ts
import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_COLUMNS,
  exclusiveEndAfterInclusiveYmd,
} from './bug-budget-query';

describe('leaderboard query helpers', () => {
  it('selects exactly the 14 leaderboard fields', () => {
    const cols = LEADERBOARD_COLUMNS.split(',').map((s) => s.trim());
    expect(cols).toEqual([
      'reporter',
      'issue_type',
      'project',
      'status',
      'created_date',
      'jira_key',
      'summary',
      'severity_issue',
      'priority',
      'parent',
      'service_feature',
      'ac_related_labels',
      'tester_assignee',
      'owner',
    ]);
  });

  it('maps inclusive YYYY-MM-DD end to exclusive next-day bound', () => {
    expect(exclusiveEndAfterInclusiveYmd('2026-06-30')).toBe('2026-07-01');
    expect(exclusiveEndAfterInclusiveYmd('2026-12-31')).toBe('2027-01-01');
  });
});
```

- [ ] **Step 2:** `pnpm --filter @momus/infra test -- bug-budget-query.leaderboard` → FAIL (exports missing)

- [ ] **Step 3: Implement helpers + method**

In `bug-budget-query.ts`:

```ts
import type { DateRange } from '@momus/domain';

export const LEADERBOARD_COLUMNS =
  'reporter, issue_type, project, status, created_date, jira_key, summary, severity_issue, priority, parent, service_feature, ac_related_labels, tester_assignee, owner';

/** Inclusive end YYYY-MM-DD → exclusive lower-bound for PostgREST `lt` (parity with dateInRange slice). */
export function exclusiveEndAfterInclusiveYmd(endYmd: string): string {
  const [y, m, d] = endYmd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// inside BugBudgetQueryRepository:
async listForLeaderboard(range: DateRange | null): Promise<BugBudgetListRow[]> {
  return fetchAllPages(async (from, to) => {
    let q = this.db.from('bug_budget').select(LEADERBOARD_COLUMNS).range(from, to);
    if (range) {
      q = q
        .gte('created_date', range.start)
        .lt('created_date', exclusiveEndAfterInclusiveYmd(range.end));
    }
    const { data, error } = await q;
    if (error) throw new Error(`listForLeaderboard failed: ${error.message}`);
    return (data ?? []) as BugBudgetListRow[];
  });
}
```

Keep `listAllForFilters` unchanged.

- [ ] **Step 4:** Re-run infra test → PASS

- [ ] **Step 5:** Commit `feat(infra): add listForLeaderboard with narrow columns and period bounds`

---

### Task 2: Shared `loadLeaderboard` + API routes

**Files:**
- Create: `apps/web/lib/load-leaderboard.ts`
- Modify: `apps/web/app/api/leaderboard/route.ts`
- Modify: `apps/web/app/api/leaderboard/reporter-issues/route.ts`

- [ ] **Step 1: Add shared loader**

```ts
import {
  availableYears,
  computeLeaderboard,
  defaultPeriodForType,
  resolvePeriodRange,
  type LeaderboardFilterParams,
  type LeaderboardIssueRow,
  type LeaderboardResult,
} from '@momus/domain';
import { BugBudgetQueryRepository, createServerClient } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { mapBugBudgetToLeaderboardRow } from '@/lib/leaderboard-map';

export type LeaderboardPayload = LeaderboardResult & {
  success: true;
  filter_options: {
    years: number[];
    period_types: { value: string; label: string }[];
  };
};

export async function loadLeaderboard(
  params: LeaderboardFilterParams,
  nowIso = new Date().toISOString(),
): Promise<{ data: LeaderboardPayload } | { error: Response }> {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return { error: auth.error };

  const period_type = params.period_type ?? 'quarterly';
  const year = Number(params.year) || new Date(nowIso).getUTCFullYear();
  const period = params.period?.trim() || defaultPeriodForType(period_type, nowIso);
  const range = resolvePeriodRange(year, period_type, period);

  const repo = new BugBudgetQueryRepository(createServerClient());
  const all = await repo.listForLeaderboard(range);
  const rows: LeaderboardIssueRow[] = all.map(mapBugBudgetToLeaderboardRow);
  const board = computeLeaderboard(rows, params, nowIso);

  return {
    data: {
      success: true,
      ...board,
      filter_options: {
        years: availableYears(nowIso),
        period_types: [
          { value: 'all', label: 'All Time' },
          { value: 'yearly', label: 'Yearly' },
          { value: 'semester', label: 'Semester' },
          { value: 'quarterly', label: 'Quarterly' },
        ],
      },
    },
  };
}
```

Note: `computeLeaderboard` still re-applies the window in memory (parity). SQL pre-filter only reduces payload.

- [ ] **Step 2: Thin API route**

```ts
export async function GET(request: Request) {
  const params = leaderboardParamsFromUrl(new URL(request.url));
  const result = await loadLeaderboard(params);
  if ('error' in result) return result.error;
  return jsonOk(result.data);
}
```

(`jsonOk` already wraps success — if double `success`, strip `success` from payload or use `NextResponse.json(result.data)`. Match existing `jsonOk` shape: inspect `jsonOk` and pass `{ ...board, filter_options }` without nesting duplicate success.)

- [ ] **Step 3: Update reporter-issues**

Resolve range the same way (`defaultPeriodForType` + `resolvePeriodRange`), call `listForLeaderboard(range)`, then existing `filterReporterDrilldown`.

- [ ] **Step 4:** `pnpm --filter @momus/domain test` + `pnpm --filter @momus/web typecheck`

- [ ] **Step 5:** Commit `feat(web): share loadLeaderboard and slim API queries`

---

### Task 3: SSR page + client skip-refetch

**Files:**
- Modify: `apps/web/app/leaderboard/page.tsx`
- Modify: `apps/web/components/leaderboard/leaderboard-dashboard.tsx`
- Modify: `apps/web/lib/leaderboard-params.ts` (add `leaderboardParamsFromSearchParams` if helpful)

- [ ] **Step 1: Server page**

```tsx
import { redirect } from 'next/navigation';
import { LeaderboardDashboard } from '@/components/leaderboard/leaderboard-dashboard';
import { leaderboardParamsFromUrl } from '@/lib/leaderboard-params';
import { loadLeaderboard } from '@/lib/load-leaderboard';

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LeaderboardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const url = new URL('http://local/leaderboard');
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') url.searchParams.set(k, v);
    else if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, item);
  }
  const params = leaderboardParamsFromUrl(url);
  if (!params.period_type) params.period_type = 'quarterly';

  const result = await loadLeaderboard(params);
  if ('error' in result) {
    redirect(`/sign-in?next=${encodeURIComponent('/leaderboard' + url.search)}`);
  }

  return (
    <LeaderboardDashboard initialData={result.data} initialParams={params} />
  );
}
```

(If auth error is 403 pending, prefer middleware behavior — redirect sign-in is fine for 401.)

- [ ] **Step 2: Dashboard props**

```tsx
type Props = {
  initialData?: LeaderboardResponse;
  initialParams?: LeaderboardFilterParams;
};

export function LeaderboardDashboard({ initialData, initialParams }: Props = {}) {
  const [state, setState] = useState<LeaderboardFilterParams>(
    initialParams ?? { period_type: 'quarterly' },
  );
  const [draft, setDraft] = useState(...same...);
  const [data, setData] = useState<LeaderboardResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  // ...
```

On mount `useEffect`:
- If `initialData` provided: set `ready.current = true`, set `lastFetchedQs.current = leaderboardParamsToQuery(initialParams ?? state)`, do **not** call `fetchData` on first run.
- Else: existing fetch path.

Suppress the second `useEffect` (pushState/fetch) from refetching on first hydrate when `suppressPush` / matching qs already set.

- [ ] **Step 3:** Typecheck web; manually sanity-check: load `/leaderboard` should not fire `/api/leaderboard` until filter Apply.

- [ ] **Step 4:** Commit `feat(web): SSR leaderboard initial data and skip first client fetch`

---

### Task 4: Verify

- [ ] `pnpm --filter @momus/infra test`
- [ ] `pnpm --filter @momus/domain test`
- [ ] `pnpm --filter @momus/web typecheck`
- [ ] Confirm reporter drill still works (still hits API; uses slim query)

---

## Spec coverage

| Spec item | Task |
|---|---|
| `listForLeaderboard` 14 cols | Task 1 |
| Period date bounds when ≠ all | Task 1–2 |
| Shared loader | Task 2 |
| API uses slim query | Task 2 |
| reporter-issues uses slim query | Task 2 |
| SSR page + initialData | Task 3 |
| Skip first client refetch | Task 3 |
| Leave `listAllForFilters` alone | Task 1 |

## Execution

Prefer **inline execution** in this session (executing-plans style). Start Task 1 immediately.
