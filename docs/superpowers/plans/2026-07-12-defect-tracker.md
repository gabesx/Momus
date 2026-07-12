# Defect Tracker (Momus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Momus Defect Tracker (`/tracker`) with filtered tabs (All / Missing fields / No linked test), inline Momus write-backs for four fields, and sync-safe `tracker_overrides` — without redesigning Analytics or Bug Budget.

**Architecture:** Pure rules in `packages/domain/src/tracker/*`; additive `bug_budget.tracker_overrides` JSONB; infra list/PATCH + upsert that skips overridden columns; Next.js `/tracker` + `/api/tracker` using existing `AppHeader`, auth, CSRF, and `bb-*` UI.

**Tech Stack:** TypeScript, Vitest, Next.js App Router, Supabase migrations, Inngest sync path via `BugBudgetRepository.upsertMany`.

**Spec:** `docs/superpowers/specs/2026-07-12-defect-tracker-design.md`

**Branch:** implement on `feat/defect-tracker` off latest `master` (spec/plan may live on `docs/defect-tracker-design` first).

---

## File map

| Path | Role |
|---|---|
| `supabase/migrations/20260712000000_tracker_overrides.sql` | Additive `tracker_overrides` column |
| `packages/domain/src/tracker/types.ts` | Filter/tab/patch/override types |
| `packages/domain/src/tracker/overrides.ts` | Merge overrides + omit keys for sync |
| `packages/domain/src/tracker/missing-fields.ts` | Missing-field detection (legacy field set) |
| `packages/domain/src/tracker/filter.ts` | Apply filters + tab membership |
| `packages/domain/src/tracker/patch.ts` | Validate PATCH body |
| `packages/domain/src/tracker/*.test.ts` | Vitest |
| `packages/domain/src/index.ts` | Re-exports |
| `packages/infra/src/supabase/bug-budget.repository.ts` | Upsert respects overrides |
| `packages/infra/src/supabase/tracker.repository.ts` | List + patch for Tracker API |
| `packages/infra/src/supabase/cache.ts` | Bump `defect_tracker` cache version |
| `apps/web/app/api/tracker/route.ts` | `GET` list |
| `apps/web/app/api/tracker/[jiraKey]/route.ts` | `PATCH` fields |
| `apps/web/app/tracker/page.tsx` | Page shell |
| `apps/web/components/tracker/*` | Filters, tabs, table, inline cells |
| `apps/web/components/layout/app-header.tsx` | Nav item |
| `docs/migration/bb-mig-05-downstream-cutover.md` | Disposition → rebuild in Momus |

---

### Task 1: M1 — Types, migration, override helpers

**Files:**
- Create: `supabase/migrations/20260712000000_tracker_overrides.sql`
- Create: `packages/domain/src/tracker/types.ts`
- Create: `packages/domain/src/tracker/overrides.ts`
- Create: `packages/domain/src/tracker/overrides.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing override tests**

```ts
// packages/domain/src/tracker/overrides.test.ts
import { describe, expect, it } from 'vitest';
import {
  TRACKER_EDITABLE_FIELDS,
  mergeTrackerOverrides,
  omitOverriddenFields,
} from './overrides';

