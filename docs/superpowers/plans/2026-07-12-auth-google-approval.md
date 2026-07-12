# Google OAuth2 + Approval + Allowlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google OAuth2 + email/password self-signup on Momus, domain/email allowlist, pending-approval gate, and admin approve-with-permissions — all on Momus Supabase Auth only.

**Architecture:** Extend existing `@supabase/ssr` sessions. After Auth success, `ensure-user` upserts `public.users` as `pending` if allowlisted. Middleware routes pending users to `/pending-approval`. Admins approve via Users UI with permission checkboxes. Soft deactivate keeps `is_candidate=true` + clears permissions; reject pending sets `approval_status=rejected`.

**Tech Stack:** Next.js 15, Supabase Auth (Google OAuth2 provider), Postgres migrations, Vitest, existing `UsersRepository` / `apiJson` / CSRF.

**Spec:** `docs/superpowers/specs/2026-07-12-auth-google-approval-design.md`  
**Branch:** `feat/auth-google-approval`

---

## File structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260712120000_auth_approval_allowlist.sql` | `approval_status` column + allowlist tables + seed `allofresh.id` |
| `packages/domain/src/auth/allowlist.ts` | Pure `isEmailAllowlisted(email, domains, emails)` |
| `packages/domain/src/auth/allowlist.test.ts` | Allowlist unit tests |
| `packages/domain/src/auth/approval.ts` | Pure helpers: canAccessApp(status, isCandidate) |
| `packages/domain/src/auth/approval.test.ts` | Approval gating tests |
| `packages/domain/src/index.ts` | Re-exports |
| `packages/infra/src/supabase/auth-allowlist.repository.ts` | CRUD domains/emails + list for matcher |
| `packages/infra/src/supabase/users.repository.ts` | Extend: ensureUser, approve, reject, list by status; invite sets approved |
| `apps/web/lib/auth-map.ts` | Extend mapping for `approval_status` |
| `apps/web/lib/auth.ts` | Session: pending vs approved vs rejected; export pending-aware helpers |
| `apps/web/middleware.ts` | Pending gate + `/pending-approval` allow |
| `apps/web/app/api/auth/ensure-user/route.ts` | POST ensure-user |
| `apps/web/app/api/users/[id]/approve/route.ts` | POST approve |
| `apps/web/app/api/users/[id]/reject/route.ts` | POST reject |
| `apps/web/app/api/users/route.ts` | Support `?status=` |
| `apps/web/app/api/settings/auth-allowlist/route.ts` | GET/PUT allowlist |
| `apps/web/app/sign-in/page.tsx` + `sign-in-form.tsx` | Google button; password sign-in/sign-up; call ensure-user |
| `apps/web/app/auth/callback/route.ts` | After code exchange, redirect via ensure or status |
| `apps/web/app/pending-approval/page.tsx` | Pending screen |
| `apps/web/components/settings/users-admin.tsx` | Pending / Active / Allowlist sections + approve dialog |
| `apps/web/components/layout/app-header.tsx` | Hide nav on pending page |
| `docs/ops/supabase-auth-bootstrap.md` | Google provider + allowlist + approval steps |

---

### Task 1: Migration — approval_status + allowlist tables

**Files:**
- Create: `supabase/migrations/20260712120000_auth_approval_allowlist.sql`

- [ ] **Step 1: Write migration**

```sql
-- approval_status on users (existing rows = approved)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_approval_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.users SET approval_status = 'approved' WHERE approval_status IS NULL;

CREATE TABLE IF NOT EXISTS public.auth_allowed_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.auth_allowed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.auth_allowed_domains (domain)
VALUES ('allofresh.id')
ON CONFLICT (domain) DO NOTHING;

ALTER TABLE public.auth_allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_allowed_emails ENABLE ROW LEVEL SECURITY;
-- Service role bypasses RLS; no anon policies needed for v1
```

