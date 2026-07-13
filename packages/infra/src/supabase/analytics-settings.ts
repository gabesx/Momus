import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYTICS_KPI_THRESHOLDS, DEFAULT_PROD_LABELS } from '@momus/domain';

const CONFIG_KEY = 'analytics_settings';

export type AnalyticsSettings = {
  sla_first_response_days: number;
  sla_critical_resolution_days: number;
  sla_major_resolution_days: number;
  prod_labels: string[];
  digest_enabled: boolean;
  digest_webhook_url: string;
};

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  sla_first_response_days: ANALYTICS_KPI_THRESHOLDS.sla_first_response_days,
  sla_critical_resolution_days: ANALYTICS_KPI_THRESHOLDS.sla_critical_resolution_days,
  sla_major_resolution_days: ANALYTICS_KPI_THRESHOLDS.sla_major_resolution_days,
  prod_labels: [...DEFAULT_PROD_LABELS],
  digest_enabled: false,
  digest_webhook_url: '',
};

function positiveDays(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 365 ? n : fallback;
}

function labelList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const labels = [
    ...new Set(value.filter((l): l is string => typeof l === 'string').map((l) => l.trim())),
  ].filter(Boolean);
  return labels.length ? labels : fallback;
}

/** Merge a raw config value with defaults, dropping invalid fields. */
export function normalizeAnalyticsSettings(raw: unknown): AnalyticsSettings {
  const value = (raw ?? {}) as Record<string, unknown>;
  const d = DEFAULT_ANALYTICS_SETTINGS;
  const webhook = typeof value.digest_webhook_url === 'string' ? value.digest_webhook_url.trim() : '';
  return {
    sla_first_response_days: positiveDays(value.sla_first_response_days, d.sla_first_response_days),
    sla_critical_resolution_days: positiveDays(
      value.sla_critical_resolution_days,
      d.sla_critical_resolution_days,
    ),
    sla_major_resolution_days: positiveDays(
      value.sla_major_resolution_days,
      d.sla_major_resolution_days,
    ),
    prod_labels: labelList(value.prod_labels, d.prod_labels),
    digest_enabled: value.digest_enabled === true,
    digest_webhook_url: webhook,
  };
}

/** Validate a settings save payload; throws on hard errors. */
export function parseAnalyticsSettings(body: unknown): AnalyticsSettings {
  const value = (body ?? {}) as Record<string, unknown>;
  for (const key of [
    'sla_first_response_days',
    'sla_critical_resolution_days',
    'sla_major_resolution_days',
  ] as const) {
    const n = Number(value[key]);
    if (!Number.isFinite(n) || n <= 0 || n > 365) {
      throw new Error(`${key} must be a number between 1 and 365`);
    }
  }
  const webhook =
    typeof value.digest_webhook_url === 'string' ? value.digest_webhook_url.trim() : '';
  if (webhook && !/^https:\/\//.test(webhook)) {
    throw new Error('digest_webhook_url must be an https:// URL');
  }
  if (value.digest_enabled === true && !webhook) {
    throw new Error('digest_webhook_url is required when the digest is enabled');
  }
  return normalizeAnalyticsSettings(body);
}

export async function loadAnalyticsSettings(db: SupabaseClient): Promise<AnalyticsSettings> {
  const { data, error } = await db
    .from('bug_budget_config')
    .select('value')
    .eq('key', CONFIG_KEY)
    .maybeSingle();
  if (error) throw new Error(`loadAnalyticsSettings failed: ${error.message}`);
  return normalizeAnalyticsSettings(data?.value);
}

export async function saveAnalyticsSettings(
  db: SupabaseClient,
  settings: AnalyticsSettings,
): Promise<void> {
  const { error } = await db.from('bug_budget_config').upsert({
    key: CONFIG_KEY,
    value: settings,
    description: 'Analytics SLA thresholds, prod label convention, weekly digest',
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveAnalyticsSettings failed: ${error.message}`);
}
