# Defect Analytics Menu Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global admin toggle (`show_defect_analytics`) so Defect Analytics can be hard-hidden for everyone: nav gone, `/` → `/bug-budget`, dashboard APIs 403, Settings → Analytics stays open to re-enable.

**Architecture:** Persist the flag on the existing `analytics_settings` JSON blob. Normalize missing → `true` (fail-open). Expose it on `/api/me` as `flags.show_defect_analytics` for the header. Server pages and analytics GET routes load the same setting and redirect or 403. Settings save path is never gated by the flag.

**Tech Stack:** TypeScript, Vitest, Next.js 15 App Router, Supabase `bug_budget_config` JSON (no schema migration).

**Spec:** `docs/superpowers/specs/2026-09-09-defect-analytics-menu-visibility-design.md`

## Global Constraints

- Default `show_defect_analytics: true` (prod behavior unchanged until an admin saves `false`)
- Fail-open to `true` if settings cannot be loaded
- Hard-hide only dashboard page + `GET /api/analytics`, `/period-detail`, `/export/csv`
- Never gate `GET|POST /api/settings/analytics`
- Redirect target for hidden home: `/bug-budget`
- Timezone / Jira / `bug_budget` table: unchanged

## File map

| Path | Role |
|---|---|
| `packages/infra/src/supabase/analytics-settings.ts` | Field, default, normalize, parse |
| `packages/infra/src/supabase/analytics-settings.test.ts` | Normalize/parse cases for the flag |
| `apps/web/lib/defect-analytics-gate.ts` | `loadShowDefectAnalytics()`, 403 helper |
| `apps/web/lib/defect-analytics-gate.test.ts` | Fail-open + disabled message |
| `apps/web/lib/landing-path.ts` | Accept flag; skip `/`; prefer bug-budget over tracker |
| `apps/web/lib/landing-path.test.ts` | New cases when flag is false |
| `apps/web/app/api/me/route.ts` | Include `flags.show_defect_analytics` |
| `apps/web/lib/use-me.ts` | Type + pass-through flags |
| `apps/web/components/layout/app-header.tsx` | Filter nav; brand href |
| `apps/web/app/page.tsx` | Redirect when hidden |
| `apps/web/app/analytics/page.tsx` | Redirect when hidden |
| `apps/web/app/api/analytics/route.ts` | Assert enabled |
| `apps/web/app/api/analytics/period-detail/route.ts` | Assert enabled |
| `apps/web/app/api/analytics/export/csv/route.ts` | Assert enabled |
| `apps/web/components/settings/tabs/analytics-tab.tsx` | Checkbox + copy |
| `apps/web/lib/page-guard.ts` / callers | Pass flag into `landingPathFor` where redirects run |

---

### Task 1: Infra — `show_defect_analytics` on analytics_settings

**Files:**
- Modify: `packages/infra/src/supabase/analytics-settings.ts`
- Modify: `packages/infra/src/supabase/analytics-settings.test.ts`

**Interfaces:**
- Produces: `AnalyticsSettings.show_defect_analytics: boolean`; default `true`; `normalizeAnalyticsSettings` treats missing/`undefined` as `true`, only explicit `false` hides

- [ ] **Step 1: Write the failing tests**

Add to `analytics-settings.test.ts`:

```ts
describe('normalizeAnalyticsSettings — show_defect_analytics', () => {
  it('defaults to true when omitted', () => {
    expect(normalizeAnalyticsSettings({}).show_defect_analytics).toBe(true);
  });

  it('keeps explicit false', () => {
    expect(normalizeAnalyticsSettings({ show_defect_analytics: false }).show_defect_analytics).toBe(
      false,
    );
  });

  it('keeps explicit true', () => {
    expect(normalizeAnalyticsSettings({ show_defect_analytics: true }).show_defect_analytics).toBe(
      true,
    );
  });
});

describe('parseAnalyticsSettings — show_defect_analytics', () => {
  it('round-trips false with valid SLA payload', () => {
    const s = parseAnalyticsSettings({
      sla_first_response_days: 2,
      sla_critical_resolution_days: 3,
      sla_major_resolution_days: 7,
      show_defect_analytics: false,
    });
    expect(s.show_defect_analytics).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @momus/infra exec vitest run src/supabase/analytics-settings.test.ts`

Expected: FAIL (property missing / undefined)

- [ ] **Step 3: Implement**

In `analytics-settings.ts`:

1. Add to `AnalyticsSettings`:
   `show_defect_analytics: boolean;`