- [ ] **Step 2: Apply locally if stack running** (`pnpm db:migrate` or `supabase db push` per repo convention)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260712120000_auth_approval_allowlist.sql
git commit -m "feat(db): add approval_status and auth allowlist tables"
```

---

### Task 2: Domain — allowlist matcher + approval gate (TDD)

**Files:**
- Create: `packages/domain/src/auth/allowlist.ts`
- Create: `packages/domain/src/auth/allowlist.test.ts`
- Create: `packages/domain/src/auth/approval.ts`
- Create: `packages/domain/src/auth/approval.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Failing tests for allowlist**

```ts
import { describe, expect, it } from 'vitest';
import { isEmailAllowlisted, normalizeEmail, emailDomain } from './allowlist';

describe('isEmailAllowlisted', () => {
  it('allows matching domain', () => {
    expect(isEmailAllowlisted('a@AlloFresh.id', ['allofresh.id'], [])).toBe(true);
  });
  it('allows exact email', () => {
    expect(isEmailAllowlisted('Boss@x.com', [], ['boss@x.com'])).toBe(true);
  });
  it('rejects others', () => {
    expect(isEmailAllowlisted('a@gmail.com', ['allofresh.id'], ['boss@x.com'])).toBe(false);
  });
});
```

- [ ] **Step 2: Implement**

```ts
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailDomain(email: string): string | null {
  const n = normalizeEmail(email);
  const i = n.lastIndexOf('@');
  if (i <= 0 || i === n.length - 1) return null;
  return n.slice(i + 1);
}

export function isEmailAllowlisted(
  email: string,
  domains: string[],
  emails: string[],
): boolean {
  const n = normalizeEmail(email);
  const domainSet = new Set(domains.map((d) => d.trim().toLowerCase()));
  const emailSet = new Set(emails.map((e) => normalizeEmail(e)));
  if (emailSet.has(n)) return true;
  const d = emailDomain(n);
  return d !== null && domainSet.has(d);
}
```

- [ ] **Step 3: Approval helper tests + impl**

```ts
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export function canAccessApp(input: {
  approvalStatus: ApprovalStatus;
  isCandidate: boolean;
}): 'ok' | 'pending' | 'denied' {
  if (input.approvalStatus === 'pending') return 'pending';
  if (input.approvalStatus === 'rejected' || input.isCandidate) return 'denied';
  return 'ok';
}
```

- [ ] **Step 4: Run** `pnpm --filter @momus/domain test` — expect PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/auth packages/domain/src/index.ts
git commit -m "feat(domain): add auth allowlist and approval helpers"
```

---

### Task 3: Infra — allowlist repo + users ensure/approve/reject

**Files:**
- Create: `packages/infra/src/supabase/auth-allowlist.repository.ts`
- Create: `packages/infra/src/supabase/auth-allowlist.repository.test.ts` (optional light)
- Modify: `packages/infra/src/supabase/users.repository.ts`
- Modify: `packages/infra/src/supabase/users.repository.test.ts`
- Modify: `packages/infra/src/supabase/index.ts`

- [ ] **Step 1: `AuthAllowlistRepository`**

Methods:
- `list(): Promise<{ domains: string[]; emails: string[] }>`
- `replaceAll({ domains, emails }, createdBy?: number)` or `addDomain` / `removeDomain` / `addEmail` / `removeEmail` — prefer simple replace PUT for v1:

```ts
async setAllowlist(input: { domains: string[]; emails: string[] }, createdBy: number | null) {
  // delete all + insert normalized unique lists in a transaction if available;
  // else sequential delete/insert with service role
}
```

- [ ] **Step 2: Extend `UsersRepository`**

```ts
async ensureUser(input: {
  authUserId: string;
  email: string;
  name: string | null;
}): Promise<
  | { ok: true; user: ListedUser }
  | { ok: false; reason: 'not_allowlisted' }
> {
  const allow = await new AuthAllowlistRepository(this.db).list();
  if (!isEmailAllowlisted(input.email, allow.domains, allow.emails)) {
    return { ok: false, reason: 'not_allowlisted' };
  }
  // upsert by auth_user_id: if exists return; else insert pending + empty perms
}

