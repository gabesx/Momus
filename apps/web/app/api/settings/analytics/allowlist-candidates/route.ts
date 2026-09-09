import { UsersRepository, createServerClient } from '@momus/infra';
import { requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const repo = new UsersRepository(createServerClient());
    const approved = await repo.listUsers({ status: 'approved' });
    const users = approved.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    }));
    return jsonOk({ users });
  } catch (err) {
    return jsonFail(
      err instanceof Error ? err.message : 'Failed to load allowlist candidates',
      500,
    );
  }
}
