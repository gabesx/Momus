# Supabase Auth — First Admin Bootstrap

One-time runbook to enable production sign-in on Momus project `sdzoovwjcjqjgfoqszpf`. All further users are invited from **Settings → Users** (`manage_users`).

## 1. Create the first Auth user

In [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Users**:

1. **Add user** → **Create new user**
2. Enter the admin email and a strong password
3. Enable **Auto Confirm User** (or confirm the email manually before first login)

## 2. Enable Email provider

**Authentication** → **Providers** → **Email**:

- Enable the Email provider
- **Password sign-in:** enabled (default sign-in mode on `/sign-in`)
- **Magic link / OTP:** optional — enable if you want the magic-link toggle on the sign-in page (`signInWithOtp`). Requires confirmed email and correct redirect URLs (step 3)

## 3. Site URL and redirect URLs

**Authentication** → **URL Configuration**:

| Setting | Value |
|---|---|
| **Site URL** | `https://momus.vercel.app` |
| **Redirect URLs** | `https://momus.vercel.app/auth/callback` |
| | `https://*.vercel.app/auth/callback` (Vercel preview deployments) |

Magic link and OTP flows return through `/auth/callback`. Add any additional staging hosts if used.

## 4. Link Momus user and grant permissions

In **SQL Editor** (service role), copy the new user’s UUID from **Authentication → Users** (`auth.users.id`).

If a `public.users` row already exists for the admin email:

```sql
UPDATE public.users
SET auth_user_id = '<auth.users.id>'
WHERE email = '<admin-email>' AND is_candidate = false;

INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p
FROM public.users u
CROSS JOIN unnest(ARRAY['view_analytics','access_settings','manage_users']) AS p
WHERE u.email = '<admin-email>'
ON CONFLICT DO NOTHING;
```

If no `public.users` row exists:

```sql
INSERT INTO public.users (email, name, is_candidate, auth_user_id)
VALUES ('<admin-email>', '<display-name>', false, '<auth.users.id>')
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
| `manage_users` | Settings → Users (invite, edit, deactivate) |

## 5. Verify sign-in

1. Open `https://momus.vercel.app/sign-in` (or local `http://127.0.0.1:3000/sign-in`)
2. Sign in with email + password
3. Confirm redirect to `/` and Settings are visible
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

**Never** set `MOMUS_DEV_AUTH_BYPASS=true` on Vercel **Production**. The app ignores it when `NODE_ENV=production`, but leaving it unset avoids confusion and misconfigured previews.

Inngest (when wired): `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` — see `docs/ops/runbook.md`.

## 7. Ongoing user management

After bootstrap, create users only via **Settings → Users** (`manage_users`). That flow creates the Auth user and upserts `public.users` + `user_permissions`. Do not enable public self-signup.