async approveUser(id: number, permissions: string[]): Promise<ListedUser> {
  const perms = normalizePermissions(permissions);
  if (perms === null || perms.length === 0) throw new Error('invalid permissions');
  // set approval_status=approved, is_candidate=false, replace permissions
}

async rejectUser(id: number): Promise<ListedUser> {
  // set approval_status=rejected, clear permissions
}

async listUsers(filter?: { status?: 'pending' | 'approved' | 'rejected' }) {
  // filter by approval_status when provided
}
```

Update `inviteUser` to set `approval_status: 'approved'` and attach permissions (pre-approve path).

- [ ] **Step 3: Tests for ensure deny/allow logic with mocked allowlist + db where practical; at least normalize + approve permission validation

- [ ] **Step 4: Commit**

```bash
git add packages/infra/src/supabase
git commit -m "feat(infra): ensure-user, approve/reject, and auth allowlist repo"
```

---

### Task 4: Session + middleware pending gate

**Files:**
- Modify: `apps/web/lib/auth-map.ts` + tests — include `approvalStatus`
- Modify: `apps/web/lib/auth.ts`
- Modify: `apps/web/middleware.ts`

- [ ] **Step 1: Extend `MomusUserRow` / `AuthUser` with `approvalStatus`

- [ ] **Step 2: `getSessionUser` loads `approval_status`; map with `canAccessApp`:
  - `denied` → 401/403 appropriate message
  - `pending` → return `{ user, access: 'pending' }` **or** separate `getSessionAccess()` — prefer:

```ts
export type SessionResult =
  | { user: AuthUser; access: 'ok' }
  | { user: AuthUser; access: 'pending' }
  | { error: NextResponse };
```

Update `requirePermission` to require `access === 'ok'`.  
Add `requirePendingOrOk()` for ensure-user if needed.

- [ ] **Step 3: Middleware**

After `updateSession`, if user present:
- Call lightweight check OR rely on pages — better: middleware cannot easily hit DB without service role. Options:
  - **A)** Cookie/claim only in middleware is insufficient
  - **B)** Middleware allows `/pending-approval` for any authenticated user; page + API enforce pending
  - **C)** Middleware uses service-role env to read approval_status

**Choose C for security** (prevent pending API probing): in middleware, if `user` from Supabase, use `createServerClient()` from infra (service role available on Vercel) to read `approval_status` + `is_candidate`, then `canAccessApp`.

```ts
if (authUser) {
  const access = await resolveAccessForAuthId(authUser.id); // infra helper
  if (access === 'pending') {
    if (pathname === '/pending-approval' || pathname.startsWith('/api/auth/sign-out') || pathname.startsWith('/api/auth/ensure-user')) {
      return response;
    }
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: 'Pending approval' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/pending-approval', request.url));
  }
  if (access === 'denied') {
    // sign-in error page or force sign-out redirect
  }
}
```

Also allow `/pending-approval` in public-ish authenticated list.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/auth-map.ts apps/web/lib/auth-map.test.ts apps/web/lib/auth.ts apps/web/middleware.ts
git commit -m "feat(web): gate pending users in session and middleware"
```

---

### Task 5: ensure-user + approve/reject + allowlist APIs

**Files:**
- Create: `apps/web/app/api/auth/ensure-user/route.ts`
- Create: `apps/web/app/api/users/[id]/approve/route.ts`
- Create: `apps/web/app/api/users/[id]/reject/route.ts`
- Create: `apps/web/app/api/settings/auth-allowlist/route.ts`
- Modify: `apps/web/app/api/users/route.ts` — `status` query

- [ ] **Step 1: POST `/api/auth/ensure-user`**

Requires Supabase session (not full BB-PERM). Body optional. Reads auth user email/name from session; calls `UsersRepository.ensureUser`. If `not_allowlisted` → sign out cookies optional + 403 `{ message: 'Email not allowlisted' }`. Returns `{ success, user, access }`.

