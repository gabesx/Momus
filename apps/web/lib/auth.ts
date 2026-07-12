import { NextResponse } from 'next/server';
import { createServerClient } from '@momus/infra/supabase';
import { mapMomusUser, type AuthUser, type MomusUserRow } from '@/lib/auth-map';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type { AuthUser };
export type UserPermission = 'view_analytics' | 'access_settings' | 'manage_users';

async function loadPermissions(userId: number | string): Promise<string[]> {
  const db = createServerClient();
  const { data: perms } = await db
    .from('user_permissions')
    .select('permission')
    .eq('user_id', userId);
  return (perms ?? []).map((p) => p.permission as string);
}

function mapErrorResponse(
  reason: 'no_momus_user' | 'candidate',
  devBypass = false,
): NextResponse {
  const message =
    reason === 'no_momus_user' && !devBypass
      ? 'No Momus user linked to this account'
      : 'Authenticated non-candidate user required';
  return NextResponse.json({ success: false, message }, { status: 401 });
}

async function resolveMappedUser(
  row: MomusUserRow | null,
  devBypass = false,
): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const permissions = row ? await loadPermissions(row.id) : [];
  const mapped = mapMomusUser(row, permissions);
  if (!mapped.ok) {
    return { error: mapErrorResponse(mapped.reason, devBypass) };
  }
  return { user: mapped.user };
}

async function resolveDevUser(): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const db = createServerClient();
  const { data: row, error } = await db
    .from('users')
    .select('id, email, name, is_candidate')
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

/** Current session user, or 401 if signed out / missing auth. */
export async function getSessionUser(): Promise<{ user: AuthUser } | { error: NextResponse }> {
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
    .select('id, email, name, is_candidate')
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

/** BB-PERM-01 — require authenticated non-candidate user with a permission. */
export async function requirePermission(
  permission: UserPermission,
): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const resolved = await getSessionUser();
  if ('error' in resolved) return resolved;

  if (!resolved.user.permissions.includes(permission)) {
    return {
      error: NextResponse.json(
        { success: false, message: `Missing permission: ${permission}` },
        { status: 403 },
      ),
    };
  }

  return resolved;
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
