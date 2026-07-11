import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_PRIORITY_MULTIPLIERS,
  DEFAULT_SEVERITY_MULTIPLIERS,
} from '@momus/domain';
import { DEFAULT_SYNC_QUERY, parseSyncQueryConfig, type SyncQueryConfig } from './config';

export type SettingsConfigPayload = {
  priority_multipliers: Record<string, number>;
  severity_multipliers: Record<string, number>;
  project_budgets: Record<string, number>;
  project_mappings: Record<string, string>;
  excluded_projects: string[];
  sync_query: SyncQueryConfig;
};

export async function loadSettingsConfig(db: SupabaseClient): Promise<SettingsConfigPayload> {
  const { data, error } = await db
    .from('bug_budget_config')
    .select('key, value')
    .in('key', [
      'priority_multipliers',
      'severity_multipliers',
      'project_budgets',
      'project_mappings',
      'excluded_projects',
      'sync_query',
    ]);
  if (error) throw new Error(`loadSettingsConfig failed: ${error.message}`);

  const map = new Map((data ?? []).map((r) => [r.key as string, r.value]));

  let sync_query: SyncQueryConfig = {
    ...DEFAULT_SYNC_QUERY,
    year: new Date().getFullYear(),
  };
  const rawSync = map.get('sync_query');
  if (rawSync && typeof rawSync === 'object') {
    try {
      sync_query = parseSyncQueryConfig(rawSync as Record<string, unknown>);
    } catch {
      // keep defaults if stored row is corrupt
    }
  }

  return {
    priority_multipliers:
      (map.get('priority_multipliers') as Record<string, number> | undefined) ??
      DEFAULT_PRIORITY_MULTIPLIERS,
    severity_multipliers:
      (map.get('severity_multipliers') as Record<string, number> | undefined) ??
      DEFAULT_SEVERITY_MULTIPLIERS,
    // Projects come from user config / Jira — never hardcode tenant projects.
    project_budgets: (map.get('project_budgets') as Record<string, number> | undefined) ?? {},
    project_mappings: (map.get('project_mappings') as Record<string, string> | undefined) ?? {},
    excluded_projects: (map.get('excluded_projects') as string[] | undefined) ?? [],
    sync_query,
  };
}
