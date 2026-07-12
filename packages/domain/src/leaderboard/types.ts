export type LeaderboardPeriodType = 'all' | 'yearly' | 'semester' | 'quarterly';

export type LeaderboardFilterParams = {
  period_type?: LeaderboardPeriodType | null;
  year?: string | number | null;
  period?: string | null; // Q1–Q4, H1–H2, or unused
};

export type LeaderboardIssueRow = {
  reporter: string | null;
  issue_type?: string | null;
  project?: string | null;
  status?: string | null;
  created_date?: string | null;
  jira_key?: string | null;
  summary?: string | null;
  severity_issue?: string | null;
  priority?: string | null;
};

export type ReporterRank = {
  reporter: string;
  count: number;
};

export type LeaderboardSummary = {
  total_issues: number;
  unique_reporters: number;
  accepted_count: number;
  rejected_count: number;
};

export type ProjectLeaderboardBlock = {
  project: string;
  total: number;
  reporters: ReporterRank[];
};

export type LeaderboardResult = {
  summary: LeaderboardSummary;
  global: ReporterRank[];
  by_issue_type: Record<string, ReporterRank[]>;
  by_project: ProjectLeaderboardBlock[];
  accepted: ReporterRank[];
  rejected: ReporterRank[];
  meta: {
    period_type: LeaderboardPeriodType;
    year: number;
    period: string;
    start: string | null;
    end: string | null;
  };
};

export type LeaderboardDrillContext =
  | 'global'
  | 'issue_type'
  | 'project'
  | 'accepted'
  | 'rejected';

/** Status substrings treated as rejected (legacy expanded list). */
export const LEADERBOARD_REJECTED_KEYWORDS = [
  'rejected',
  'declined',
  'dropped',
  'cancelled',
  'canceled',
] as const;
