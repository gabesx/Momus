import { NextResponse } from 'next/server';
import { createServerClient } from '@momus/infra/supabase';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  permissions: string[];
};

export type UserPermission = 'view_analytics' | 'access_settings' | 'manage_users';

async function resolveDevUser(): Promise<{ user: AuthUser } | { error: NextResponse }> {
  if (process.env.MOMUS_DEV_AUTH_BYPASS !== 'true' && process.env.NODE_ENV === 'production') {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authentication required' },
        { status: 401 },
      ),
    };
  }

  const db = createServerClient();
  const { data: user, error } = await db
    .from('users')
    .select('id, email, name, is_candidate')
    .eq('email', process.env.MOMUS_DEV_USER_EMAIL ?? 'admin@momus.local')
    .maybeSingle();

  if (error || !user || user.is_candidate) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Authenticated non-candidate user required' },
        { status: 401 },
      ),
    };
  }

  const { data: perms } = await db
    .from('user_permissions')
    .select('permission')
    .eq('user_id', user.id);

  const permissions = (perms ?? []).map((p) => p.permission as string);

  return {
    user: {
      id: Number(user.id),
      email: user.email as string,
      name: (user.name as string) ?? user.email,
      permissions,
    },
  };
}

/** BB-PERM-01 — require authenticated non-candidate user with a permission. */
export async function requirePermission(
  permission: UserPermission,
): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const resolved = await resolveDevUser();
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
