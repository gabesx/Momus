import { computeWeeklyDigest } from './weekly-digest';
import type { AnalyticsIssueRow } from './types';

/**
 * A bug is release-blocking when it is open AND at the top of both priority
 * and severity. Values live here so they are easy to tune.
 */
export const RELEASE_BLOCKING = { priority: 'Highest', severity: 'Critical' } as const;

export function isReleaseBlocking(row: AnalyticsIssueRow): boolean {
  return (
    row.is_open &&
    row.priority === RELEASE_BLOCKING.priority &&
    row.severity_issue === RELEASE_BLOCKING.severity
  );
}

export type ExecReleaseBlocker = {
  jira_key: string | null;
  summary: string | null;
  severity: string | null;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  age_days: number | null;
};

export type ExecutiveSummary = {
  total_open: number;
  created_this_week: number;
  resolved_this_week: number;
  net_this_week: number;
  backlog_now: number;
  backlog_prev: number;
  release_blocking_count: number;
  release_blockers: ExecReleaseBlocker[];
  top_squad: { key: string; open: number } | null;
};

function nonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

/** Executive Summary block: this-week flow, backlog, release blockers, worst squad. */
export function computeExecutiveSummary(
  rows: AnalyticsIssueRow[],
  nowIso: string,
): ExecutiveSummary {
  const weekly = computeWeeklyDigest(rows, nowIso);

  const release_blockers: ExecReleaseBlocker[] = rows
    .filter(isReleaseBlocking)
    .map((r) => ({
      jira_key: r.jira_key ?? null,
      summary: r.summary ?? null,
      severity: r.severity_issue ?? null,
      priority: r.priority ?? null,
      assignee: nonEmpty(r.assignee_final, r.engineer_assignee),
      reporter: r.reporter ?? null,
      age_days: r.defect_age_days ?? null,
    }))
    .sort((a, b) => (b.age_days ?? 0) - (a.age_days ?? 0));

  const openBySquad = new Map<string, number>();
  for (const r of rows) {
    if (!r.is_open) continue;
    const key = nonEmpty(r.real_project) ?? r.project;
    openBySquad.set(key, (openBySquad.get(key) ?? 0) + 1);
  }
  const top = [...openBySquad.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0];

  return {
    total_open: weekly.backlog_now,
    created_this_week: weekly.this_week.created,
    resolved_this_week: weekly.this_week.resolved,
    net_this_week: weekly.this_week.net,
    backlog_now: weekly.backlog_now,
    backlog_prev: weekly.backlog_prev,
    release_blocking_count: release_blockers.length,
    release_blockers,
    top_squad: top ? { key: top[0], open: top[1] } : null,
  };
}
