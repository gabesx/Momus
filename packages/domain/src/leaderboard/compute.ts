import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import {
  getMissingFields,
  TRACKER_MISSING_FIELD_KEYS,
  TRACKER_MISSING_FIELD_LABELS,
  type TrackerMissingFieldKey,
} from '../tracker/missing-fields';
import type { TrackerIssueRow } from '../tracker/types';
import {
  LEADERBOARD_REJECTED_KEYWORDS,
  AC_LABEL_GROUPS,
  type AcLabelGroup,
  type AcLabelMatrixRow,
  type IncompleteFieldBlock,
  type IncompleteReporterRank,
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

/**
 * AC label bucket for an issue. Checks raw labels first so an issue tagged
 * with BOTH ac-related and non-ac-related surfaces as 'Both labels' — the
 * sync-derived ac_related_labels collapses to a single label and would hide
 * the conflict. Falls back to the derived labels for inferred values.
 */
export function acLabelGroupOf(row: LeaderboardIssueRow): AcLabelGroup {
  const all = [...(row.labels ?? []), ...(row.ac_related_labels ?? [])]
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim().toLowerCase());
  const hasNonAc = all.some((l) => l.includes('non-ac') || l.includes('not-ac'));
  const hasAc = all.some(
    (l) => l.includes('ac-related') && !l.includes('non-ac') && !l.includes('not-ac'),
  );
  if (hasAc && hasNonAc) return 'Both labels';
  if (hasAc) return 'AC-related';
  if (hasNonAc) return 'Non-AC-related';
  return 'Unlabeled';
}

/** Reporter × (Defect Group | Bug) × AC bucket matrix, sorted by total desc. */
export function buildAcLabelMatrix(rows: LeaderboardIssueRow[]): AcLabelMatrixRow[] {
  const byReporter = new Map<string, AcLabelMatrixRow>();
  for (const row of rows) {
    const name = row.reporter?.trim();
    if (!name) continue;
    const entry = byReporter.get(name) ?? {
      reporter: name,
      defect_ac: 0,
      defect_non_ac: 0,
      defect_both: 0,
      bug_ac: 0,
      bug_non_ac: 0,
      bug_both: 0,
      unlabeled: 0,
      total: 0,
    };
    const typeGroup = mapIssueTypeGroup(row.issue_type);
    const acGroup = acLabelGroupOf(row);
    if (acGroup === 'Unlabeled') entry.unlabeled += 1;
    else if (typeGroup === 'Defect') {
      if (acGroup === 'AC-related') entry.defect_ac += 1;
      else if (acGroup === 'Non-AC-related') entry.defect_non_ac += 1;
      else entry.defect_both += 1;
    } else if (typeGroup === 'Bug') {
      if (acGroup === 'AC-related') entry.bug_ac += 1;
      else if (acGroup === 'Non-AC-related') entry.bug_non_ac += 1;
      else entry.bug_both += 1;
    } else {
      entry.unlabeled += 1;
    }
    entry.total += 1;
    byReporter.set(name, entry);
  }
  return [...byReporter.values()].sort(
    (a, b) => b.total - a.total || a.reporter.localeCompare(b.reporter),
  );
}

export function mapIssueTypeGroup(issueType: string | null | undefined): 'Bug' | 'Defect' | 'Other' {
  if (!issueType) return 'Other';
  if (issueType.toLowerCase().includes('defect')) return 'Defect';
  if ((BUG_GROUP_TYPES as readonly string[]).includes(issueType)) return 'Bug';
  return 'Other';
}

function toTrackerShape(row: LeaderboardIssueRow): TrackerIssueRow {
  return {
    jira_key: row.jira_key ?? '',
    project: row.project ?? '',
    summary: row.summary ?? '',
    parent: row.parent,
    service_feature: row.service_feature,
    severity_issue: row.severity_issue,
    ac_related_labels: row.ac_related_labels,
    tester_assignee: row.tester_assignee,
    owner: row.owner,
    has_linked_test_execution: false,
  };
}

export function missingFieldsForLeaderboardRow(row: LeaderboardIssueRow): string[] {
  return getMissingFields(toTrackerShape(row), []);
}

export function isIncompleteLeaderboardRow(row: LeaderboardIssueRow): boolean {
  return missingFieldsForLeaderboardRow(row).length > 0;
}

function roundPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function buildReporterLeaderboard(
  rows: LeaderboardIssueRow[],
): ReporterRank[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.reporter?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reporter, count]) => ({ reporter, count }))
    .sort((a, b) => b.count - a.count || a.reporter.localeCompare(b.reporter));
}

