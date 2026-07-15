/** Shared mapper: bug_budget list row → leaderboard issue row. */
export function mapBugBudgetToLeaderboardRow(r: {
  reporter?: string | null;
  issue_type?: string | null;
  project?: string | null;
  status?: string | null;
  created_date?: string | null;
  jira_key?: string | null;
  summary?: string | null;
  severity_issue?: string | null;
  priority?: string | null;
  parent?: string | null;
  service_feature?: string | null;
  ac_related_labels?: string[] | null;
  labels?: string[] | null;
  tester_assignee?: string | null;
  owner?: string | null;
}) {
  return {
    reporter: r.reporter ?? null,
    issue_type: r.issue_type ?? null,
    project: r.project ?? null,
    status: r.status ?? null,
    created_date: r.created_date ?? null,
    jira_key: r.jira_key ?? null,
    summary: r.summary ?? null,
    severity_issue: r.severity_issue ?? null,
    priority: r.priority ?? null,
    parent: r.parent ?? null,
    service_feature: r.service_feature ?? null,
    ac_related_labels: r.ac_related_labels ?? null,
    labels: r.labels ?? null,
    tester_assignee: r.tester_assignee ?? null,
    owner: r.owner ?? null,
  };
}
