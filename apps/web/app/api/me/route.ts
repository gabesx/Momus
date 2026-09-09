import { getSessionUser } from '@/lib/auth';
import { loadShowDefectAnalytics } from '@/lib/defect-analytics-gate';
import { jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await getSessionUser();
  if ('error' in auth) return auth.error;

  const showDefectAnalytics = await loadShowDefectAnalytics();

  return jsonOk({
    user: {
      id: auth.user.id,
      email: auth.user.email,
      name: auth.user.name,
      permissions: auth.user.permissions,
    },
    flags: { show_defect_analytics: showDefectAnalytics },
  });
}
