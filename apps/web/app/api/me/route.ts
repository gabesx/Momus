import { getSessionUser } from '@/lib/auth';
import { loadMenuFlagsForUser } from '@/lib/menu-visibility-gate';
import { jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await getSessionUser();
  if ('error' in auth) return auth.error;

  const flags = await loadMenuFlagsForUser(auth.user.id);

  return jsonOk({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      permissions: auth.user.permissions,
    },
    flags,
  });
}