2. Add to `DEFAULT_ANALYTICS_SETTINGS`:
   `show_defect_analytics: true,`
3. In `normalizeAnalyticsSettings` return object, add:
   `show_defect_analytics: value.show_defect_analytics === false ? false : true,`
4. No extra parse throw needed (boolean only); `parseAnalyticsSettings` already ends in `normalizeAnalyticsSettings(body)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @momus/infra exec vitest run src/supabase/analytics-settings.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/infra/src/supabase/analytics-settings.ts packages/infra/src/supabase/analytics-settings.test.ts
git commit -m "$(cat <<'EOF'
feat(infra): add show_defect_analytics to analytics_settings

EOF
)"
```

---

### Task 2: Landing path when analytics is hidden

**Files:**
- Modify: `apps/web/lib/landing-path.ts`
- Modify: `apps/web/lib/landing-path.test.ts`

**Interfaces:**
- Consumes: `APP_ROUTES`
- Produces: `landingPathFor(permissions: string[], options?: { showDefectAnalytics?: boolean }): string`
  - `showDefectAnalytics` defaults to `true` when omitted
  - When `false`: omit `/`; among remaining routes, place `/bug-budget` immediately before `/tracker` so Bug Budget wins over Tracker for `view_analytics` users, while Executive / Leaderboard / Settings keep relative priority

- [ ] **Step 1: Write the failing tests**

Extend `landing-path.test.ts`:

```ts
it('skips Defect Analytics home when showDefectAnalytics is false', () => {
  expect(landingPathFor(['view_analytics'], { showDefectAnalytics: false })).toBe('/bug-budget');
});

it('still prefers executive reports over bug-budget when that permission is held', () => {
  expect(
    landingPathFor(['view_executive_reports', 'view_analytics'], {
      showDefectAnalytics: false,
    }),
  ).toBe('/reports/executive');
});

it('defaults to / when showDefectAnalytics is omitted', () => {
  expect(landingPathFor(['view_analytics'])).toBe('/');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/landing-path.test.ts`

Expected: FAIL (second arg ignored / still `/` or `/tracker`)

- [ ] **Step 3: Implement**

```ts
import { APP_ROUTES, type AppRoute } from './routes';

function routesForLanding(showDefectAnalytics: boolean): AppRoute[] {
  if (showDefectAnalytics) return APP_ROUTES;
  const withoutHome = APP_ROUTES.filter((r) => r.href !== '/');
  const trackerIdx = withoutHome.findIndex((r) => r.href === '/tracker');
  const bugIdx = withoutHome.findIndex((r) => r.href === '/bug-budget');
  if (trackerIdx === -1 || bugIdx === -1 || bugIdx < trackerIdx) return withoutHome;
  const next = [...withoutHome];
  const [bug] = next.splice(bugIdx, 1);
  next.splice(trackerIdx, 0, bug);
  return next;
}

/** Where to send a user who may not open the page they asked for. */
export function landingPathFor(
  permissions: string[],
  options?: { showDefectAnalytics?: boolean },
): string {
  const show = options?.showDefectAnalytics !== false;
  return (
    routesForLanding(show).find((route) => permissions.includes(route.permission))?.href ??
    '/no-access'
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/landing-path.test.ts`

Expected: PASS (including existing cases)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/landing-path.ts apps/web/lib/landing-path.test.ts
git commit -m "$(cat <<'EOF'
feat(web): landing prefers bug-budget when analytics hidden

EOF
)"
```

---

### Task 3: Gate helper + wire homepage / analytics redirect + API 403

**Files:**
- Create: `apps/web/lib/defect-analytics-gate.ts`
- Create: `apps/web/lib/defect-analytics-gate.test.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/analytics/page.tsx`
- Modify: `apps/web/app/api/analytics/route.ts`
- Modify: `apps/web/app/api/analytics/period-detail/route.ts`
- Modify: `apps/web/app/api/analytics/export/csv/route.ts`
- Modify: `apps/web/lib/page-guard.ts` (and any `landingPathFor(...)` call sites that should honor the flag — at minimum pass the loaded flag when redirecting from permission failure after a settings load is already cheap; if `requirePagePermission` cannot load settings without extra cost, load only in homepage/analytics redirects and leave permission fallbacks fail-open via default `true` until Task 4 exposes flags widely)

**Interfaces:**
- Produces:
  - `async function loadShowDefectAnalytics(db?: SupabaseClient): Promise<boolean>` — fail-open `true` on throw
  - `function defectAnalyticsDisabledResponse(): NextResponse` — 403 `{ success: false, message: 'Defect Analytics is disabled' }` via existing `jsonFail`

- [ ] **Step 1: Write gate unit tests**

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('@momus/infra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@momus/infra')>();
  return {
    ...actual,
    createServerClient: vi.fn(),
    loadAnalyticsSettings: vi.fn(),
  };
});

import { loadAnalyticsSettings } from '@momus/infra';
import { loadShowDefectAnalytics } from './defect-analytics-gate';

describe('loadShowDefectAnalytics', () => {
  it('returns false when settings say so', async () => {
    vi.mocked(loadAnalyticsSettings).mockResolvedValue({
      show_defect_analytics: false,
    } as never);
    expect(await loadShowDefectAnalytics({} as never)).toBe(false);
  });

  it('fail-opens to true when load throws', async () => {
    vi.mocked(loadAnalyticsSettings).mockRejectedValue(new Error('db down'));
    expect(await loadShowDefectAnalytics({} as never)).toBe(true);
  });
});
```

