# Supabase Auth + BB-PERM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MOMUS_DEV_AUTH_BYPASS` with Supabase Auth cookie sessions, enforce BB-PERM via `public.users` + `user_permissions`, and ship admin invite UI on `/settings/users`.

**Architecture:** `@supabase/ssr` refreshes sessions in middleware; route handlers resolve `auth.getUser()` → `public.users.auth_user_id` → permissions. Invites use service-role Auth Admin API + `UsersRepository`. Sign-in UI supports email/password and a magic-link/OTP toggle. No QARATMS identity.

**Tech Stack:** Next.js 15 App Router, `@supabase/ssr`, `@supabase/supabase-js`, Vitest, existing `apiJson` + CSRF header.

**Spec:** `docs/superpowers/specs/2026-07-12-supabase-auth-bb-perm-design.md`  
**PRD:** BB-PERM-01/02/03, AC-7  
**Branch:** `feat/supabase-auth`

---

## File structure

| Path | Responsibility |
|---|---|
| `apps/web/lib/supabase/env.ts` | Read URL + anon key; throw clear errors |
| `apps/web/lib/supabase/browser.ts` | Browser Supabase client (sign-in form) |
| `apps/web/lib/supabase/server.ts` | Cookie-bound server client (`@supabase/ssr`) |
| `apps/web/lib/supabase/middleware.ts` | `updateSession(request)` for middleware |
| `apps/web/lib/auth-map.ts` | Pure: map DB row + perms → `AuthUser` / error reasons |
| `apps/web/lib/auth-map.test.ts` | Unit tests for mapping + candidate block |
| `apps/web/lib/auth.ts` | `getSessionUser` / `requirePermission*` using real session (+ optional local bypass) |
| `apps/web/lib/auth-constants.ts` | Drop or deprecate `SIGNED_OUT_COOKIE` once unused |
| `apps/web/middleware.ts` | Session refresh + gate unauthenticated routes |
| `apps/web/app/auth/callback/route.ts` | Magic-link / OTP code exchange → cookies |
| `apps/web/app/sign-in/page.tsx` | Sign-in page shell |
| `apps/web/components/auth/sign-in-form.tsx` | Email/password + OTP toggle UI |
| `apps/web/app/api/auth/sign-out/route.ts` | Supabase sign-out + clear cookies |
| `apps/web/app/api/auth/sign-in/route.ts` | Remove or no-op (browser client signs in) |
| `apps/web/app/api/me/route.ts` | Unchanged contract; uses new `getSessionUser` |
| `packages/infra/src/supabase/users.repository.ts` | List / invite / patch users + permissions |
| `packages/infra/src/supabase/users.repository.test.ts` | Repo unit tests with mocks |
| `apps/web/app/api/users/route.ts` | GET list, POST invite (`manage_users`) |
| `apps/web/app/api/users/[id]/route.ts` | PATCH permissions / soft deactivate |
| `apps/web/app/settings/users/page.tsx` | Users admin page |
| `apps/web/components/settings/users-admin.tsx` | List + invite + edit UI |
| `apps/web/components/layout/app-header.tsx` | Sign-out → `/sign-in`; hide header on `/sign-in`; Users nav for `manage_users` |
| `docs/ops/supabase-auth-bootstrap.md` | One-time admin seed runbook |
| `.env.example` | Document Auth-related vars; note no prod bypass |

---

### Task 1: Pure auth mapping helpers (TDD)

**Files:**
- Create: `apps/web/lib/auth-map.ts`
- Create: `apps/web/lib/auth-map.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { mapMomusUser } from './auth-map';

describe('mapMomusUser', () => {
  it('maps row + permissions to AuthUser', () => {
    const result = mapMomusUser(
      { id: 1, email: 'a@x.com', name: 'Ann', is_candidate: false },
      ['view_analytics', 'access_settings'],
    );
    expect(result).toEqual({
      ok: true,
      user: {
        id: 1,
        email: 'a@x.com',
        name: 'Ann',
        permissions: ['view_analytics', 'access_settings'],
      },
    });
  });

  it('rejects missing row', () => {
    expect(mapMomusUser(null, [])).toEqual({
      ok: false,
      reason: 'no_momus_user',
    });
  });

  it('rejects candidates', () => {
    expect(
      mapMomusUser(
        { id: 2, email: 'c@x.com', name: 'Cand', is_candidate: true },
        [],
      ),
    ).toEqual({ ok: false, reason: 'candidate' });
  });

  it('falls back name to email', () => {
    const result = mapMomusUser(
      { id: 3, email: 'b@x.com', name: null, is_candidate: false },
      [],
    );
    expect(result).toMatchObject({ ok: true, user: { name: 'b@x.com' } });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm --filter @momus/web exec vitest run lib/auth-map.test.ts
```

