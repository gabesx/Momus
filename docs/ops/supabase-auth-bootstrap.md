# Supabase Auth — First Admin Bootstrap

One-time runbook to enable production sign-in on Momus project `sdzoovwjcjqjgfoqszpf`. After bootstrap, **do not** create routine users in the Supabase Dashboard — people self-register on the website (Google or email/password), and admins approve them in **Settings → Users** (`manage_users`).

## 0. Apply database migration

Before enabling Google OAuth or self-signup, apply the approval + allowlist migration:

| Environment | Command |
|---|---|
| Local (Supabase CLI stack) | `pnpm db:migrate` (runs `supabase migration up`) |
| Remote Momus project | Apply `supabase/migrations/20260712120000_auth_approval_allowlist.sql` via Supabase Dashboard **SQL Editor** or your usual migration pipeline |

This migration adds:

- `public.users.approval_status` (`pending` \| `approved` \| `rejected`; existing rows backfilled to `approved`)
- `public.auth_allowed_domains` and `public.auth_allowed_emails`
- Seed domain **`allofresh.id`**

Verify after apply:

```sql
SELECT domain FROM public.auth_allowed_domains;
-- Expected: allofresh.id
```

## 1. Create the first Auth user

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Users**:

1. **Add user** → **Create new user**
2. Enter the admin email and a strong password
3. Enable **Auto Confirm User** (or confirm the email manually before first login)

This is a **one-time bootstrap** step for the first admin. Do not use Dashboard user creation for day-to-day onboarding.

## 2. Enable auth providers

### Email

**Authentication** → **Providers** → **Email**:

- Enable the Email provider
- **Password sign-in:** enabled (sign-in and sign-up on `/sign-in`)
- **Magic link / OTP:** optional — enable if you want the magic-link toggle on the sign-in page (`signInWithOtp`). Requires confirmed email and correct redirect URLs (step 3)

### Google OAuth2

**Authentication** → **Providers** → **Google**:

1. Enable the Google provider
2. Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (Web application)
3. Set **Authorized redirect URI** to the Supabase callback shown in the provider panel:

   `https://sdzoovwjcjqjgfoqszpf.supabase.co/auth/v1/callback`

4. Paste **Client ID** and **Client Secret** into Supabase and save

Momus uses `signInWithOAuth({ provider: 'google' })` on `/sign-in`; after Google returns to Supabase, the session is exchanged at Momus `/auth/callback`.

## 3. Site URL and redirect URLs

**Authentication** → **URL Configuration**:

| Setting | Value |
|---|---|
| **Site URL** | `https://momus.vercel.app` |
| **Redirect URLs** | `https://momus.vercel.app/auth/callback` |
| | `https://*.vercel.app/auth/callback` (Vercel preview deployments) |
| | `http://127.0.0.1:3000/auth/callback` (local dev) |
| | `http://localhost:3000/auth/callback` (local dev, alternate host) |

Google OAuth, password sign-in, and optional magic link/OTP all return through `/auth/callback`. Add any additional staging hosts if used.

For local dev, use `http://127.0.0.1:3000/sign-in` (or `localhost:3000`) so the callback origin matches a listed redirect URL.

## 4. Link Momus user and grant permissions

In **SQL Editor** (service role), copy the new user’s UUID from **Authentication → Users** (`auth.users.id`).

If a `public.users` row already exists for the admin email:

```sql
UPDATE public.users
SET auth_user_id = '<auth.users.id>',
    approval_status = 'approved',
    is_candidate = false
WHERE email = '<admin-email>';

INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p
FROM public.users u
CROSS JOIN unnest(ARRAY['view_analytics','access_settings','manage_users']) AS p
WHERE u.email = '<admin-email>'
ON CONFLICT DO NOTHING;
```

If no `public.users` row exists:

```sql
INSERT INTO public.users (email, name, is_candidate, auth_user_id, approval_status)
VALUES ('<admin-email>', '<display-name>', false, '<auth.users.id>', 'approved')
RETURNING id;

-- Use the returned id, or join by email:
INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p
FROM public.users u
CROSS JOIN unnest(ARRAY['view_analytics','access_settings','manage_users']) AS p
WHERE u.email = '<admin-email>'
ON CONFLICT DO NOTHING;
```

Permissions map to BB-PERM:

| Permission | Capability |
|---|---|
| `view_analytics` | Bug Budget, analytics, tracker, leaderboard |
| `access_settings` | Settings (Atlassian, sync, etc.) |
| `manage_users` | Settings → Users (approve, invite, edit, deactivate, allowlist) |

## 5. Verify sign-in

1. Open `https://momus.vercel.app/sign-in` (or local `http://127.0.0.1:3000/sign-in`)
2. Sign in with email + password or **Continue with Google**
3. Confirm redirect to `/` and Settings are visible (first admin is `approved`, not pending)
4. Optional: test magic link toggle if Email OTP/magic link is enabled

## 6. Environment variables

Set on **Vercel** (Production + Preview) and in local `.env.local`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Momus project URL (`https://sdzoovwjcjqjgfoqszpf.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + SSR anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server invite/admin APIs and repositories |
| `TZ` | `Asia/Jakarta` (BB timezone) |

Optional (local / Vitest only):

| Variable | Purpose |
|---|---|
| `MOMUS_DEV_AUTH_BYPASS` | Skip real Auth when `true` and `NODE_ENV !== 'production'` |
| `MOMUS_DEV_USER_EMAIL` | Email of seeded dev user (default `admin@momus.local`) |

### Do not set auth bypass in production

**Never** set `MOMUS_DEV_AUTH_BYPASS=true` on Vercel **Production** (or any production environment). The app ignores it when `NODE_ENV=production`, but leaving it unset avoids confusion and misconfigured previews.

Inngest (when wired): `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — see `docs/ops/runbook.md`.

## 7. Ongoing user management

### Self-serve registration (default)

After bootstrap, **do not** create users in Supabase Dashboard for routine onboarding. Users join from `/sign-in`:

- **Continue with Google** (OAuth2 via Supabase Google provider)
- **Email + password** (sign-up)

Flow:

1. User authenticates with Supabase Auth
2. Momus `POST /api/auth/ensure-user` upserts `public.users` with `approval_status = pending` when allowlisted
3. Middleware routes pending users to **`/pending-approval`** (sign-out only; no app nav)
4. Admin with `manage_users` opens **Settings → Users → Pending**, approves with permission checkboxes (default `view_analytics`), or rejects

Approved users get app access via existing BB-PERM checks. Rejected or soft-deactivated users are denied.

### Allowlist

Registration is limited to allowlisted **domains** or **exact emails**:

| Source | Details |
|---|---|
| Seed (migration) | Domain `allofresh.id` |
| In-app | **Settings → Users → Allowlist** (`manage_users`) — add/remove domains and exact emails |

Rule: allow if the email’s domain matches a listed domain **or** the full email matches a listed address. Non-allowlisted sign-ups are rejected at ensure-user / callback with a clear error on `/sign-in`.

Ensure the first admin’s email domain (or exact address) is allowlisted before testing self-signup.

### Admin invite (optional shortcut)

**Settings → Users → Invite** remains available: creates the Auth user and can set `approval_status = approved` immediately with chosen permissions — useful for pre-approved accounts without waiting in pending.

### Do not use Dashboard for routine user creation

| Task | Where |
|---|---|
| First admin bootstrap | Supabase Dashboard (sections 1 and 4 above) — **once** |
| Day-to-day onboarding | Website self-signup + admin approve in **Settings → Users** |
| Pre-approved account | Admin **Invite** in **Settings → Users** |
| Block / remove access | Reject pending, soft-deactivate active, or edit allowlist in **Settings → Users** |
