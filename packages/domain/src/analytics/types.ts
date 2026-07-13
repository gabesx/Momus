export type AnalyticsStatusFilter = 'open' | 'in-progress' | 'resolved' | 'closed';
export type AnalyticsIssueTypeFilter = 'bugs' | 'defects';
export type AnalyticsTrendGrain = 'month' | 'quarter' | 'year';

export type AnalyticsFilterParams = {
  year?: string | number | null;
  project?: string | null;
  issue_type?: AnalyticsIssueTypeFilter | '' | null;
  status?: AnalyticsStatusFilter | '' | null;
  /** M2+: severity_issue exact match (case-insensitive), or empty = no filter */
  severity?: string | null;
  /** M2+: 'yes' | 'no' | '' — AC-related label presence */
  ac_related?: 'yes' | 'no' | '' | null;
  /** M2+: priority name, or '__none__' for missing priority */
  priority?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  trend_grain?: AnalyticsTrendGrain | null;
  /** When grain is quarter: 1–4 */
  quarter?: string | number | null;
};

export type AnalyticsIssueRow = {
  project: string;
  created_date?: string | null;
  created_year?: number | null;
  created_num_month?: number | null;
  quarter?: string | null;
  is_open: boolean;
  issue_type?: string | null;
  final_issue_type?: string | null;
  status_category?: string | null;
  status?: string | null;
  severity_issue?: string | null;
  priority?: string | null;
  labels?: string[] | null;
  ac_related_labels?: string[] | null;
  defect_age_days?: number | null;
  updated_at?: string | null;
};

export type AnalyticsSummaryMetrics = {
  total: number;
  open: number;
  resolved: number;
  resolution_rate: number;
  avg_age: number;
};

export type AnalyticsSummaryResult = AnalyticsSummaryMetrics & {
  mom: {
    total: number | null;
    open: number | null;
    resolved: number | null;
    resolution_rate: number | null;
    avg_age: number | null;
  };
  risk: AnalyticsRiskResult;
};

export type AnalyticsAgeBuckets = {
  fresh: number;
  aging: number;
  stale: number;
  long_overdue: number;
};

export type AnalyticsRiskResult = {
  open_critical: number;
  open_major: number;
  open_critical_major: number;
  open_critical_major_pct_of_open: number;
  open_long_overdue: number;
  open_long_overdue_pct_of_open: number;
  open_age_buckets: AnalyticsAgeBuckets;
  open_severity: Record<string, number>;
  mom: {
    open_critical_major: number | null;
    open_long_overdue: number | null;
  };
};

export type AnalyticsTrendsResult = {
  labels: string[];
  /** Parallel to labels — machine keys for period-detail (e.g. 2026-04, 2026-Q2, 2026) */
  period_keys?: string[];
  bugs: number[];
  defects: number[];
  total: number[];
  resolution_rate: number[];
  grain?: AnalyticsTrendGrain;
};

/** M2+: period drill-down matrices (frozen shape in M1). */
export type AnalyticsPeriodDetail = {
  period_key: string;
  grain: AnalyticsTrendGrain;
  total: number;
  bugs: number;
  defects: number;
  severity_by_priority: Record<string, Record<string, number>>;
  severity_by_ac: Record<string, { ac: number; non_ac: number }>;
};

/** M5: KPI threshold defaults (overridable later via config). */
export const ANALYTICS_KPI_THRESHOLDS = {
  open_warning: 100,
  avg_age_warning_days: 30,
  resolution_rate_healthy_pct: 70,
  open_critical_major_pct_warning: 25,
  open_long_overdue_pct_warning: 20,
} as const;
