import type { TrackerIssueRow } from './types';

export const TRACKER_MISSING_FIELD_KEYS = [
  'summary',
  'parent',
  'ac_related_labels',
  'service_feature',
  'severity_issue',
  'tester_assignee',
] as const;

export type TrackerMissingFieldKey = (typeof TRACKER_MISSING_FIELD_KEYS)[number];

function isEmptyString(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

function isFieldMissing(key: TrackerMissingFieldKey, row: TrackerIssueRow): boolean {
  switch (key) {
    case 'ac_related_labels':
      return row.ac_related_labels == null || row.ac_related_labels.length === 0;
    case 'summary':
    case 'parent':
    case 'service_feature':
    case 'severity_issue':
    case 'tester_assignee':
      return isEmptyString(row[key]);
    default:
      return false;
  }
}

export function getMissingFields(row: TrackerIssueRow, excludedKeys: string[]): string[] {
  const excluded = new Set(excludedKeys);
  return TRACKER_MISSING_FIELD_KEYS.filter(
    (key) => !excluded.has(key) && isFieldMissing(key, row),
  );
}

export function isMissingFieldsRow(row: TrackerIssueRow, excludedKeys: string[]): boolean {
  return getMissingFields(row, excludedKeys).length > 0;
}
