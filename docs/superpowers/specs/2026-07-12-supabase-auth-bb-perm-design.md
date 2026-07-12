# Supabase Auth + BB-PERM — Design Spec

**Date:** 2026-07-12  
**Status:** Approved for planning  
**Branch:** `feat/supabase-auth`  
**Scope:** Replace `MOMUS_DEV_AUTH_BYPASS` with real Supabase Auth; enforce BB-PERM-01/02/03; admin user invite UI  
**Approach:** Supabase Auth + `@supabase/ssr` cookie sessions on Momus project `sdzoovwjcjqjgfoqszpf` (Approach 1)

## Goal

Ship production-ready authentication for Momus: email/password and magic link/OTP sign-in, session-backed permission checks against `public.users` + `user_permissions`, and an admin Users screen to invite and manage users. No QARATMS shared auth.

## Non-goals

- DEV-9 Jira Vault encryption (separate workstream)
- Inngest production wiring / live sync E2E (separate)
- Scheduler, retention, audit (Phase 5)
- Migration / parallel run (Phase 6)
- Public self-signup
- Separate Supabase Auth project
- QARATMS or any shared legacy identity

## Decisions

| Topic | Choice |
|---|---|
| Auth host | Same Momus Supabase project (`sdzoovwjcjqjgfoqszpf`) |
| Sign-in methods | Email + password (default) + toggle for magic link / OTP |
| User provisioning | Admins invite from Momus Users settings (`manage_users`) |
| First admin | One-time: create Auth user in Supabase Dashboard; SQL link `auth_user_id` + grant all three permissions |
| Session | `@supabase/ssr` HTTP-only cookies; middleware refresh |
| Authorization | `auth.getUser()` → `public.users` by `auth_user_id` → reject missing/`is_candidate` → `user_permissions` |
| Prod bypass | Remove production use of `MOMUS_DEV_AUTH_BYPASS` |
| Local/test bypass | Optional, explicit env for Vitest/local only — never enabled in Vercel production |
| Soft deactivate | Clear permissions and/or set `is_candidate` rather than hard-delete Auth users by default |

## Architecture

```mermaid
flowchart LR
  Browser -->|email/password or magic link/OTP| SignIn["/sign-in"]
  SignIn -->|@supabase/ssr cookies| Middleware
  Middleware -->|session OK| App["Pages + APIs"]
  Middleware -->|no session| SignIn
  App -->|getUser| Auth["Supabase Auth"]
  App -->|auth_user_id → permissions| Users["public.users + user_permissions"]
  Admin["Users settings"] -->|service role invite| Auth
  Admin --> Users
```

### Session resolution

1. Middleware refreshes Supabase session cookies on matched routes.
2. Unauthenticated HTML → redirect `/sign-in` (preserve `?next=` when safe).
3. Unauthenticated `/api/*` (except public allowlist) → `401` `{ success: false, message: "Authentication required" }`.
4. Authenticated handlers call shared `getSessionUser()`:
   - `supabase.auth.getUser()`
   - Load `public.users` where `auth_user_id = auth.uid()`
   - Fail if no row or `is_candidate = true`
   - Load `user_permissions` for that `users.id`
5. `requirePermission` / `requireViewAnalytics` / `requireAccessSettings` unchanged in call sites; implementation uses real session.

### Public allowlist

- `/sign-in` and Auth callback/confirm routes
- `/api/health`, `/api/health/*`
- Static `/_next/*`, favicon

### CSRF

Keep `X-Requested-With` check on state-changing routes (BB-NFR). Client `apiJson` already sends the header.

## Sign-in UX

**Route:** `/sign-in`

- Default mode: email + password (`signInWithPassword`)
- Toggle: Magic link / OTP (`signInWithOtp`); hide password field
- Success → `next` query or `/`
- Failures: invalid credentials, email not confirmed, Auth OK but no Momus user / candidate → clear inline error
- Replace `/signed-out` stub as primary post-logout destination with `/sign-in`

**Sign-out:** Clear Supabase session cookies; redirect `/sign-in`.

## Users admin

**Capability:** `manage_users` only.

**UI:** Settings area screen (e.g. `/settings/users` or Atlassian settings sibling tab — prefer dedicated `/settings/users` under existing app shell).

**Capabilities:**

| Action | Behavior |
|---|---|
| List | email, name, candidate flag, permissions |
| Invite | email + name + permission checkboxes → service-role Auth create/invite → upsert `public.users` + `user_permissions` |
| Edit permissions | Replace permission set for user |
| Soft deactivate | Set `is_candidate` and/or clear permissions; optionally ban/disable Auth user via admin API |

No public registration endpoint.

## Bootstrap (one-time)

Documented runbook steps (not in-app):

1. In Supabase Dashboard → Authentication: create user (email + password).
2. Enable Email provider; configure magic link/OTP as needed for the project.
3. SQL (service role / SQL editor):

```sql
UPDATE public.users
SET auth_user_id = '<auth.users.id>'
WHERE email = '<admin-email>' AND is_candidate = false;

-- Ensure all three permissions exist for that user_id
INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p
FROM public.users u
CROSS JOIN unnest(ARRAY['view_analytics','access_settings','manage_users']) AS p
WHERE u.email = '<admin-email>'
ON CONFLICT DO NOTHING;
```

4. If no `public.users` row exists for that email, `INSERT` then attach permissions.
5. All further users via Momus Users UI.

## APIs

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/me` | session | Existing; returns real user + permissions |
| POST | `/api/auth/sign-out` | session | Supabase sign-out + clear cookies |
| GET | `/api/users` | `manage_users` | List Momus users |
| POST | `/api/users` | `manage_users` | Invite |
| PATCH | `/api/users/[id]` | `manage_users` | Permissions / soft deactivate |

Invite conflict (email exists) → `409`.

Sign-in itself uses browser Supabase client / route handlers that set cookies — prefer `@supabase/ssr` server helpers over ad-hoc cookie writes.

## Environment (Vercel production)

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Momus project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + SSR anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Invite + server repositories (existing pattern) |
| `TZ` | `Asia/Jakarta` |

Do **not** set `MOMUS_DEV_AUTH_BYPASS=true` on Vercel production.

Supabase Dashboard: Site URL + redirect URLs must include production and preview hosts for magic link/OTP.

## Errors

| Case | Response |
|---|---|
| No session | 401 / redirect `/sign-in` |
| Session but no `public.users` or candidate | 401/403 with explicit message |
| Missing permission | 403 `Missing permission: …` |
| Invite duplicate | 409 |

## Testing

- Unit: session → user mapping; candidate block; permission matrix helpers
- API: list/invite/patch with mocked Auth Admin + DB
- Manual: password login; magic link/OTP toggle; invite → login; Settings button only with `access_settings`; sync-status ownership still BB-PERM-02

## Acceptance (this sub-project)

- [ ] Production cannot use auth bypass
- [ ] Seeded admin can sign in with password
- [ ] Magic link/OTP toggle works when email provider configured
- [ ] Unauthenticated users cannot reach app APIs/pages (except allowlist)
- [ ] `manage_users` can invite and assign BB-PERM permissions
- [ ] AC-7 path for permission matrix enforceable with real sessions

## Follow-on workstreams (not this spec)

1. DEV-9 Vault + Inngest prod + live Jira sync  
2. Scheduler / retention / audit  
3. Migration & parallel run  
