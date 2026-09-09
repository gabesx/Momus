# Menu Visibility Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Menu visibility so admins can hard-hide Defect Analytics, Defect Tracker, Leaderboard, and/or Bug Budget for everyone, with a shared allowlist of approved users who still see those modules.

**Architecture:** Store a `menu_visibility` block on `analytics_settings`. Resolve effective per-user flags (`module shown OR user on allowlist`). Drive `/api/me`, header nav, `landingPathFor`, page redirects, and product API 403s from that. Replace the PR #50 single `show_defect_analytics` boolean (keep read compat).

**Tech Stack:** TypeScript, Vitest, Next.js 15 App Router, existing `bug_budget_config` JSON, UsersRepository for approved candidates.

**Spec:** `docs/superpowers/specs/2026-09-09-menu-visibility-allowlist-design.md`  
**Base:** branch `feat/defect-analytics-menu-visibility` (PR #50) already has single-module hard-hide.

## Global Constraints

- Default all four modules `true`; fail-open to all shown if settings cannot load
- Shared `allowlist_user_ids` only (no per-menu overrides in v1)
- Allowlist does not grant permissions; only bypasses hide
- Hard-hide: nav omit + page redirect + product API 403
- Never gate `/api/settings/*`, `/api/users*`, `/api/me`, `/api/auth/*`, `/api/health*`
- Landing: walk `APP_ROUTES` order, skip routes with effective flag false; else `/no-access`
- Settings → Analytics UI; allowlist picker requires only `access_settings`
- After save, `reloadMe()` so admin nav updates without hard refresh
- Compat: legacy `show_defect_analytics` maps into `menu_visibility.defect_analytics` on read; new saves write `menu_visibility` only

---

## File map

| Path | Role |
|---|---|
| `packages/infra/.../analytics-settings.ts` | `MenuVisibility` type, defaults, normalize/parse, drop legacy on save |
| `packages/infra/.../analytics-settings.test.ts` | Compat + allowlist normalize tests |
| `apps/web/lib/menu-visibility.ts` | Pure `effectiveMenuFlags(settings, userId)` |
| `apps/web/lib/menu-visibility.test.ts` | Visibility matrix tests |
| `apps/web/lib/menu-visibility-gate.ts` | Replace/generalize `defect-analytics-gate.ts` |
| `apps/web/lib/landing-path.ts` | Filter by flags map (drop DA-only reorder) |
| `apps/web/lib/landing-path.test.ts` | Multi-module landing cases |
| `apps/web/lib/page-guard.ts` | Pass full flags |
| `apps/web/app/api/me/route.ts` | Four effective flags |
| `apps/web/lib/use-me.ts` | Extend `AppFlags` |
| `apps/web/components/layout/app-header.tsx` | Filter all four; brand = first visible |
| `apps/web/app/page.tsx`, `analytics/page.tsx` | Gate via module helper |
| `apps/web/app/tracker/page.tsx` | Redirect when tracker hidden |
| `apps/web/app/leaderboard/page.tsx` | Redirect when leaderboard hidden |
| `apps/web/app/bug-budget/page.tsx`, `[id]/page.tsx` | Redirect when bug budget hidden |
| Analytics / tracker / leaderboard / bug-budget API routes | `assertModuleVisible` |
| `apps/web/app/api/settings/analytics/allowlist-candidates/route.ts` | Approved users for picker (`access_settings`) |
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Four checkboxes + allowlist multi-select |

---

### Task 1: Infra — `menu_visibility` on analytics_settings

**Files:**
- Modify: `packages/infra/src/supabase/analytics-settings.ts`
- Modify: `packages/infra/src/supabase/analytics-settings.test.ts`

**Interfaces:**
- Produces:
```ts
export type MenuVisibility = {
  defect_analytics: boolean;
  defect_tracker: boolean;
  leaderboard: boolean;
  bug_budget: boolean;
  allowlist_user_ids: number[];
};

export type AnalyticsSettings = {
  // ...existing fields...
  menu_visibility: MenuVisibility;
  /** @deprecated read-compat only; not written on save */
  show_defect_analytics?: boolean; // prefer removing from type and only handling in normalize from raw
};
```
Recommended: remove `show_defect_analytics` from the typed `AnalyticsSettings` surface; only read it from raw JSON inside `normalizeAnalyticsSettings` when `menu_visibility` is missing.

- [ ] **Step 1: Write failing tests**

```ts
describe('normalizeAnalyticsSettings — menu_visibility', () => {
  it('defaults all modules true and empty allowlist', () => {
    const s = normalizeAnalyticsSettings({});
    expect(s.menu_visibility).toEqual({
      defect_analytics: true,
      defect_tracker: true,
      leaderboard: true,
      bug_budget: true,
      allowlist_user_ids: [],
    });
  });

  it('maps legacy show_defect_analytics false when menu_visibility missing', () => {
    const s = normalizeAnalyticsSettings({ show_defect_analytics: false });
    expect(s.menu_visibility.defect_analytics).toBe(false);
    expect(s.menu_visibility.defect_tracker).toBe(true);
  });

  it('prefers menu_visibility over legacy key when both present', () => {
    const s = normalizeAnalyticsSettings({
      show_defect_analytics: false,
      menu_visibility: {
        defect_analytics: true,
        defect_tracker: false,
        leaderboard: true,
        bug_budget: true,
        allowlist_user_ids: [1, 'x', -1, 2.5, 3],
      },
    });
    expect(s.menu_visibility.defect_analytics).toBe(true);
    expect(s.menu_visibility.defect_tracker).toBe(false);
    expect(s.menu_visibility.allowlist_user_ids).toEqual([1, 3]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

`pnpm --filter @momus/infra exec vitest run src/supabase/analytics-settings.test.ts`

- [ ] **Step 3: Implement normalize/defaults/parse**

- Add `MenuVisibility`, `DEFAULT_MENU_VISIBILITY`
- In `normalizeAnalyticsSettings`, build `menu_visibility` as above
- Module booleans: only explicit `false` hides (`=== false ? false : true`)
- Allowlist: unique positive integers (`Number.isInteger(n) && n > 0`)
- Keep existing KPI/SLA/digest behavior
- Update any tests that asserted top-level `show_defect_analytics`

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(infra): menu_visibility block on analytics_settings"
```

---

### Task 2: Pure effective flags + landingPathFor

**Files:**
- Create: `apps/web/lib/menu-visibility.ts`
- Create: `apps/web/lib/menu-visibility.test.ts`
- Modify: `apps/web/lib/landing-path.ts`
- Modify: `apps/web/lib/landing-path.test.ts`

**Interfaces:**
```ts
export type MenuModule =
  | 'defect_analytics'
  | 'defect_tracker'
  | 'leaderboard'
  | 'bug_budget';

export type MenuFlags = {
  show_defect_analytics: boolean;
  show_defect_tracker: boolean;
  show_leaderboard: boolean;
  show_bug_budget: boolean;
};

export function effectiveMenuFlags(
  menu: MenuVisibility,
  userId: number | null | undefined,
): MenuFlags;

export function landingPathFor(
  permissions: string[],
  options?: { flags?: Partial<MenuFlags> },
): string;
```

Map href → flag:
- `/` → `show_defect_analytics`
- `/tracker` → `show_defect_tracker`
- `/leaderboard` → `show_leaderboard`
- `/bug-budget` → `show_bug_budget`
- `/reports/*`, `/settings/*` → always considered shown (no flag)

**Replace** the PR #50 `routesForLanding` bug-budget-before-tracker reorder with: filter `APP_ROUTES` where flag !== false (default true when option omitted).

- [ ] **Step 1: Failing tests for `effectiveMenuFlags`**

```ts
it('module false + empty allowlist → false', () => {
  expect(
    effectiveMenuFlags(
      { ...DEFAULT, defect_analytics: false, allowlist_user_ids: [] },
      9,
    ).show_defect_analytics,
  ).toBe(false);
});

it('module false + user on allowlist → true', () => {
  expect(
    effectiveMenuFlags(
      { ...DEFAULT, defect_analytics: false, allowlist_user_ids: [9] },
      9,
    ).show_defect_analytics,
  ).toBe(true);
});
```

- [ ] **Step 2: Failing landing tests**

```ts
it('skips hidden tracker and lands on bug-budget', () => {
  expect(
    landingPathFor(['view_analytics'], {
      flags: {
        show_defect_analytics: false,
        show_defect_tracker: false,
        show_leaderboard: true,
        show_bug_budget: true,
      },
    }),
  ).toBe('/bug-budget');
});

it('falls through to settings when all product menus hidden', () => {
  expect(
    landingPathFor(['view_analytics', 'access_settings'], {
      flags: {
        show_defect_analytics: false,
        show_defect_tracker: false,
        show_leaderboard: false,
        show_bug_budget: false,
      },
    }),
  ).toBe('/settings/atlassian');
});
```

Update existing DA-only tests to pass `flags` instead of `showDefectAnalytics`.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Tests PASS**

`pnpm --filter web exec vitest run lib/menu-visibility.test.ts lib/landing-path.test.ts`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): effective menu flags and multi-module landing"
```

---

### Task 3: Gate helper — load flags + assert module

**Files:**
- Create: `apps/web/lib/menu-visibility-gate.ts`
- Create: `apps/web/lib/menu-visibility-gate.test.ts`
- Delete or thin-wrap: `apps/web/lib/defect-analytics-gate.ts` (re-export from new gate during migration, then remove call sites)

**Interfaces:**
```ts
export async function loadMenuFlagsForUser(
  userId: number,
  db?: SupabaseClient,
): Promise<MenuFlags>; // fail-open all true

