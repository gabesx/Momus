import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { getMissingFields, isMissingFieldsRow } from './missing-fields';
import { hasLinkedTestExecutionFromLinkedIssues } from './linked-test';
import type { TrackerFilterParams, TrackerIssueRow } from './types';

function issueTypeOf(row: TrackerIssueRow): string {
  return row.issue_type ?? '';
}

/** True when linked_issues contains a "Test Execution" link type (or persisted flag). */
export function hasTestExecutionLink(row: TrackerIssueRow): boolean {
  if (Array.isArray(row.linked_issues)) {
    return hasLinkedTestExecutionFromLinkedIssues(row.linked_issues);
  }
  return row.has_linked_test_execution === true;
}

function hasNoLinkedTest(row: TrackerIssueRow): boolean {
  return !hasTestExecutionLink(row);
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

/** Keys must mirror analytics computeAnalyticsDistribution grouping. */
export function trackerSquadKey(row: TrackerIssueRow): string {
  return firstNonEmpty(row.real_project) ?? row.project;
}

export function trackerServiceKey(row: TrackerIssueRow): string {
  return firstNonEmpty(row.service_feature_final, row.service_feature) ?? 'Unspecified';
}

export function trackerEngineerKey(row: TrackerIssueRow): string {
  return firstNonEmpty(row.engineer_assignee, row.test_engineer_assignee) ?? 'Unassigned';
}

export function applyTrackerFilters(
  rows: TrackerIssueRow[],
  params: TrackerFilterParams,
): TrackerIssueRow[] {
  let out = rows;
  const tab = params.tab ?? 'all';
  const excluded = params.excluded_fields ?? [];

  if (tab === 'no_linked_test') {
    out = out.filter(hasNoLinkedTest);
  } else if (tab === 'missing_fields') {
    out = out.filter((row) => isMissingFieldsRow(row, excluded));
  }

  const year = params.year;
  if (year !== undefined && year !== null && year !== '' && year !== 'all') {
    const y = Number(year);
    out = out.filter((row) => row.created_year === y);
  }

  if (params.project) {
    out = out.filter((row) => row.project === params.project);
  }

  const excludedProjects = params.exclude_projects ?? [];
  if (excludedProjects.length) {
    const excluded = new Set(excludedProjects);
    out = out.filter((row) => !excluded.has(row.project || '—'));
  }

  if (params.issue_type === 'bugs') {
    out = out.filter((row) => (BUG_GROUP_TYPES as readonly string[]).includes(issueTypeOf(row)));
  } else if (params.issue_type === 'defects') {
    out = out.filter((row) => (DEFECT_GROUP_TYPES as readonly string[]).includes(issueTypeOf(row)));
  }

  if (params.squad) {
    out = out.filter((row) => trackerSquadKey(row) === params.squad);
  }
  if (params.service) {
    out = out.filter((row) => trackerServiceKey(row) === params.service);
  }
  if (params.engineer) {
    out = out.filter((row) => trackerEngineerKey(row) === params.engineer);
  }

  const q = params.q?.trim();
  if (q) {
    const lower = q.toLowerCase();
    out = out.filter(
      (row) =>
        row.jira_key.toLowerCase().includes(lower) ||
        row.summary.toLowerCase().includes(lower),
    );
  }

  const missingField = params.missing_field;
  if (missingField && missingField !== 'all') {
    if (excluded.includes(missingField)) return [];
    out = out.filter((row) => getMissingFields(row, excluded).includes(missingField));
  }

  return out;
}

/** Project tallies for the current tab/filters, ignoring the project chip filter. */
export function countTrackerProjects(
  rows: TrackerIssueRow[],
  params: TrackerFilterParams,
): { project: string; count: number }[] {
  const scoped = applyTrackerFilters(rows, {
    ...params,
    project: undefined,
    // Keep exclude_projects so excluded projects disappear from the chip strip.
  });
  const map = new Map<string, number>();
  for (const row of scoped) {
    const key = row.project || '—';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([project, count]) => ({ project, count }))
    .sort((a, b) => b.count - a.count || a.project.localeCompare(b.project));
}