function buildIncompleteReporterRanks(
  scoped: LeaderboardIssueRow[],
  incompleteRows: LeaderboardIssueRow[],
): IncompleteReporterRank[] {
  const totalByReporter = new Map<string, number>();
  for (const row of scoped) {
    const name = row.reporter?.trim();
    if (!name) continue;
    totalByReporter.set(name, (totalByReporter.get(name) ?? 0) + 1);
  }

  const incompleteByReporter = new Map<string, number>();
  for (const row of incompleteRows) {
    const name = row.reporter?.trim();
    if (!name) continue;
    incompleteByReporter.set(name, (incompleteByReporter.get(name) ?? 0) + 1);
  }

  return [...incompleteByReporter.entries()]
    .map(([reporter, incomplete_count]) => {
      const total_count = totalByReporter.get(reporter) ?? incomplete_count;
      return {
        reporter,
        incomplete_count,
        total_count,
        pct: roundPct(incomplete_count, total_count),
      };
    })
    .sort(
      (a, b) =>
        b.incomplete_count - a.incomplete_count ||
        b.pct - a.pct ||
        a.reporter.localeCompare(b.reporter),
    );
}

function buildIncompleteByField(
  scoped: LeaderboardIssueRow[],
): IncompleteFieldBlock[] {
  const totalByReporter = new Map<string, number>();
  for (const row of scoped) {
    const name = row.reporter?.trim();
    if (!name) continue;
    totalByReporter.set(name, (totalByReporter.get(name) ?? 0) + 1);
  }

  const blocks: IncompleteFieldBlock[] = [];
  for (const field of TRACKER_MISSING_FIELD_KEYS) {
    const fieldRows = scoped.filter((row) =>
      missingFieldsForLeaderboardRow(row).includes(field),
    );
    if (!fieldRows.length) continue;

    const byReporter = new Map<string, number>();
    for (const row of fieldRows) {
      const name = row.reporter?.trim();
      if (!name) continue;
      byReporter.set(name, (byReporter.get(name) ?? 0) + 1);
    }

    const reporters = [...byReporter.entries()]
      .map(([reporter, incomplete_count]) => {
        const total_count = totalByReporter.get(reporter) ?? incomplete_count;
        return {
          reporter,
          incomplete_count,
          total_count,
          pct: roundPct(incomplete_count, total_count),
        };
      })
      .sort(
        (a, b) =>
          b.incomplete_count - a.incomplete_count ||
          b.pct - a.pct ||
          a.reporter.localeCompare(b.reporter),
      );

    blocks.push({
      field,
      label: TRACKER_MISSING_FIELD_LABELS[field as TrackerMissingFieldKey],
      total_incomplete: fieldRows.length,
      reporters,
    });
  }

  return blocks.sort(
    (a, b) => b.total_incomplete - a.total_incomplete || a.label.localeCompare(b.label),
  );
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
  const incomplete = scoped.filter(isIncompleteLeaderboardRow);

  const byType: Record<string, ReporterRank[]> = {};
  for (const group of ['Bug', 'Defect'] as const) {
    const subset = scoped.filter((r) => mapIssueTypeGroup(r.issue_type) === group);
    if (subset.length) byType[group] = buildReporterLeaderboard(subset);
  }

  const ac_label_matrix = buildAcLabelMatrix(scoped);

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
      incomplete_count: incomplete.length,
    },
    global: buildReporterLeaderboard(scoped),
    by_issue_type: byType,
    ac_label_matrix,
    by_project,
    accepted: buildReporterLeaderboard(accepted),
    rejected: buildReporterLeaderboard(rejected),
    incomplete_reporters: buildIncompleteReporterRanks(scoped, incomplete),
    incomplete_by_field: buildIncompleteByField(scoped),
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
    case 'ac_label': {
      if (!group) break;
      // Matrix cells drill with "Bug|AC-related"; a bare bucket also works.
      const [first, second] = group.split('|');
      const typeGroup = second ? first : null;
      const acGroup = second ?? first;
      if (typeGroup === 'Bug' || typeGroup === 'Defect') {
        out = out.filter((r) => mapIssueTypeGroup(r.issue_type) === typeGroup);
      }
      if ((AC_LABEL_GROUPS as readonly string[]).includes(acGroup)) {
        out = out.filter((r) => acLabelGroupOf(r) === acGroup);
      }
      break;
    }
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
    case 'incomplete':
      out = out.filter(isIncompleteLeaderboardRow);
      break;
    case 'incomplete_field':
      if (group) {
        out = out.filter((r) => missingFieldsForLeaderboardRow(r).includes(group));
      } else {
        out = out.filter(isIncompleteLeaderboardRow);
      }
      break;
    default:
      break;
  }

  return out
    .slice()
    .sort((a, b) => (b.created_date ?? '').localeCompare(a.created_date ?? ''))
    .slice(0, 200);
}
