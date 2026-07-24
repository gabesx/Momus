import type { SupabaseClient } from '@supabase/supabase-js';
import { ANALYTICS_KPI_THRESHOLDS, DEFAULT_PROD_LABELS } from '@momus/domain';

const CONFIG_KEY = 'analytics_settings';

/** KPI tone thresholds tunable from Settings, with their accepted [min, max] bounds. */
export const KPI_THRESHOLD_BOUNDS = {
  open_warning: { min: 1, max: 100000 },
  avg_age_warning_days: { min: 1, max: 3650 },
  resolution_rate_healthy_pct: { min: 0, max: 100 },
  open_critical_major_pct_warning: { min: 0, max: 100 },
  open_long_overdue_pct_warning: { min: 0, max: 100 },
  mttr_critical_major_warning_hours: { min: 1, max: 100000 },
  sla_compliance_healthy_pct: { min: 0, max: 100 },
  escape_rate_warning_pct: { min: 0, max: 100 },
} as const;

export type KpiThresholdKey = keyof typeof KPI_THRESHOLD_BOUNDS;

export type AnalyticsSettings = {
  sla_first_response_days: number;
  sla_critical_resolution_days: number;
  sla_major_resolution_days: number;
  prod_labels: string[];
  digest_enabled: boolean;
  digest_webhook_url: string;
} & Record<KpiThresholdKey, number>;

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  sla_first_response_days: ANALYTICS_KPI_THRESHOLDS.sla_first_response_days,
  sla_critical_resolution_days: ANALYTICS_KPI_THRESHOLDS.sla_critical_resolution_days,
  sla_major_resolution_days: ANALYTICS_KPI_THRESHOLDS.sla_major_resolution_days,
  prod_labels: [...DEFAULT_PROD_LABELS],
  digest_enabled: false,
  digest_webhook_url: '',
  open_warning: ANALYTICS_KPI_THRESHOLDS.open_warning,
  avg_age_warning_days: ANALYTICS_KPI_THRESHOLDS.avg_age_warning_days,
  resolution_rate_healthy_pct: ANALYTICS_KPI_THRESHOLDS.resolution_rate_healthy_pct,
  open_critical_major_pct_warning: ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning,
  open_long_overdue_pct_warning: ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning,
  mttr_critical_major_warning_hours: ANALYTICS_KPI_THRESHOLDS.mttr_critical_major_warning_hours,
  sla_compliance_healthy_pct: ANALYTICS_KPI_THRESHOLDS.sla_compliance_healthy_pct,
  escape_rate_warning_pct: ANALYTICS_KPI_THRESHOLDS.escape_rate_warning_pct,
};

function positiveDays(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 365 ? n : fallback;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
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
  const kpi = {} as Record<KpiThresholdKey, number>;
  for (const key of Object.keys(KPI_THRESHOLD_BOUNDS) as KpiThresholdKey[]) {
    const { min, max } = KPI_THRESHOLD_BOUNDS[key];
    kpi[key] = boundedNumber(value[key], d[key], min, max);
  }
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
    ...kpi,
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
  // KPI thresholds are optional on save (older forms omit them); validate any that are present.
  for (const key of Object.keys(KPI_THRESHOLD_BOUNDS) as KpiThresholdKey[]) {
    if (value[key] === undefined || value[key] === null) continue;
    const { min, max } = KPI_THRESHOLD_BOUNDS[key];
    const n = Number(value[key]);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new Error(`${key} must be a number between ${min} and ${max}`);
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
    description: 'Analytics SLA + KPI thresholds, prod label convention, weekly digest',
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`saveAnalyticsSettings failed: ${error.message}`);
}
