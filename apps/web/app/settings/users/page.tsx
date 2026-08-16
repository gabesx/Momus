import { redirect } from 'next/navigation';
import { UsersAdmin } from '@/components/settings/users-admin';
import { getSessionUser } from '@/lib/auth';

export default async function UsersSettingsPage() {
  const session = await getSessionUser();
  if (
    'error' in session ||
    session.access !== 'ok' ||
    !session.user.permissions.includes('manage_users')
  ) {
    redirect('/');
  }

  return (
    <main>
      <UsersAdmin />
    </main>
  );
}