- [ ] **Step 2: Approve / reject routes** with `requireManageUsers` + CSRF

- [ ] **Step 3: Allowlist GET/PUT** with `requireManageUsers`; PUT CSRF; body `{ domains: string[], emails: string[] }`

- [ ] **Step 4: GET users `?status=pending|approved`**

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api
git commit -m "feat(web): add ensure-user, approve/reject, and allowlist APIs"
```

---

### Task 6: Sign-in Google + password sign-up + pending page

**Files:**
- Modify: `apps/web/components/auth/sign-in-form.tsx`
- Modify: `apps/web/app/auth/callback/route.ts`
- Create: `apps/web/app/pending-approval/page.tsx`
- Modify: `apps/web/components/layout/app-header.tsx`
- Modify: `apps/web/app/globals.css` (minimal pending styles)

- [ ] **Step 1: Sign-in form**
  - Add **Continue with Google** button calling `signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback?next=...` } })`
  - Keep password sign-in
  - Add sign-up mode: `signUp({ email, password })` then `apiJson('/api/auth/ensure-user', { method: 'POST' })` then route by `access`
  - After password sign-in: call ensure-user then route
  - Remove OTP toggle from UI (per spec)

- [ ] **Step 2: Auth callback** after `exchangeCodeForSession`, server-side call ensure-user logic (reuse repository directly in route with service client + auth user from session) then redirect pending vs app

- [ ] **Step 3: Pending page** — copy + Sign out via existing API

- [ ] **Step 4: Header** — hide on `/pending-approval` and `/sign-in`

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/auth apps/web/app/auth apps/web/app/pending-approval apps/web/components/layout/app-header.tsx apps/web/app/globals.css
git commit -m "feat(web): Google sign-in, signup ensure-user, and pending page"
```

---

### Task 7: Users admin — Pending / Allowlist / Approve dialog

**Files:**
- Modify: `apps/web/components/settings/users-admin.tsx`

- [ ] **Step 1: Tabs** — Pending | Active | Allowlist

- [ ] **Step 2: Pending table** — Approve opens modal with permission checkboxes (default `view_analytics`); POST approve; Reject button → POST reject

- [ ] **Step 3: Active** — existing edit/deactivate (deactivate = `is_candidate: true`, clear permissions)

- [ ] **Step 4: Allowlist editor** — lists + add domain/email + save PUT `/api/settings/auth-allowlist`

- [ ] **Step 5: Invite** — ensure creates `approved` user (repo already updated)

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/settings/users-admin.tsx
git commit -m "feat(web): pending approval and allowlist admin UI"
```

---

### Task 8: Docs + verification

**Files:**
- Modify: `docs/ops/supabase-auth-bootstrap.md`
- Modify: `history-log.md` (short entry)

- [ ] **Step 1: Document** Google provider setup, redirect URLs, allowlist seed, approval flow, no Dashboard for routine users

- [ ] **Step 2: Run**

```bash
pnpm typecheck
pnpm --filter @momus/domain test
pnpm --filter @momus/infra test
pnpm --filter @momus/web exec vitest run
```

- [ ] **Step 3: Commit**

```bash
git add docs/ops/supabase-auth-bootstrap.md history-log.md
git commit -m "docs(auth): Google OAuth2 and approval runbook updates"
```

---

## Spec coverage

| Spec item | Task |
|---|---|
| `approval_status` + allowlist tables | 1 |
| Domain OR email allowlist rule | 2, 3 |
| ensure-user | 3, 5, 6 |
| Pending middleware/page | 4, 6 |
| Google OAuth2 + password | 6 |
| Admin approve with permissions | 5, 7 |
| Allowlist admin UI | 5, 7 |
| Invite pre-approve | 3, 7 |
| Ops docs | 8 |

## Out of scope

Vault, Inngest, migration, other IdPs, auto-revoke when allowlist removes approved users.
