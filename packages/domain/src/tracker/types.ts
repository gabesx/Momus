export const TRACKER_EDITABLE_FIELDS = [
  'parent',
  'linked_issues',
  'severity_issue',
  'service_feature',
] as const;

export type TrackerEditableField = (typeof TRACKER_EDITABLE_FIELDS)[number];

export type TrackerOverrideMeta = { at: string; by: string };
export type TrackerOverrides = Partial<Record<TrackerEditableField, TrackerOverrideMeta>>;

export type TrackerTab = 'all' | 'missing_fields' | 'no_linked_test';

export type TrackerFilterParams = {
  tab?: TrackerTab | null;
  year?: string | number | null;
  project?: string | null;
  /** Projects hidden from results (legacy Exclude Projects). */
  exclude_projects?: string[] | null;
  issue_type?: 'bugs' | 'defects' | '' | null;
  q?: string | null; // search summary / jira_key
  missing_field?: string | null; // 'all' or a known missing-field key
  page?: number | null;
  page_size?: number | null;
  /** Field keys excluded from incompleteness tracking (from Field Settings). */
  excluded_fields?: string[] | null;
};

export type TrackerIssueRow = {
  jira_key: string;
  project: string;
  summary: string;
  issue_type?: string | null;
  parent?: string | null;
  linked_issues?: unknown;
  severity_issue?: string | null;
  service_feature?: string | null;
  ac_related_labels?: string[] | null;
  tester_assignee?: string | null;
  owner?: string | null;
  has_linked_test_execution: boolean;
  created_year?: number | null;
  tracker_overrides?: TrackerOverrides | null;
  reporter?: string | null;
  creator?: string | null;
  description?: string | null;
  labels?: unknown;
  created_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};
