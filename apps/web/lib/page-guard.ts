import { redirect } from 'next/navigation';
import type { UserPermission } from '@momus/shared';
import { getSessionUser } from '@/lib/auth';
import { landingPathFor } from '@/lib/landing-path';

export { landingPathFor };

/**
 * Page-level gate for server components. Redirects signed-out users to sign-in
 * and unpermitted users to whatever they can actually reach.
 */
export async function requirePagePermission(permission: UserPermission) {
  const session = await getSessionUser();
  if ('error' in session || session.access !== 'ok') {
    redirect('/sign-in');
  }

  const { permissions } = session.user;
  if (!permissions.includes(permission)) {
    redirect(landingPathFor(permissions));
  }

  return session.user;
}
