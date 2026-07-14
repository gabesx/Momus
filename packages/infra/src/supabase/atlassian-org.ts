import type { SupabaseClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'atlassian_org_id';

/** Organization ID from admin.atlassian.com — required by the Teams Public API. */
export async function loadAtlassianOrgId(db: SupabaseClient): Promise<string> {
  const { data, error } = await db
    .from('bug_budget_config')
    .select('value')
    .eq('key', CONFIG_KEY)
    .maybeSingle();
  if (error) throw new Error(`loadAtlassianOrgId failed: ${error.message}`);
  return typeof data?.value === 'string' ? data.value : '';
}

export async function saveAtlassianOrgId(db: SupabaseClient, orgId: string): Promise<void> {
  const { error } = await db.from('bug_budget_config').upsert({
    key: CONFIG_KEY,
    value: orgId.trim(),
    description: 'Atlassian organization ID (admin.atlassian.com) for the Teams API',
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveAtlassianOrgId failed: ${error.message}`);
}
