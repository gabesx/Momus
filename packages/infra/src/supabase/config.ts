import type { SupabaseClient } from '@supabase/supabase-js';

export type MultipliersPayload = {
  priority_highest: number;
  priority_high: number;
  priority_medium: number;
  priority_low: number;
  priority_lowest: number;
  severity_critical: number;
  severity_major: number;
  severity_moderate: number;
  severity_minor: number;
  severity_low: number;
};

export type ProjectSettingsPayload = {
  projects: string[];
  amounts: number[];
  jira_projects: string[];
  display_names: string[];
};

export type CronSchedulePayload = {
  is_active: boolean;
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval_days: number;
  time: string;
  day_of_week?: string | null;
  day_of_month?: number | null;
  jql?: string | null;
  batch_size?: number;
  max_total_issues?: number;
};

export type SyncQueryConfig = {
  jql: string;
  sync_type: 'custom' | 'quarterly' | 'monthly' | 'yearly';
  batch_size: number;
  max_total_issues: number;
  year: number;
  quarter: number;
  month: number;
};

export const DEFAULT_SYNC_QUERY: SyncQueryConfig = {
  jql: '',
  sync_type: 'custom',
  batch_size: 50,
  max_total_issues: 10000,
  year: new Date().getFullYear(),
  quarter: 1,
  month: 1,
};

const SYNC_TYPES = new Set(['custom', 'quarterly', 'monthly', 'yearly']);
const ALLOWED_BATCH_SIZES = new Set([25, 50, 100, 200, 500, 1000, 2000, 5000]);

/** Validate + normalize JQL Query Configuration for persistence. */
export function parseSyncQueryConfig(body: Record<string, unknown>): SyncQueryConfig {
  const jql = typeof body.jql === 'string' ? body.jql.trim() : DEFAULT_SYNC_QUERY.jql;
  if (jql.length > 2000) {
    throw new Error('jql must be ≤2000 characters');
  }

  const syncTypeRaw =
    typeof body.sync_type === 'string' ? body.sync_type : DEFAULT_SYNC_QUERY.sync_type;
  if (!SYNC_TYPES.has(syncTypeRaw)) {
    throw new Error('sync_type must be custom, quarterly, monthly, or yearly');
  }
  const sync_type = syncTypeRaw as SyncQueryConfig['sync_type'];

  const batchSize =
    body.batch_size != null ? Number(body.batch_size) : DEFAULT_SYNC_QUERY.batch_size;
  if (!Number.isInteger(batchSize) || !ALLOWED_BATCH_SIZES.has(batchSize)) {
    throw new Error('batch_size must be one of 25, 50, 100, 200, 500, 1000, 2000, 5000');
  }

  const maxTotal =
    body.max_total_issues != null
      ? Number(body.max_total_issues)
      : DEFAULT_SYNC_QUERY.max_total_issues;
  if (!Number.isInteger(maxTotal) || maxTotal < 0 || maxTotal > 50000) {
    throw new Error('max_total_issues must be 0–50000');
  }

  const year = body.year != null ? Number(body.year) : DEFAULT_SYNC_QUERY.year;
  if (!Number.isInteger(year) || year < 2020 || year > 2030) {
    throw new Error('year must be 2020–2030');
  }

  const quarter = body.quarter != null ? Number(body.quarter) : DEFAULT_SYNC_QUERY.quarter;
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    throw new Error('quarter must be 1–4');
  }

  const month = body.month != null ? Number(body.month) : DEFAULT_SYNC_QUERY.month;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('month must be 1–12');
  }

  return {
    jql,
    sync_type,
    batch_size: batchSize,
    max_total_issues: maxTotal,
    year,
    quarter,
    month,
  };
}

export type CronScheduleRow = {
  id: number;
  name: string;
  command: string;
  schedule_type: string;
  interval_days: number;
  time: string;
  day_of_week: string | null;
  day_of_month: number | null;
  is_active: boolean;
  description: string | null;
  command_params: Record<string, unknown> | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_run_result: string | null;
  last_run_status: string | null;
};

const MULTIPLIER_BOUNDS = { min: 0.1, max: 1000 };

export function validateMultiplier(field: string, value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < MULTIPLIER_BOUNDS.min || n > MULTIPLIER_BOUNDS.max) {
    throw new Error(
      `Invalid value for ${field}: must be between ${MULTIPLIER_BOUNDS.min} and ${MULTIPLIER_BOUNDS.max}`,
    );
  }
  return n;
}

export function parseMultipliers(body: Record<string, unknown>): MultipliersPayload {
  return {
    priority_highest: validateMultiplier('priority_highest', body.priority_highest),
    priority_high: validateMultiplier('priority_high', body.priority_high),
    priority_medium: validateMultiplier('priority_medium', body.priority_medium),
    priority_low: validateMultiplier('priority_low', body.priority_low),
    priority_lowest: validateMultiplier('priority_lowest', body.priority_lowest),
    severity_critical: validateMultiplier('severity_critical', body.severity_critical),
    severity_major: validateMultiplier('severity_major', body.severity_major),
    severity_moderate: validateMultiplier('severity_moderate', body.severity_moderate),
    severity_minor: validateMultiplier('severity_minor', body.severity_minor),
    severity_low: validateMultiplier('severity_low', body.severity_low),
  };
}

