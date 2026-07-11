import type { SupabaseClient } from '@supabase/supabase-js';

/** BB-CACHE-01: bump cache version so summary/filter caches invalidate. */
export async function bumpBugBudgetCacheVersion(db: SupabaseClient): Promise<number> {
  const { data: current, error: readError } = await db
    .from('cache_versions')
    .select('version')
    .eq('key', 'bug_budget')
    .maybeSingle();
  if (readError) throw new Error(`read cache version failed: ${readError.message}`);

  const next = (current?.version ?? 0) + 1;
  const { error } = await db.from('cache_versions').upsert({
    key: 'bug_budget',
    version: next,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`bump cache version failed: ${error.message}`);
  return next;
}

export async function recordLastSyncUser(
  db: SupabaseClient,
  label: string,
  userId?: string | number,
): Promise<void> {
  const rows = [
    { key: 'bug_budget_last_sync_user', value: label, type: 'string', group: 'bug_budget' },
    {
      key: 'bug_budget_last_sync_user_id',
      value: userId != null ? String(userId) : '',
      type: 'string',
      group: 'bug_budget',
    },
  ];
  for (const row of rows) {
    const { error } = await db.from('settings').upsert(row, { onConflict: 'key' });
    if (error) throw new Error(`recordLastSyncUser failed: ${error.message}`);
  }
}