Expected: fail (module / export missing). If web package has no vitest yet, add `"test": "vitest run"` + vitest dep matching infra, or place tests under `packages/infra` and keep mapper there — prefer `apps/web` with vitest.

- [ ] **Step 3: Implement mapper**

```ts
export type MomusUserRow = {
  id: number | string;
  email: string;
  name: string | null;
  is_candidate: boolean;
};

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

export type MapResult =
  | { ok: true; user: AuthUser }
  | { ok: false; reason: 'no_momus_user' | 'candidate' };

export function mapMomusUser(
  row: MomusUserRow | null | undefined,
  permissions: string[],
): MapResult {
  if (!row) return { ok: false, reason: 'no_momus_user' };
  if (row.is_candidate) return { ok: false, reason: 'candidate' };
  return {
    ok: true,
    user: {
      id: Number(row.id),
      email: row.email,
      name: row.name ?? row.email,
      permissions,
    },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth-map.ts apps/web/lib/auth-map.test.ts apps/web/package.json
git commit -m "test(web): add Momus user auth mapping helpers"
```

---

### Task 2: Supabase SSR clients

**Files:**
- Create: `apps/web/lib/supabase/env.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/browser.ts`
- Create: `apps/web/lib/supabase/middleware.ts`
- Verify: `apps/web/package.json` has `@supabase/ssr` (already present)

- [ ] **Step 1: Add `env.ts`**

```ts
export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return { url, anonKey };
}
```

- [ ] **Step 2: Add `server.ts` (cookie client)**

Use `@supabase/ssr` `createServerClient` with `cookies()` from `next/headers` (get/set/remove pattern from Supabase Next.js docs). Export `createSupabaseServerClient()`.

- [ ] **Step 3: Add `browser.ts`**

```ts
'use client';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublicEnv } from './env';

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
```

Note: `getSupabasePublicEnv` in browser only sees `NEXT_PUBLIC_*` — fine.

- [ ] **Step 4: Add `middleware.ts` helper `updateSession(request: NextRequest)`**

Create SSR client bound to request/response cookies; call `supabase.auth.getUser()` to refresh; return `{ supabase, user, response }`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/supabase
git commit -m "feat(web): add Supabase SSR browser/server/middleware clients"
```

---

### Task 3: Rewrite `getSessionUser` + CSRF

**Files:**
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/lib/auth-constants.ts` (keep export temporarily if needed)
- Keep: `AuthUser` / `UserPermission` types exported from `auth.ts` (re-export from `auth-map` or duplicate thin alias)

- [ ] **Step 1: Implement session resolution**

Logic:

1. If `process.env.MOMUS_DEV_AUTH_BYPASS === 'true'` **and** `process.env.NODE_ENV !== 'production'` → keep existing `resolveDevUser()` path for local/Vitest.
2. Else:
   - `const supabase = await createSupabaseServerClient()`
   - `const { data: { user: authUser } } = await supabase.auth.getUser()`
   - If no authUser → 401 Authentication required
   - Service DB: `createServerClient()` from `@momus/infra` load `users` by `auth_user_id = authUser.id`
   - `mapMomusUser` → if fail → 401/403 with messages:
     - `no_momus_user` → `"No Momus user linked to this account"`
     - `candidate` → `"Authenticated non-candidate user required"`
   - Load permissions; return mapped user

- [ ] **Step 2: Add `requireManageUsers()`** → `requirePermission('manage_users')`

- [ ] **Step 3: Update `assertCsrf`**

Skip CSRF only when `NODE_ENV === 'development' && MOMUS_DEV_AUTH_BYPASS === 'true'`. Production always requires header (apiJson already sends it).

- [ ] **Step 4: Manual smoke** — with bypass local, `/api/me` still works.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/auth.ts
git commit -m "feat(web): resolve session user from Supabase Auth"
```

---

### Task 4: Middleware gate + auth callback

**Files:**
- Modify: `apps/web/middleware.ts`
- Create: `apps/web/app/auth/callback/route.ts`

- [ ] **Step 1: Rewrite middleware**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_PREFIXES = [
  '/sign-in',
  '/auth/callback',
  '/api/health',
  '/_next',
  '/favicon.ico',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p),
  );
}

export async function middleware(request: NextRequest) {
  const { user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return response;

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      );
    }
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
```