describe('tracker overrides', () => {
  it('lists exactly four editable fields', () => {
    expect([...TRACKER_EDITABLE_FIELDS].sort()).toEqual(
      ['linked_issues', 'parent', 'service_feature', 'severity_issue'].sort(),
    );
  });

  it('mergeTrackerOverrides sets at/by for patched keys', () => {
    const next = mergeTrackerOverrides(
      {},
      { severity_issue: 'Critical' },
      { at: '2026-07-12T00:00:00.000Z', by: '9' },
    );
    expect(next.severity_issue).toEqual({ at: '2026-07-12T00:00:00.000Z', by: '9' });
    expect(next.parent).toBeUndefined();
  });

  it('omitOverriddenFields strips overridden keys from payload', () => {
    const payload = {
      jira_key: 'BUG-1',
      severity_issue: 'Major',
      parent: 'EPIC-1',
      status: 'Open',
    };
    const out = omitOverriddenFields(payload, {
      severity_issue: { at: 't', by: '1' },
    });
    expect(out.severity_issue).toBeUndefined();
    expect(out.parent).toBe('EPIC-1');
    expect(out.status).toBe('Open');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @momus/domain exec vitest run src/tracker/overrides.test.ts
```

Expected: fail (module not found).

- [ ] **Step 3: Implement types + overrides + migration**

```sql
-- supabase/migrations/20260712000000_tracker_overrides.sql
ALTER TABLE public.bug_budget
  ADD COLUMN IF NOT EXISTS tracker_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bug_budget.tracker_overrides IS
  'Momus Tracker field overrides: keys among parent|linked_issues|severity_issue|service_feature; values {at,by}. Sync must skip those columns.';
```

```ts
// packages/domain/src/tracker/types.ts
export const TRACKER_EDITABLE_FIELDS = [
  'parent',
  'linked_issues',
  'severity_issue',
  'service_feature',
] as const;

export type TrackerEditableField = (typeof TRACKER_EDITABLE_FIELDS)[number];

export type TrackerOverrideMeta = { at: string; by: string };
export type TrackerOverrides = Partial<Record<TrackerEditableField, TrackerOverrideMeta>>;

export type TrackerTab = 'all' | 'missing_fields' | 'no_linked_test';

export type TrackerFilterParams = {
  tab?: TrackerTab | null;
  year?: string | number | null;
  project?: string | null;
  issue_type?: 'bugs' | 'defects' | '' | null;
  q?: string | null; // search summary / jira_key
  missing_field?: string | null; // 'all' or a known missing-field key
  page?: number | null;
  page_size?: number | null;
};

export type TrackerIssueRow = {
  jira_key: string;
  project: string;
  summary: string;
  issue_type?: string | null;
  parent?: string | null;
  linked_issues?: unknown;
  severity_issue?: string | null;
  service_feature?: string | null;
  ac_related_labels?: string[] | null;
  tester_assignee?: string | null;
  has_linked_test_execution: boolean;
  created_year?: number | null;
  tracker_overrides?: TrackerOverrides | null;
};
```

```ts
// packages/domain/src/tracker/overrides.ts
import type { TrackerEditableField, TrackerOverrides } from './types';
import { TRACKER_EDITABLE_FIELDS } from './types';

export { TRACKER_EDITABLE_FIELDS };

export function mergeTrackerOverrides(
  current: TrackerOverrides,
  patch: Partial<Record<TrackerEditableField, unknown>>,
  meta: { at: string; by: string },
): TrackerOverrides {
  const next: TrackerOverrides = { ...current };
  for (const key of TRACKER_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      next[key] = { at: meta.at, by: meta.by };
    }
  }
  return next;
}

export function omitOverriddenFields<T extends Record<string, unknown>>(
  payload: T,
  overrides: TrackerOverrides | null | undefined,
): T {
  if (!overrides || Object.keys(overrides).length === 0) return payload;
  const out = { ...payload };
  for (const key of TRACKER_EDITABLE_FIELDS) {
    if (overrides[key]) delete out[key];
  }
  return out;
}
```

Export from `packages/domain/src/index.ts`: `export * from './tracker/types'; export * from './tracker/overrides';`

- [ ] **Step 4: Re-run tests — expect PASS**

```bash
pnpm --filter @momus/domain exec vitest run src/tracker/overrides.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260712000000_tracker_overrides.sql \
  packages/domain/src/tracker packages/domain/src/index.ts
git commit -m "feat(tracker): M1 tracker_overrides column and domain helpers"
```

---

### Task 2: M2 — Missing fields, filters, patch validation

**Files:**
- Create: `packages/domain/src/tracker/missing-fields.ts`
- Create: `packages/domain/src/tracker/filter.ts`
- Create: `packages/domain/src/tracker/patch.ts`
- Create: `packages/domain/src/tracker/m2.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing M2 tests**

```ts
// packages/domain/src/tracker/m2.test.ts
import { describe, expect, it } from 'vitest';
import { getMissingFields, isMissingFieldsRow } from './missing-fields';
import { applyTrackerFilters } from './filter';
import { parseTrackerPatch } from './patch';
import type { TrackerIssueRow } from './types';

const base: TrackerIssueRow = {
  jira_key: 'BUG-1',
  project: 'AF',
  summary: 'x',
  has_linked_test_execution: false,
  severity_issue: null,
  parent: null,
  service_feature: 'Checkout',
  ac_related_labels: [],
  tester_assignee: null,
  created_year: 2026,
};

describe('tracker M2', () => {
  it('detects missing severity/parent/tester', () => {
    const missing = getMissingFields(base, []);
    expect(missing).toEqual(
      expect.arrayContaining(['severity_issue', 'parent', 'tester_assignee']),
    );
    expect(missing).not.toContain('service_feature');
  });

  it('no_linked_test tab keeps only false/null flag', () => {
    const rows = [
      { ...base, jira_key: 'A', has_linked_test_execution: false },
      { ...base, jira_key: 'B', has_linked_test_execution: true },
    ];
    const out = applyTrackerFilters(rows, { tab: 'no_linked_test' });
    expect(out.map((r) => r.jira_key)).toEqual(['A']);
  });

  it('missing_fields tab uses isMissingFieldsRow', () => {
    expect(isMissingFieldsRow(base, [])).toBe(true);
    expect(
      isMissingFieldsRow({ ...base, severity_issue: 'Major', parent: 'P', tester_assignee: 't', ac_related_labels: ['ac'] }, []),
    ).toBe(false);
  });

  it('parseTrackerPatch rejects unknown keys', () => {
    const r = parseTrackerPatch({ severity_issue: 'Major', bogon: 1 });
    expect(r.ok).toBe(false);
  });

  it('parseTrackerPatch accepts editable subset', () => {
    const r = parseTrackerPatch({ parent: 'EPIC-1', severity_issue: 'Critical' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.parent).toBe('EPIC-1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @momus/domain exec vitest run src/tracker/m2.test.ts
```

- [ ] **Step 3: Implement**

Missing-field keys (parity with legacy `MissingFieldDetectionService::AVAILABLE_FIELDS`):

`summary`, `parent`, `ac_related_labels`, `service_feature`, `severity_issue`, `tester_assignee`.

Empty rules:
- string fields: null / `''` / whitespace-only
- `ac_related_labels`: null / empty array
- `summary`: same as string (rare)

```ts
// missing-fields.ts — export getMissingFields(row, excludedKeys), isMissingFieldsRow(row, excludedKeys)
// filter.ts — applyTrackerFilters(rows, params): filter by tab, year, project, issue_type (reuse BUG/DEFECT group lists from constants), q on jira_key/summary, optional missing_field key
// patch.ts — parseTrackerPatch(body): { ok: true, value } | { ok: false, message }
//   linked_issues: allow null, string (store as-is if product wants text), or JSON array; reject non-plain objects
```

For `issue_type` filter: prefer `issue_type` column; bugs = `BUG_GROUP_TYPES`, defects = `DEFECT_GROUP_TYPES` (same as Analytics).

- [ ] **Step 4: Tests PASS**

```bash
pnpm --filter @momus/domain test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(domain): tracker filters, missing fields, patch validation"
```

---

### Task 3: M3 — Infra sync skip + Tracker repository

**Files:**
- Modify: `packages/infra/src/supabase/bug-budget.repository.ts`
- Create: `packages/infra/src/supabase/bug-budget.repository.overrides.test.ts` (or extend existing tests)
- Create: `packages/infra/src/supabase/tracker.repository.ts`
- Modify: `packages/infra/src/supabase/cache.ts` — add `bumpDefectTrackerCacheVersion` (key `defect_tracker`)
- Wire bump on successful sync where `bumpBugBudgetCacheVersion` is already called

- [ ] **Step 1: Failing unit test for omit-on-upsert**

Pure-unit the merge path without Supabase: extract or test that before upsert, payload is passed through `omitOverriddenFields` with existing overrides loaded for that `jira_key`.

```ts
it('strips severity when override present before toDbInsert shape', () => {
  const existing = { severity_issue: { at: 't', by: '1' } };
  const insert = omitOverriddenFields(
    { ...toDbInsert(sampleRow), /* ensure severity set */ },
    existing,
  );
  expect(insert.severity_issue).toBeUndefined();
  expect(insert.tracker_overrides).toBeUndefined(); // upsert must never wipe overrides via transform row
});
```

Important: `toDbInsert` must **not** include `tracker_overrides` from the Jira-transformed `BugBudgetRow` (column stays DB-owned). Sync only updates Jira-derived columns minus omitted ones.

- [ ] **Step 2: Change `upsertMany`**

For each row:
1. `select('tracker_overrides').eq('jira_key', …).maybeSingle()`
2. `payload = omitOverriddenFields(toDbInsert(row), overrides)`
3. `upsert(payload, { onConflict: 'jira_key' })`  
   Do **not** write `tracker_overrides` in this path.

- [ ] **Step 3: `TrackerRepository`**

Methods:
- `listForFilters(): Promise<TrackerIssueRow[]>` — select columns needed by Tracker (include the four fields + missing-field inputs + `tracker_overrides` + `has_linked_test_execution`)
- `patchFields(jiraKey, patch, meta): Promise<TrackerIssueRow>` — load row; `mergeTrackerOverrides`; update columns + `tracker_overrides`; return row. Throw not-found.

- [ ] **Step 4: Cache**

```ts
export async function bumpDefectTrackerCacheVersion(db: SupabaseClient): Promise<number> {
  // same as bumpBugBudgetCacheVersion but key = 'defect_tracker'
}
```

Call both bumps (or a shared helper) on sync success.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(infra): tracker repo and sync skip for overrides"
```

---

### Task 4: M3 — API routes

**Files:**
- Create: `apps/web/app/api/tracker/route.ts`
- Create: `apps/web/app/api/tracker/[jiraKey]/route.ts`
- Create: `apps/web/lib/tracker-params.ts`

- [ ] **Step 1: `trackerParamsFromUrl`**

Parse `tab`, `year`, `project`, `issue_type`, `q`, `missing_field`, `page`, `page_size` (defaults: tab=`all`, page=1, page_size=50, max 100).

- [ ] **Step 2: `GET /api/tracker`**

```ts
const auth = await requireViewAnalytics();
// load rows via TrackerRepository.listForFilters()
// applyTrackerFilters for each tab to compute counts
// apply filters for active tab; paginate in memory for v1 (same scale as analytics listAll)
// return { success, rows, total, page, page_size, tab_counts: { all, missing_fields, no_linked_test }, filter_options, meta }
```

- [ ] **Step 3: `PATCH /api/tracker/[jiraKey]`**

```ts
assertCsrf(request);
requireViewAnalytics(); // or access_settings if product later tightens
const body = await request.json();
const parsed = parseTrackerPatch(body);
if (!parsed.ok) return jsonFail(parsed.message, 422);
const userId = String(auth.user.id);
const row = await repo.patchFields(jiraKey, parsed.value, {
  at: new Date().toISOString(),
  by: userId,
});
return jsonOk({ row });
```

404 when missing.

- [ ] **Step 4: Manual/typecheck**

```bash
pnpm --filter @momus/web exec tsc --noEmit
pnpm --filter @momus/domain test
pnpm --filter @momus/infra test
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): tracker GET/PATCH API"
```

---

### Task 5: M4 — `/tracker` UI + nav

**Files:**
- Create: `apps/web/app/tracker/page.tsx`
- Create: `apps/web/components/tracker/defect-tracker-dashboard.tsx`
- Create: `apps/web/components/tracker/tracker-filters.tsx`
- Create: `apps/web/components/tracker/tracker-tabs.tsx`
- Create: `apps/web/components/tracker/tracker-table.tsx`
- Modify: `apps/web/components/layout/app-header.tsx`

- [ ] **Step 1: Nav**

Insert between Analytics and Bug Budget:

```ts
{ href: '/tracker', label: 'Defect Tracker', match: (p) => p.startsWith('/tracker') },
```

- [ ] **Step 2: Page**

Client dashboard mirroring Bug Budget layout: header, filters, tabs with counts, table. URL sync via `history.pushState` + `trackerParamsFromUrl` (same pattern as Analytics).

- [ ] **Step 3: Inline edit**

For the four fields: click → input/select → on blur/Enter call `PATCH` with CSRF header (reuse `apiJson` / existing CSRF cookie pattern from settings saves). Show small “overridden” badge when `tracker_overrides[field]` set. On error, show row error string; keep other rows intact.

- [ ] **Step 4: Tabs**

`All` | `Missing fields` | `No linked test` — switching sets `tab` query param and refetches.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): Defect Tracker page with inline edits"
```

---

### Task 6: M5 — Polish + cutover disposition

**Files:**
- Tracker UI polish (loading skeletons, empty states, Jira link column)
- Optional: project group chips if filter_options.projects length warrants (same chips pattern as filters — skip if noisy)
- Modify: `docs/migration/bb-mig-05-downstream-cutover.md` — set Defect Tracker (+ write-backs) disposition to **rebuild in Momus**, Done checkbox when epic merges

- [ ] **Step 1:** Override badges + tab count display verified manually on `http://127.0.0.1:3000/tracker`
- [ ] **Step 2:** Update MIG-05 matrix rows for Tracker / write-backs
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(tracker): M5 polish and MIG-05 disposition"
```

- [ ] **Step 4: PR**

```bash
git push -u origin HEAD
gh pr create --base master --title "feat(tracker): Defect Tracker M1–M5" --body "..."
```

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| `tracker_overrides` column + shape | T1 |
| Sync upsert skips overridden fields | T3 |
| Missing fields + no linked test + list filters | T2, T4, T5 |
| Inline edit four fields → Momus | T4, T5 |
| `/tracker` nav between Analytics and Bug Budget | T5 |
| CSRF / auth / errors | T4 |
| Cache bump on sync | T3, T6 |
| No Analytics/Bug Budget redesign | All (additive only) |
| MIG-05 disposition | T6 |
| Jira write out of scope | — |

## Execution

Start Task 1 on `feat/defect-tracker` after this plan is saved. Prefer subagent-driven or inline execution per operator choice.
