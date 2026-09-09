import type { SupabaseClient } from '@supabase/supabase-js';
import { createServerClient, loadAnalyticsSettings } from '@momus/infra';
import { jsonFail } from './sync-params';

export async function loadShowDefectAnalytics(db?: SupabaseClient): Promise<boolean> {
  try {
    const settings = await loadAnalyticsSettings(db ?? createServerClient());
    return settings.show_defect_analytics !== false;
  } catch {
    return true;
  }
}

export function defectAnalyticsDisabledResponse() {
  return jsonFail('Defect Analytics is disabled', 403);
}