(Adjust mock style to match existing web Vitest patterns if the repo already mocks `@momus/infra` differently.)

- [ ] **Step 2: Implement `defect-analytics-gate.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, loadAnalyticsSettings } from '@momus/infra';
import { jsonFail } from '@/lib/sync-params';

export async function loadShowDefectAnalytics(db?: SupabaseClient): Promise<boolean> {
  try {
    const settings = await loadAnalyticsSettings(db ?? createServerClient());
    return settings.show_defect_analytics !== false;
  } catch {
    return true;
  }
}

export function defectAnalyticsDisabledResponse() {
  return jsonFail('Defect Analytics is disabled', 403);
}
```

- [ ] **Step 3: Homepage + `/analytics` redirect**

`app/page.tsx`:

```ts
import { redirect } from 'next/navigation';
import { DefectAnalyticsDashboard } from '@/components/analytics/defect-analytics-dashboard';
import { loadShowDefectAnalytics } from '@/lib/defect-analytics-gate';
import { requirePagePermission } from '@/lib/page-guard';

export default async function HomePage() {
  await requirePagePermission('view_analytics');
  if (!(await loadShowDefectAnalytics())) {
    redirect('/bug-budget');
  }
  return <DefectAnalyticsDashboard />;
}
```

`app/analytics/page.tsx`: when hidden, `redirect('/bug-budget')` (preserve query only when showing / still aliasing home). Simplest hard-hide path:

```ts
import { redirect } from 'next/navigation';
import { loadShowDefectAnalytics } from '@/lib/defect-analytics-gate';

// ... existing searchParams rebuild for the visible case ...

export default async function AnalyticsRedirectPage({ searchParams }: Props) {
  if (!(await loadShowDefectAnalytics())) {
    redirect('/bug-budget');
  }
  // existing redirect to /?qs
}
```

- [ ] **Step 4: API routes — after successful auth, before work**

```ts
const show = await loadShowDefectAnalytics();
if (!show) return defectAnalyticsDisabledResponse();
```

Apply in all three analytics GET handlers.

- [ ] **Step 5: Run tests**

Run:
`pnpm --filter web exec vitest run lib/defect-analytics-gate.test.ts lib/landing-path.test.ts`
`pnpm --filter @momus/infra exec vitest run src/supabase/analytics-settings.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/defect-analytics-gate.ts apps/web/lib/defect-analytics-gate.test.ts \
  apps/web/app/page.tsx apps/web/app/analytics/page.tsx \
  apps/web/app/api/analytics/route.ts \
  apps/web/app/api/analytics/period-detail/route.ts \
  apps/web/app/api/analytics/export/csv/route.ts
git commit -m "$(cat <<'EOF'
feat(web): hard-hide defect analytics page and APIs when disabled

EOF
)"
```

---

### Task 4: `/api/me` flags + header nav / brand

**Files:**
- Modify: `apps/web/app/api/me/route.ts`
- Modify: `apps/web/lib/use-me.ts`
- Modify: `apps/web/components/layout/app-header.tsx`

**Interfaces:**
- Produces: `/api/me` body includes `flags: { show_defect_analytics: boolean }` alongside `user`
- `MeState` exposes `flags: { show_defect_analytics: boolean } | null` (or default `{ show_defect_analytics: true }` once loaded)

- [ ] **Step 1: Update `/api/me`**

```ts
import { getSessionUser } from '@/lib/auth';
import { loadShowDefectAnalytics } from '@/lib/defect-analytics-gate';
import { jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await getSessionUser();
  if ('error' in auth) return auth.error;

  const showDefectAnalytics = await loadShowDefectAnalytics();

  return jsonOk({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      permissions: auth.user.permissions,
    },
    flags: { show_defect_analytics: showDefectAnalytics },
  });
}
```

