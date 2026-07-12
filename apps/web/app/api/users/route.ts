import type { ApprovalStatus } from '@momus/domain';
import {
  UserConflictError,
  UsersRepository,
  createServerClient,
} from '@momus/infra';
import { NextResponse } from 'next/server';
import { assertCsrf, requireManageUsers } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

const VALID_STATUSES = new Set<ApprovalStatus>(['pending', 'approved', 'rejected']);

export async function GET(request: Request) {
  const auth = await requireManageUsers();
  if ('error' in auth) return auth.error;

  const statusRaw = new URL(request.url).searchParams.get('status');
  let filter: { status?: ApprovalStatus } | undefined;
  if (statusRaw) {
    if (!VALID_STATUSES.has(statusRaw as ApprovalStatus)) {
      return jsonFail('status must be pending, approved, or rejected', 422);
    }
    filter = { status: statusRaw as ApprovalStatus };
  }

  try {
    const repo = new UsersRepository(createServerClient());
    const users = await repo.listUsers(filter);
    return NextResponse.json({ success: true, users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list users';
    return jsonFail(message, 500);
  }
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const auth = await requireManageUsers();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const permissions = body.permissions;

    if (!email || !email.includes('@')) {
      return jsonFail('Valid email is required', 422);
    }

    const repo = new UsersRepository(createServerClient());
    const user = await repo.inviteUser({ email, name, permissions });
    return jsonOk({ user });
  } catch (err) {
    if (err instanceof UserConflictError) {
      return jsonFail(err.message, 409);
    }
    const message = err instanceof Error ? err.message : 'Failed to invite user';
    if (message === 'Invalid permissions') return jsonFail(message, 422);
    return jsonFail(message, 500);
  }
}