Refine `isPublic` so `/api/health` and `/api/health/worker` match without opening all `/api`.

- [ ] **Step 2: Auth callback route**

Exchange `code` query via `exchangeCodeForSession` using cookie client; redirect to `next` or `/`. On error redirect `/sign-in?error=auth`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/middleware.ts apps/web/app/auth/callback/route.ts
git commit -m "feat(web): gate routes on Supabase session middleware"
```

---

### Task 5: Sign-in UI + sign-out

**Files:**
- Create: `apps/web/app/sign-in/page.tsx`
- Create: `apps/web/components/auth/sign-in-form.tsx`
- Modify: `apps/web/app/api/auth/sign-out/route.ts`
- Delete or redirect: `apps/web/app/signed-out/page.tsx` → redirect to `/sign-in`
- Remove stub: `apps/web/app/api/auth/sign-in/route.ts` (or return 410)
- Modify: `apps/web/components/layout/app-header.tsx`
- Modify: `apps/web/app/globals.css` — minimal `.bb-sign-in` styles matching existing tokens

- [ ] **Step 1: Sign-in form**

Client component:

- State: `mode: 'password' | 'otp'`, email, password, message, busy
- Toggle button switches mode
- Password mode: `createSupabaseBrowserClient().auth.signInWithPassword({ email, password })`
- OTP mode: `signInWithOtp({ email, options: { emailRedirectTo: origin + '/auth/callback' } })` and show “Check your email”
- On password success: `router.replace(next || '/')` + `router.refresh()`
- Never call bypass cookie APIs

- [ ] **Step 2: Page**

```tsx
import { SignInForm } from '@/components/auth/sign-in-form';

export default function SignInPage() {
  return (
    <main className="bb-sign-in">
      <SignInForm />
    </main>
  );
}
```

- [ ] **Step 3: Sign-out route**

Use cookie server client `supabase.auth.signOut()`; return `{ success: true }`. Do not set `momus_signed_out`.

- [ ] **Step 4: Header**

- `router.push('/sign-in')` after sign-out
- `if (pathname === '/sign-in') return null`
- Add nav item `{ href: '/settings/users', label: 'Users', requires: 'manage_users' }` (or nest under Settings)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sign-in apps/web/components/auth apps/web/app/api/auth apps/web/components/layout/app-header.tsx apps/web/app/signed-out apps/web/app/globals.css
git commit -m "feat(web): add sign-in form and Supabase sign-out"
```

---

### Task 6: Users repository (infra)

**Files:**
- Create: `packages/infra/src/supabase/users.repository.ts`
- Create: `packages/infra/src/supabase/users.repository.test.ts`
- Modify: `packages/infra/src/supabase/index.ts` — export repository

- [ ] **Step 1: Failing tests for invite body validation / permission replace helpers**

If Auth Admin is hard to mock, extract pure helpers:

```ts
export function normalizePermissions(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const allowed = new Set(['view_analytics', 'access_settings', 'manage_users']);
  const out = [...new Set(input.filter((p) => typeof p === 'string' && allowed.has(p)))];
  return out as string[];
}
```

Test allowed filter + dedupe.

- [ ] **Step 2: Implement `UsersRepository`**

Methods (service-role `SupabaseClient`):

- `listUsers()` — select users + nested permissions (or two queries)
- `inviteUser({ email, name, permissions })`:
  1. `auth.admin.createUser({ email, email_confirm: true, user_metadata: { name } })` OR `inviteUserByEmail`
  2. Prefer `inviteUserByEmail` when magic-link onboarding desired; for admin-created password users use `createUser` + optional temp password returned once — **spec: invite** → use `auth.admin.inviteUserByEmail(email, { data: { name } })`
  3. Upsert `public.users` with `auth_user_id`, email, name, `is_candidate: false`
  4. Replace permissions rows
  5. On duplicate email → throw typed `UserConflictError`
- `updateUser(id, { permissions?, is_candidate? })` — update flags; replace permissions when provided

- [ ] **Step 3: Run infra tests**

```bash
pnpm --filter @momus/infra test
```

- [ ] **Step 4: Commit**

```bash
git add packages/infra/src/supabase/users.repository.ts packages/infra/src/supabase/users.repository.test.ts packages/infra/src/supabase/index.ts
git commit -m "feat(infra): add UsersRepository for invite and permissions"
```

