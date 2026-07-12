import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { getMissingFields, isMissingFieldsRow } from './missing-fields';
import type { TrackerFilterParams, TrackerIssueRow } from './types';

function issueTypeOf(row: TrackerIssueRow): string {
  return row.issue_type ?? '';
}

function hasNoLinkedTest(row: TrackerIssueRow): boolean {
  return row.has_linked_test_execution !== true;
}

export function applyTrackerFilters(
  rows: TrackerIssueRow[],
  params: TrackerFilterParams,
): TrackerIssueRow[] {
  let out = rows;
  const tab = params.tab ?? 'all';

  if (tab === 'no_linked_test') {
    out = out.filter(hasNoLinkedTest);
  } else if (tab === 'missing_fields') {
    out = out.filter((row) => isMissingFieldsRow(row, []));
  }

  const year = params.year;
  if (year !== undefined && year !== null && year !== '' && year !== 'all') {
    const y = Number(year);
    out = out.filter((row) => row.created_year === y);
  }

  if (params.project) {
    out = out.filter((row) => row.project === params.project);
  }

  if (params.issue_type === 'bugs') {
    out = out.filter((row) => (BUG_GROUP_TYPES as readonly string[]).includes(issueTypeOf(row)));
  } else if (params.issue_type === 'defects') {
    out = out.filter((row) => (DEFECT_GROUP_TYPES as readonly string[]).includes(issueTypeOf(row)));
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
    out = out.filter((row) => getMissingFields(row, []).includes(missingField));
  }

  return out;
}
