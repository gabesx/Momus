export type AnalyticsStatusFilter = 'open' | 'in-progress' | 'resolved' | 'closed';
export type AnalyticsIssueTypeFilter = 'bugs' | 'defects';

export type AnalyticsFilterParams = {
  year?: string | number | null;
  project?: string | null;
  issue_type?: AnalyticsIssueTypeFilter | '' | null;
  status?: AnalyticsStatusFilter | '' | null;
};

export type AnalyticsIssueRow = {
  project: string;
  created_date?: string | null;
  created_year?: number | null;
  is_open: boolean;
  issue_type?: string | null;
  final_issue_type?: string | null;
  status_category?: string | null;
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
};

export type AnalyticsTrendsResult = {
  labels: string[];
  bugs: number[];
  defects: number[];
  total: number[];
  resolution_rate: number[];
};
