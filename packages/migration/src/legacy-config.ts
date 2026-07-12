export type LegacyBugBudgetPhpConfig = {
  priority_multipliers: Record<string, number>;
  severity_multipliers: Record<string, number>;
  project_budgets: Record<string, number>;
  project_mappings: Record<string, string>;
  excluded_projects: string[];
};

/**
 * PHP associative arrays with duplicate keys keep the last write.
 * Use when ingesting an ordered list of [key, value] pairs from a parser.
 */
export function collapsePhpAssocNumberPairs(
  pairs: Array<[string, number]>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of pairs) out[k] = v;
  return out;
}

export function assertLegacyConfigShape(
  raw: unknown,
): asserts raw is LegacyBugBudgetPhpConfig {
  if (!raw || typeof raw !== 'object') throw new Error('legacy config must be an object');
  const o = raw as Record<string, unknown>;
  for (const key of [
    'priority_multipliers',
    'severity_multipliers',
    'project_budgets',
    'project_mappings',
  ] as const) {
    if (!o[key] || typeof o[key] !== 'object' || Array.isArray(o[key])) {
      throw new Error(`legacy config missing object: ${key}`);
    }
  }
  if (!Array.isArray(o.excluded_projects)) {
    throw new Error('legacy config excluded_projects must be an array');
  }
}

/** Non-secret settings keys copied from legacy `settings` (BB-MIG-03). */
export const MIGRATE_SETTINGS_KEYS = [
  'jira_url',
  'jira_username',
  'jira_enabled',
] as const;

export type MigrateSettingsKey = (typeof MIGRATE_SETTINGS_KEYS)[number];

export const TOKEN_REENTRY_CHECKLIST = [
  'Open Momus Settings → Atlassian → Bug Budget (or Jira connection).',
  'Re-enter the Jira API token manually (do not paste from migration tooling).',
  'Save — token is stored via Vault / encrypted settings (DEV-9).',
  'Run Test Connection.',
  'At cutover only: DROP TABLE bug_budget_settings on legacy QARATMS (D-4 / BB-MIG-03).',
] as const;
