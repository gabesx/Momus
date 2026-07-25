import {
  UserNotFoundError,
  UsersRepository,
  createServerClient,
  type UserRecord,
} from '@momus/infra';
import { assertCsrf, requireManageUsers } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;

  const auth = await requireManageUsers();
  if ('error' in auth) return auth.error;

  try {
    const { id: idRaw } = await context.params;
    const id = Number(idRaw);
    if (!Number.isInteger(id) || id <= 0) {
      return jsonFail('Invalid user id', 422);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const input: { permissions?: unknown; is_candidate?: boolean } = {};
    const password = typeof body.password === 'string' ? body.password : '';

    if (body.permissions !== undefined) {
      input.permissions = body.permissions;
    }
    if (body.is_candidate !== undefined) {
      if (typeof body.is_candidate !== 'boolean') {
        return jsonFail('is_candidate must be a boolean', 422);
      }
      input.is_candidate = body.is_candidate;
    }

    const hasProfileChange =
      input.permissions !== undefined || input.is_candidate !== undefined;
    if (!password && !hasProfileChange) {
      return jsonFail('No changes provided', 422);
    }

    const repo = new UsersRepository(createServerClient());
    let user: UserRecord | null = null;

    if (password) {
      user = await repo.updateUserPassword(id, password);
    }
    if (hasProfileChange) {
      user = await repo.updateUser(id, input);
    }

    return jsonOk({ user });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      return jsonFail(err.message, 404);
    }
    const message = err instanceof Error ? err.message : 'Failed to update user';
    if (
      message === 'Invalid permissions' ||
      message.startsWith('Password must') ||
      message.includes('no linked auth')
    ) {
      return jsonFail(message, 422);
    }
    return jsonFail(message, 500);
  }
}
