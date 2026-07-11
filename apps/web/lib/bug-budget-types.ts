import type { FilterOptions, StatsResult, SummaryProject } from '@momus/domain';

export type BugBudgetIssueRow = {
  jira_key: string;
  project: string;
  summary?: string | null;
  priority?: string | null;
  severity_issue?: string | null;
  status?: string | null;
  reporter?: string | null;
  created_date?: string | null;
  defect_age_days?: number | null;
  is_open: boolean;
  final_issue_type?: string | null;
  issue_type?: string | null;
  status_category?: string | null;
  assignee_final?: string | null;
  tested_by?: string | null;
  end_date?: string | null;
  actual_end?: string | null;
  resolved_date?: string | null;
  updated_at?: string | null;
};

export type BugBudgetListResponse = {
  success: boolean;
  message?: string;
  stats: StatsResult;
  issues: BugBudgetIssueRow[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    last_page: number;
  };
  per_page_capped: boolean;
  notice: string | null;
  jira_browse_base: string;
  active_filter_count: number;
  database_total: number;
  filter_options: FilterOptions;
};

export type SummaryResponse = {
  success: boolean;
  message?: string;
  projects: SummaryProject[];
  year: number | 'all';
};
