import { canAccessApp } from '@momus/domain';
import { UsersRepository, createServerClient, type UserRecord } from '@momus/infra';
import type { AuthUser } from '@/lib/auth';
import { assertCsrf, getSessionUser, getSupabaseAuthUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { jsonFail, jsonOk } from '@/lib/sync-params';

function mapUserRecord(record: UserRecord): AuthUser {
  return {
    id: record.id,
    email: record.email,
    name: record.name ?? record.email,
    permissions: record.permissions,
    approvalStatus: record.approval_status,
  };
}

function accessForRecord(record: UserRecord): 'ok' | 'pending' | 'denied' {
  return canAccessApp({
    approvalStatus: record.approval_status,
    isCandidate: record.is_candidate,
  });
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  if (process.env.MOMUS_DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    const session = await getSessionUser();
    if ('error' in session) return session.error;
    return jsonOk({ user: session.user, access: session.access });
  }

  const auth = await getSupabaseAuthUser();
  if ('error' in auth) return auth.error;

  try {
    const repo = new UsersRepository(createServerClient());
    const result = await repo.ensureUser({
      authUserId: auth.authUser.id,
      email: auth.authUser.email,
      name: auth.authUser.name,
    });

    if (!result.ok) {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut();
      return jsonFail('Email not allowlisted', 403);
    }

    const access = accessForRecord(result.user);
    return jsonOk({ user: mapUserRecord(result.user), access });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ensure user';
    return jsonFail(message, 500);
  }
}
