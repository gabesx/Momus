import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import {
  LEADERBOARD_REJECTED_KEYWORDS,
  type LeaderboardDrillContext,
  type LeaderboardFilterParams,
  type LeaderboardIssueRow,
  type LeaderboardPeriodType,
  type LeaderboardResult,
  type ProjectLeaderboardBlock,
  type ReporterRank,
} from './types';
import {
  dateInRange,
  defaultPeriodForType,
  resolvePeriodRange,
} from './period';

const BUG_DEFECT = new Set<string>([...BUG_GROUP_TYPES, ...DEFECT_GROUP_TYPES]);

export function isLeaderboardIssueType(issueType: string | null | undefined): boolean {
  return !!issueType && BUG_DEFECT.has(issueType);
}

export function isRejectedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const lower = status.toLowerCase();
  return LEADERBOARD_REJECTED_KEYWORDS.some((k) => lower.includes(k));
}

export function mapIssueTypeGroup(issueType: string | null | undefined): 'Bug' | 'Defect' | 'Other' {
  if (!issueType) return 'Other';
  if (issueType.toLowerCase().includes('defect')) return 'Defect';
  if ((BUG_GROUP_TYPES as readonly string[]).includes(issueType)) return 'Bug';
  return 'Other';
}

export function buildReporterLeaderboard(
  rows: LeaderboardIssueRow[],
  limit = 10,
): ReporterRank[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.reporter?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reporter, count]) => ({ reporter, count }))
    .sort((a, b) => b.count - a.count || a.reporter.localeCompare(b.reporter))
    .slice(0, limit);
}

export function applyLeaderboardWindow(
  rows: LeaderboardIssueRow[],
  params: LeaderboardFilterParams,
  nowIso: string,
): { rows: LeaderboardIssueRow[]; meta: LeaderboardResult['meta'] } {
  const period_type: LeaderboardPeriodType = params.period_type ?? 'quarterly';
  const year = Number(params.year) || new Date(nowIso).getUTCFullYear();
  const period =
    params.period?.trim() ||
    defaultPeriodForType(period_type, nowIso);
  const range = resolvePeriodRange(year, period_type, period);

  const scoped = rows.filter(
    (r) =>
      isLeaderboardIssueType(r.issue_type) &&
      r.reporter?.trim() &&
      dateInRange(r.created_date, range),
  );

  return {
    rows: scoped,
    meta: {
      period_type,
      year,
      period,
      start: range?.start ?? null,
      end: range?.end ?? null,
    },
  };
}

export function computeLeaderboard(
  rows: LeaderboardIssueRow[],
  params: LeaderboardFilterParams,
  nowIso: string,
): LeaderboardResult {
  const { rows: scoped, meta } = applyLeaderboardWindow(rows, params, nowIso);
  const rejected = scoped.filter((r) => isRejectedStatus(r.status));
  const accepted = scoped.filter((r) => !isRejectedStatus(r.status));

  const byType: Record<string, ReporterRank[]> = {};
  for (const group of ['Bug', 'Defect'] as const) {
    const subset = scoped.filter((r) => mapIssueTypeGroup(r.issue_type) === group);
    if (subset.length) byType[group] = buildReporterLeaderboard(subset);
  }

  const byProjectMap = new Map<string, LeaderboardIssueRow[]>();
  for (const row of scoped) {
    const project = row.project?.trim() || 'Unknown';
    const list = byProjectMap.get(project) ?? [];
    list.push(row);
    byProjectMap.set(project, list);
  }
  const by_project: ProjectLeaderboardBlock[] = [...byProjectMap.entries()]
    .map(([project, group]) => ({
      project,
      total: group.length,
      reporters: buildReporterLeaderboard(group),
    }))
    .sort((a, b) => b.total - a.total || a.project.localeCompare(b.project));

  return {
    summary: {
      total_issues: scoped.length,
      unique_reporters: new Set(scoped.map((r) => r.reporter!.trim())).size,
      accepted_count: accepted.length,
      rejected_count: rejected.length,
    },
    global: buildReporterLeaderboard(scoped),
    by_issue_type: byType,
    by_project,
    accepted: buildReporterLeaderboard(accepted),
    rejected: buildReporterLeaderboard(rejected),
    meta,
  };
}

export function filterReporterDrilldown(
  rows: LeaderboardIssueRow[],
  params: LeaderboardFilterParams,
  nowIso: string,
  reporter: string,
  context: LeaderboardDrillContext,
  group?: string | null,
): LeaderboardIssueRow[] {
  const { rows: scoped } = applyLeaderboardWindow(rows, params, nowIso);
  let out = scoped.filter((r) => r.reporter?.trim() === reporter.trim());

  switch (context) {
    case 'issue_type':
      if (group === 'Defect') out = out.filter((r) => mapIssueTypeGroup(r.issue_type) === 'Defect');
      else if (group === 'Bug') out = out.filter((r) => mapIssueTypeGroup(r.issue_type) === 'Bug');
      break;
    case 'project':
      if (group === 'Unknown') {
        out = out.filter((r) => !r.project?.trim());
      } else if (group) {
        out = out.filter((r) => r.project === group);
      }
      break;
    case 'accepted':
      out = out.filter((r) => !isRejectedStatus(r.status));
      break;
    case 'rejected':
      out = out.filter((r) => isRejectedStatus(r.status));
      break;
    default:
      break;
  }

  return out
    .slice()
    .sort((a, b) => (b.created_date ?? '').localeCompare(a.created_date ?? ''))
    .slice(0, 200);
}