---

### Task 7: Users API routes

**Files:**
- Create: `apps/web/app/api/users/route.ts`
- Create: `apps/web/app/api/users/[id]/route.ts`

- [ ] **Step 1: GET `/api/users`**

```ts
const auth = await requireManageUsers();
if ('error' in auth) return auth.error;
const repo = new UsersRepository(createServerClient());
const users = await repo.listUsers();
return NextResponse.json({ success: true, users });
```

- [ ] **Step 2: POST `/api/users`**

`assertCsrf`; parse JSON `{ email, name, permissions }`; validate email; `inviteUser`; 409 on conflict; 200 `{ success: true, user }`.

- [ ] **Step 3: PATCH `/api/users/[id]`**

`assertCsrf`; `requireManageUsers`; body `{ permissions?: string[], is_candidate?: boolean }`; update; 404 if missing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/users
git commit -m "feat(web): add manage_users users list/invite/patch APIs"
```

---

### Task 8: Users admin UI

**Files:**
- Create: `apps/web/app/settings/users/page.tsx`
- Create: `apps/web/components/settings/users-admin.tsx`
- Modify: header nav (if not done in Task 5)

- [ ] **Step 1: Page mounts `<UsersAdmin />`** inside existing layout/header shell

- [ ] **Step 2: UsersAdmin client**

- Load GET `/api/users` on mount
- Table: email, name, candidate, permissions
- Invite form: email, name, three permission checkboxes (default `view_analytics` checked)
- Edit: toggle permissions → PATCH; Soft deactivate → PATCH `is_candidate: true` + clear permissions
- Use `apiJson` for CSRF header

- [ ] **Step 3: Guard page** — if `/api/me` lacks `manage_users`, show 403 message (middleware already requires login)

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/settings/users apps/web/components/settings/users-admin.tsx
git commit -m "feat(web): add Users settings admin UI"
```

---

### Task 9: Docs, env example, cleanup

**Files:**
- Create: `docs/ops/supabase-auth-bootstrap.md` (SQL from spec + Dashboard steps + redirect URL notes for `momus.vercel.app` and `*.vercel.app`)
- Modify: `.env.example` — document vars; comment that `MOMUS_DEV_AUTH_BYPASS` is local-only
- Remove dead `SIGNED_OUT_COOKIE` usage if fully unused
- Update `history-log.md` changelog entry (short)

- [ ] **Step 1: Write bootstrap runbook**

- [ ] **Step 2: Update `.env.example`**

- [ ] **Step 3: Grep for `MOMUS_DEV_AUTH_BYPASS` / `SIGNED_OUT_COOKIE` / `signed-out` and clean leftovers

- [ ] **Step 4: Commit**

```bash
git add docs/ops/supabase-auth-bootstrap.md .env.example history-log.md apps/web
git commit -m "docs(auth): bootstrap runbook and env notes for Supabase Auth"
```

---

### Task 10: Verification checklist

- [ ] **Step 1: Typecheck**

```bash
pnpm typecheck
```

Expected: pass

- [ ] **Step 2: Unit tests**

```bash
pnpm --filter @momus/infra test
pnpm --filter @momus/web exec vitest run
```

- [ ] **Step 3: Manual local**

1. `MOMUS_DEV_AUTH_BYPASS=true` still works for API tests OR use real Auth locally
2. Without session, `/bug-budget` redirects to `/sign-in`
3. `/api/health` public
4. After bootstrap admin: password login works
5. OTP toggle sends email (if provider configured)
6. Invite user → appears in list → can sign in after accepting invite
7. User without `access_settings` does not see Settings nav
8. Confirm Vercel production will **not** set bypass

- [ ] **Step 4: Open PR to `master`** when green

---

## Spec coverage

| Spec item | Task |
|---|---|
| Same Momus Supabase Auth | 2–4 |
| Email/password + OTP toggle | 5 |
| Cookie SSR session | 2, 4 |
| `getSessionUser` via `auth_user_id` | 1, 3 |
| Middleware gate + allowlist | 4 |
| Sign-out → `/sign-in` | 5 |
| Users invite/list/patch | 6–8 |
| `manage_users` gate | 7–8 |
| Bootstrap runbook | 9 |
| No prod bypass | 3, 9, 10 |
| CSRF retained | 3, 7 |

## Out of scope (do not implement here)

DEV-9 Vault, Inngest prod, scheduler/retention/audit, migration.