export function moduleDisabledResponse(label: string): NextResponse;
// e.g. jsonFail(`${label} is disabled`, 403)

export async function assertModuleVisible(
  module: MenuModule,
  userId: number,
): Promise<NextResponse | null>; // null = ok
```

Labels: `Defect Analytics`, `Defect Tracker`, `Leaderboard`, `Bug Budget`.

- [ ] **Step 1: Tests for fail-open + allowlist via mocked `loadAnalyticsSettings`**

- [ ] **Step 2: Implement**

- [ ] **Step 3: Update all imports of `loadShowDefectAnalytics` / `defectAnalyticsDisabledResponse` to the new helpers (page-guard, analytics pages/APIs, auth callback, leaderboard page)**

- [ ] **Step 4: Tests + typecheck**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): menu visibility gate for all product modules"
```

---

### Task 4: `/api/me`, useMe, AppHeader

**Files:**
- Modify: `apps/web/app/api/me/route.ts`
- Modify: `apps/web/lib/use-me.ts`
- Modify: `apps/web/lib/use-me.test.ts`
- Modify: `apps/web/components/layout/app-header.tsx`

**Interfaces:**
- `/api/me` returns `flags: MenuFlags` via `loadMenuFlagsForUser(auth.user.id)`
- `DEFAULT_FLAGS` all `true`
- Header: map each `APP_ROUTES` product href to its flag; filter false
- Brand href: first link in filtered+permissioned product routes (exclude settings/users from brand preference order among product first; if none, use settings if present in links, else `/no-access`)

