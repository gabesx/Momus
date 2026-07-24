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
  resolved_date?: string | null;
  time_to_resolution_hours?: number | null;
  first_response_age_days?: number | null;
  chart_date_first_response?: string | null;
  real_project?: string | null;
  service_feature?: string | null;
  service_feature_final?: string | null;
  engineer_assignee?: string | null;
  test_engineer_assignee?: string | null;
  has_linked_test_execution?: boolean | null;
  /** QA Bug Slip attribution (see analytics/qa-slip.ts) */
  reporter?: string | null;
  owner?: string | null;
  tested_by?: string | null;
  tester_assignee?: string | null;
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
  resolution: AnalyticsResolutionResult;
  response: AnalyticsResponseResult;
  distribution: AnalyticsDistributionResult;
  escape: AnalyticsEscapeResult;
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

export type AnalyticsMttrStats = {
  /** Resolved rows with a usable resolution time */
  resolved_count: number;
  avg_hours: number;
  median_hours: number;
};

export type AnalyticsResolutionResult = {
  overall: AnalyticsMttrStats;
  critical_major: AnalyticsMttrStats;
  other: AnalyticsMttrStats;
  by_severity: Record<string, AnalyticsMttrStats>;
  mom: {
    avg_hours: number | null;
    median_hours: number | null;
  };
};

export type AnalyticsSlaCompliance = {
  /** Null when no eligible issues in scope */
  pct: number | null;
  within: number;
  eligible: number;
  threshold_days: number;
};

export type AnalyticsResponseResult = {
  /** Rows with a usable first-response time */
  responded_count: number;
  avg_days: number;
  median_days: number;
  /** Open rows with no first response at all */
  open_untouched: number;
  sla_first_response: AnalyticsSlaCompliance;
  sla_critical_resolution: AnalyticsSlaCompliance;
  sla_major_resolution: AnalyticsSlaCompliance;
};

export type AnalyticsDistributionEntry = {
  key: string;
  total: number;
  open: number;
  open_critical_major: number;
};

export type AnalyticsEscapeResult = {
  /** Issues labeled as found in production */
  prod: number;
  total: number;
  pct: number;
  labels_used: string[];
};

/** SLA day thresholds — overridable via bug_budget_config.analytics_settings. */
export type AnalyticsSlaSettings = {
  sla_first_response_days: number;
  sla_critical_resolution_days: number;
  sla_major_resolution_days: number;
};

export type AnalyticsSummaryOptions = {
  sla?: AnalyticsSlaSettings;
  prod_labels?: readonly string[];
};

export type AnalyticsDistributionResult = {
  /** real_project (fallback project), sorted by total desc */
  by_squad: AnalyticsDistributionEntry[];
  /** service_feature_final (fallback service_feature), sorted by total desc */
  by_service: AnalyticsDistributionEntry[];
  /** engineer_assignee (fallback test_engineer_assignee), sorted by open desc */
  by_engineer: AnalyticsDistributionEntry[];
  traceability: { linked: number; total: number; pct: number };
};

export type AnalyticsTrendsResult = {
  labels: string[];
  /** Parallel to labels — machine keys for period-detail (e.g. 2026-04, 2026-Q2, 2026) */
  period_keys?: string[];
  bugs: number[];
  defects: number[];
  total: number[];
  resolution_rate: number[];
  /** Bug cost per period — present when cost multipliers were provided */
  cost?: number[];
  /** Inflow: issues created in the period (parallel to labels; equals `total`). */
  created?: number[];
  /** Outflow: issues resolved in the period (by `resolved_date`; open rows excluded). */
  resolved?: number[];
  /** Net flow per period: `created - resolved` (positive = backlog grew). */
  net?: number[];
  /** Open backlog at the end of each period. */
  backlog?: number[];
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
  mttr_critical_major_warning_hours: 72,
  sla_first_response_days: 2,
  sla_critical_resolution_days: 3,
  sla_major_resolution_days: 7,
  sla_compliance_healthy_pct: 90,
  escape_rate_warning_pct: 10,
} as const;
