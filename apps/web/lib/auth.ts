import { NextResponse } from 'next/server';
import { canAccessApp } from '@momus/domain';
import { createServerClient } from '@momus/infra/supabase';
import { mapMomusUser, type AuthUser, type MomusUserRow } from '@/lib/auth-map';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type { AuthUser };
export type UserPermission = 'view_analytics' | 'access_settings' | 'manage_users';

export type SessionResult =
  | { user: AuthUser; access: 'ok' }
  | { user: AuthUser; access: 'pending' }
  | { error: NextResponse };

async function loadPermissions(userId: number | string): Promise<string[]> {
  const db = createServerClient();
  const { data: perms } = await db
    .from('user_permissions')
    .select('permission')
    .eq('user_id', userId);
  return (perms ?? []).map((p) => p.permission as string);
}

function mapErrorResponse(reason: 'no_momus_user', devBypass = false): NextResponse {
  const message =
    reason === 'no_momus_user' && !devBypass
      ? 'No Momus user linked to this account'
      : 'Authenticated non-candidate user required';
  return NextResponse.json({ success: false, message }, { status: 401 });
}

function deniedResponse(): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Account access denied' },
    { status: 403 },
  );
}

function pendingResponse(): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Pending approval' },
    { status: 403 },
  );
}

async function resolveMappedUser(
  row: MomusUserRow | null,
  devBypass = false,
): Promise<SessionResult> {
  if (!row) {
    return { error: mapErrorResponse('no_momus_user', devBypass) };
  }

  const permissions = await loadPermissions(row.id);
  const mapped = mapMomusUser(row, permissions);
  if (!mapped.ok) {
    return { error: mapErrorResponse(mapped.reason, devBypass) };
  }

  const access = canAccessApp({
    approvalStatus: mapped.user.approvalStatus,
    isCandidate: row.is_candidate,
  });

  if (access === 'denied') {
    return { error: deniedResponse() };
  }

  if (access === 'pending') {
    return { user: mapped.user, access: 'pending' };
  }

  return { user: mapped.user, access: 'ok' };
}

async function resolveDevUser(): Promise<SessionResult> {
  const db = createServerClient();
  const { data: row, error } = await db
    .from('users')
    .select('id, email, name, is_candidate, approval_status')
    .eq('email', process.env.MOMUS_DEV_USER_EMAIL ?? 'admin@momus.local')
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authenticated non-candidate user required' },
        { status: 401 },
      ),
    };
  }

  return resolveMappedUser(row, true);
}

/** Current session user, or error if signed out / denied / missing link. */
export async function getSessionUser(): Promise<SessionResult> {
  if (process.env.MOMUS_DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return resolveDevUser();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      ),
    };
  }

  const db = createServerClient();
  const { data: row, error } = await db
    .from('users')
    .select('id, email, name, is_candidate, approval_status')
    .eq('auth_user_id', authUser.id)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { success: false, message: 'No Momus user linked to this account' },
        { status: 401 },
      ),
    };
  }

  return resolveMappedUser(row);
}

/** Authenticated session with ok or pending access (for ensure-user and similar). */
export async function requirePendingOrOk(): Promise<SessionResult> {
  return getSessionUser();
}

export type SupabaseAuthUser = {
  id: string;
  email: string;
  name: string | null;
};

/** Supabase Auth session only — does not require a linked public.users row. */
export async function getSupabaseAuthUser(): Promise<
  { authUser: SupabaseAuthUser } | { error: NextResponse }
> {
  if (process.env.MOMUS_DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return {
      authUser: {
        id: 'dev-bypass',
        email: process.env.MOMUS_DEV_USER_EMAIL ?? 'admin@momus.local',
        name: 'Dev User',
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      ),
    };
  }

  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    null;

  return {
    authUser: {
      id: user.id,
      email: user.email,
      name,
    },
  };
}

/** BB-PERM-01 — require authenticated approved user with a permission. */
export async function requirePermission(
  permission: UserPermission,
): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const resolved = await getSessionUser();
  if ('error' in resolved) return resolved;

  if (resolved.access !== 'ok') {
    return { error: pendingResponse() };
  }

  if (!resolved.user.permissions.includes(permission)) {
    return {
      error: NextResponse.json(
        { success: false, message: `Missing permission: ${permission}` },
        { status: 403 },
      ),
    };
  }

  return { user: resolved.user };
}

export async function requireAccessSettings(): Promise<
  { user: AuthUser } | { error: NextResponse }
> {
  return requirePermission('access_settings');
}

export async function requireViewAnalytics(): Promise<
  { user: AuthUser } | { error: NextResponse }
> {
  return requirePermission('view_analytics');
}

export async function requireManageUsers(): Promise<
  { user: AuthUser } | { error: NextResponse }
> {
  return requirePermission('manage_users');
}

/** Lightweight CSRF guard for state-changing routes (BB-NFR / conventions). */
export function assertCsrf(request: Request): NextResponse | null {
  if (process.env.NODE_ENV === 'development' && process.env.MOMUS_DEV_AUTH_BYPASS === 'true') {
    return null;
  }
  const header = request.headers.get('x-requested-with');
  if (header !== 'XMLHttpRequest' && header !== 'Momus') {
    return NextResponse.json(
      { success: false, message: 'Missing CSRF header (X-Requested-With)' },
      { status: 403 },
    );
  }
  return null;
}