Brand algorithm:
```ts
const productHrefs = new Set(['/', '/reports/executive', '/tracker', '/leaderboard', '/bug-budget']);
const brandHref =
  links.find((l) => productHrefs.has(l.href))?.href ??
  links.find((l) => l.href.startsWith('/settings'))?.href ??
  '/no-access';
```

- [ ] **Step 1: Implement me + useMe + header**

- [ ] **Step 2: Update use-me tests for four flags**

- [ ] **Step 3: `pnpm --filter web typecheck`**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): expose four menu flags on /api/me and header"
```

---

### Task 5: Page redirects + product API 403s

**Files (gate after auth, before work):**

| Module | Pages | APIs |
|---|---|---|
| defect_analytics | `app/page.tsx`, `app/analytics/page.tsx` | `api/analytics/route.ts`, `period-detail`, `export/csv` |
| defect_tracker | `app/tracker/page.tsx` | `api/tracker/route.ts`, `api/tracker/[jiraKey]/route.ts`, `api/tracker/field-options/route.ts` (page-used only; skip if only settings) |
| leaderboard | `app/leaderboard/page.tsx` | `api/leaderboard/route.ts`, `api/leaderboard/reporter-issues/route.ts` |
| bug_budget | `app/bug-budget/page.tsx`, `app/bug-budget/[id]/page.tsx` | `api/bug-budget/route.ts`, `[id]`, `export/csv`, `open-bug-summary`, `open-defect-summary` |

Page pattern:
```ts
const user = await requirePagePermission(...);
const flags = await loadMenuFlagsForUser(user.id);
if (!flags.show_defect_tracker) redirect(landingPathFor(user.permissions, { flags }));
```

API pattern (after auth that yields user id):
```ts
const denied = await assertModuleVisible('bug_budget', auth.user.id);
if (denied) return denied;
```

Do **not** gate `api/settings/bug-budget/*` or tracker field-settings if those are settings-owned — verify each file before gating. Prefer gating list/detail/export used by the product page.

- [ ] **Step 1: Wire pages**

- [ ] **Step 2: Wire product APIs**

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): hard-hide tracker, leaderboard, and bug-budget surfaces"
```

---

### Task 6: Allowlist candidates API + Settings UI

**Files:**
- Create: `apps/web/app/api/settings/analytics/allowlist-candidates/route.ts`
- Modify: `apps/web/components/settings/tabs/analytics-tab.tsx`

**Candidates API:**
- `requireAccessSettings`
- List approved users via `UsersRepository.listUsers({ status: 'approved' })`
- Return `{ users: [{ id, name, email }] }` only (no permissions blob required)

**UI:**
- Replace single Defect Analytics checkbox with four Show-* checkboxes bound to `settings.menu_visibility.*`
- When any is false, show allowlist multi-select checklist (name — email), bound to `allowlist_user_ids`
- Load candidates on mount (or when first module unchecked)
- Save still `POST /api/settings/analytics` with full settings including `menu_visibility`
- Keep `await reloadMe()` after successful save
- Remove local `show_defect_analytics` field from the tab’s type in favor of `menu_visibility`

- [ ] **Step 1: Candidates route**

- [ ] **Step 2: Analytics tab UI**

- [ ] **Step 3: Typecheck**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): menu visibility UI with shared user allowlist"
```

---

### Task 7: Verify

- [ ] **Step 1: Unit suites**

```bash
pnpm --filter @momus/infra exec vitest run src/supabase/analytics-settings.test.ts
pnpm --filter web exec vitest run lib/menu-visibility.test.ts lib/menu-visibility-gate.test.ts lib/landing-path.test.ts lib/use-me.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 2: Manual checklist**

1. Defaults: all four menus visible  
2. Uncheck Tracker only → Save → tracker gone for non-allowlisted; allowlisted user still sees it  
3. Uncheck all four, empty allowlist, admin with settings → lands on Settings  
4. Product APIs 403 when hidden; settings analytics still works  
5. Legacy row with only `show_defect_analytics: false` still hides DA until re-saved  

- [ ] **Step 3: Push to PR #50 (or open follow-up PR if #50 already merged)**

---

## Spec coverage (self-review)

| Spec item | Task |
|---|---|
| `menu_visibility` + defaults + legacy map | 1 |
| Effective visibility / allowlist | 2 |
| Landing walk + Settings fallback | 2 |
| Gate helper | 3 |
| `/api/me` four flags + nav + brand | 4 |
| Hard-hide pages/APIs for four modules | 5 |
| Settings UI + access_settings picker | 6 |
| `reloadMe` after save | 6 (keep existing) |
| Never gate settings APIs | 5–6 by omission |
| Fail-open | 1 + 3 |
