import {
  UserNotFoundError,
  UsersRepository,
  createServerClient,
} from '@momus/infra';
import { assertCsrf, requireManageUsers } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

    const repo = new UsersRepository(createServerClient());
    const user = await repo.rejectUser(id);
    return jsonOk({ user });
  } catch (err) {
    if (err instanceof UserNotFoundError) {
      return jsonFail(err.message, 404);
    }
    const message = err instanceof Error ? err.message : 'Failed to reject user';
    return jsonFail(message, 500);
  }
}