- [ ] **Step 2: Extend `useMe`**

```ts
export type AppFlags = {
  show_defect_analytics: boolean;
};

export type MeState = {
  user: MeUser | null;
  flags: AppFlags;
  loaded: boolean;
};

// snapshot stores { user, flags }; default flags while loading:
const DEFAULT_FLAGS: AppFlags = { show_defect_analytics: true };

// parse res.flags?.show_defect_analytics !== false
```

Keep fail-open default `true` until the response arrives so the nav does not flash-hide.

- [ ] **Step 3: Update `AppHeader`**

```ts
const { user, flags, loaded } = useMe();

const links = loaded
  ? APP_ROUTES.filter((route) => {
      if (route.href === '/' && !flags.show_defect_analytics) return false;
      return user?.permissions.includes(route.permission);
    })
  : [];

const brandHref = flags.show_defect_analytics ? '/' : '/bug-budget';
// <Link href={brandHref} className="bb-app-brand">
```

- [ ] **Step 4: Manual / typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/me/route.ts apps/web/lib/use-me.ts apps/web/components/layout/app-header.tsx
git commit -m "$(cat <<'EOF'
feat(web): hide Defect Analytics nav from /api/me flags

EOF
)"
```

---

### Task 5: Settings → Analytics checkbox

**Files:**
- Modify: `apps/web/components/settings/tabs/analytics-tab.tsx`

**Interfaces:**
- Consumes: `settings.show_defect_analytics` from existing GET/POST `/api/settings/analytics`
- Checkbox at top of the tab (visibility is the ops kill-switch; put it before SLA thresholds)

- [ ] **Step 1: Extend local `AnalyticsSettings` type** with `show_defect_analytics: boolean`

- [ ] **Step 2: Add UI block**

```tsx
<section className="settings-card">
  <h2>Menu visibility</h2>
  <p className="muted">
    When off, Defect Analytics is removed from navigation, home redirects to Bug Budget,
    and dashboard APIs return 403. This settings tab stays available so you can turn it back on.
  </p>
  <label className="field field--checkbox">
    <input
      type="checkbox"
      checked={settings.show_defect_analytics}
      onChange={(e) =>
        setSettings({ ...settings, show_defect_analytics: e.target.checked })
      }
    />
    Show Defect Analytics in navigation
  </label>
</section>
```

Reuse an existing checkbox class if the tab already has one; otherwise match nearby field styling.

- [ ] **Step 3: Confirm save payload already spreads `...settings`** (it does) so the boolean posts without extra wiring. Existing CSRF + audit + cache bump stay as-is.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter web typecheck`

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/settings/tabs/analytics-tab.tsx
git commit -m "$(cat <<'EOF'
feat(web): settings toggle for Defect Analytics menu visibility

EOF
)"
```

---

### Task 6: Verify end-to-end

- [ ] **Step 1: Unit suites**

```bash
pnpm --filter @momus/infra exec vitest run src/supabase/analytics-settings.test.ts
pnpm --filter web exec vitest run lib/landing-path.test.ts lib/defect-analytics-gate.test.ts
pnpm --filter web typecheck
```

Expected: all PASS

- [ ] **Step 2: Manual checklist**

1. Flag default / unset → Defect Analytics visible; `/` loads dashboard; APIs work
2. Settings → Analytics → uncheck → Save → nav item gone; Momus brand → `/bug-budget`
3. Visit `/` and `/analytics` → land on `/bug-budget`
4. `GET /api/analytics` → 403 message `Defect Analytics is disabled`
5. Settings → Analytics still loads; re-check → Save → full restore without redeploy

- [ ] **Step 3: PR**

Branch: `feat/defect-analytics-menu-visibility`  
Title: `feat(web): global toggle to hard-hide Defect Analytics`  
Body: link the spec; note fail-open default; list manual checklist.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|---|---|
| `show_defect_analytics` on analytics_settings, default true | 1 |
| Settings → Analytics toggle, settings stay open | 5 |
| Nav omit + brand → bug-budget | 4 |
| `/` and `/analytics` → `/bug-budget` | 3 |
| landingPathFor skip `/`, prefer bug-budget over tracker | 2 |
| API 403 on three dashboard routes | 3 |
| `/api/me` flags | 4 |
| Fail-open on load error | 1 + 3 |
| No gate on settings analytics API | 5 (by omission) |