/** Compute next_run_at in Asia/Jakarta from schedule fields (simplified). */
export function computeNextRunAt(input: {
  schedule_type: string;
  interval_days: number;
  time: string;
  day_of_week?: string | null;
  day_of_month?: number | null;
  from?: Date;
}): string {
  const from = input.from ?? new Date();
  const [hh, mm] = input.time.split(':').map(Number);
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setHours(hh || 0, mm || 0, 0, 0);

  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  if (input.schedule_type === 'custom') {
    next.setDate(from.getDate() + Math.max(1, input.interval_days));
    next.setHours(hh || 0, mm || 0, 0, 0);
  } else if (input.schedule_type === 'weekly' && input.day_of_week) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const target = days.indexOf(input.day_of_week.toLowerCase());
    if (target >= 0) {
      while (next.getDay() !== target || next <= from) {
        next.setDate(next.getDate() + 1);
      }
    }
  } else if (input.schedule_type === 'monthly' && input.day_of_month) {
    next.setDate(input.day_of_month);
    if (next <= from) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(input.day_of_month);
    }
  }

  return next.toISOString();
}

export class BugBudgetConfigRepository {
  constructor(private readonly db: SupabaseClient) {}

  async saveMultipliers(payload: MultipliersPayload): Promise<void> {
    const priority = {
      highest: payload.priority_highest,
      high: payload.priority_high,
      medium: payload.priority_medium,
      low: payload.priority_low,
      lowest: payload.priority_lowest,
    };
    const severity = {
      critical: payload.severity_critical,
      major: payload.severity_major,
      moderate: payload.severity_moderate,
      minor: payload.severity_minor,
      low: payload.severity_low,
    };
    for (const [key, value] of [
      ['priority_multipliers', priority],
      ['severity_multipliers', severity],
    ] as const) {
      const { error } = await this.db.from('bug_budget_config').upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`saveMultipliers ${key} failed: ${error.message}`);
    }
  }

  async saveSyncQuery(payload: SyncQueryConfig): Promise<void> {
    const { error } = await this.db.from('bug_budget_config').upsert({
      key: 'sync_query',
      value: payload,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`saveSyncQuery failed: ${error.message}`);
  }

  async getSyncQuery(): Promise<SyncQueryConfig> {
    const { data, error } = await this.db
      .from('bug_budget_config')
      .select('value')
      .eq('key', 'sync_query')
      .maybeSingle();
    if (error) throw new Error(`getSyncQuery failed: ${error.message}`);
    if (!data?.value || typeof data.value !== 'object') {
      return { ...DEFAULT_SYNC_QUERY, year: new Date().getFullYear() };
    }
    return parseSyncQueryConfig(data.value as Record<string, unknown>);
  }

  async saveProjectSettings(
    payload: ProjectSettingsPayload,
    allDbProjects: string[],
  ): Promise<void> {
    const budgets: Record<string, number> = {};
    for (let i = 0; i < payload.projects.length; i++) {
      budgets[payload.projects[i]!] = payload.amounts[i] ?? 100;
    }
    const mappings: Record<string, string> = {};
    for (let i = 0; i < payload.jira_projects.length; i++) {
      mappings[payload.jira_projects[i]!] = payload.display_names[i] ?? payload.jira_projects[i]!;
    }
    const covered = new Set([...Object.keys(budgets), ...Object.keys(mappings)]);
    const excluded = allDbProjects.filter((p) => !covered.has(p));

    for (const [key, value] of [
      ['project_budgets', budgets],
      ['project_mappings', mappings],
      ['excluded_projects', excluded],
    ] as const) {
      const { error } = await this.db.from('bug_budget_config').upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`saveProjectSettings ${key} failed: ${error.message}`);
    }
  }

  async getOrCreateCronSchedule(): Promise<CronScheduleRow> {
    const { data, error } = await this.db
      .from('cron_schedules')
      .select('*')
      .eq('name', 'bug_budget_sync')
      .maybeSingle();
    if (error) throw new Error(`get cron schedule failed: ${error.message}`);
    if (data) return data as CronScheduleRow;

    const { data: created, error: createError } = await this.db
      .from('cron_schedules')
      .insert({
        name: 'bug_budget_sync',
        command: 'bug-budget:sync',
        schedule_type: 'daily',
        interval_days: 1,
        time: '00:00',
        is_active: false,
        description: 'Automated Bug Budget Jira sync',
        command_params: { jql: null, batch_size: 50, max_total_issues: 0 },
      })
      .select('*')
      .single();
    if (createError) throw new Error(`create cron schedule failed: ${createError.message}`);
    return created as CronScheduleRow;
  }

  async saveCronSchedule(payload: CronSchedulePayload): Promise<CronScheduleRow> {
    const nextRunAt = computeNextRunAt(payload);
    const commandParams = {
      jql: payload.jql ?? null,
      batch_size: payload.batch_size ?? 50,
      max_total_issues: payload.max_total_issues ?? 0,
    };
    const { data, error } = await this.db
      .from('cron_schedules')
      .upsert(
        {
          name: 'bug_budget_sync',
          command: 'bug-budget:sync',
          schedule_type: payload.schedule_type,
          interval_days: payload.interval_days,
          time: payload.time,
          day_of_week: payload.day_of_week ?? null,
          day_of_month: payload.day_of_month ?? null,
          is_active: payload.is_active,
          command_params: commandParams,
          next_run_at: nextRunAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'name' },
      )
      .select('*')
      .single();
    if (error) throw new Error(`saveCronSchedule failed: ${error.message}`);
    return data as CronScheduleRow;
  }

  async listDistinctProjects(): Promise<string[]> {
    const { data, error } = await this.db.from('bug_budget').select('project');
    if (error) throw new Error(`listDistinctProjects failed: ${error.message}`);
    return [...new Set((data ?? []).map((r) => r.project as string).filter(Boolean))];
  }
}
