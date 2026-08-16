import { UsersAdmin } from '@/components/settings/users-admin';
import { requirePagePermission } from '@/lib/page-guard';

export default async function UsersSettingsPage() {
  await requirePagePermission('manage_users');

  return (
    <main>
      <UsersAdmin />
    </main>
  );
}
