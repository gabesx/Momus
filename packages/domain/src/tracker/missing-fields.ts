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

export const TRACKER_MISSING_FIELD_LABELS: Record<TrackerMissingFieldKey, string> = {
  summary: 'Summary',
  parent: 'Parent/Epic',
  ac_related_labels: 'AC-Related Labels',
  service_feature: 'Service/Feature',
  severity_issue: 'Severity Issue',
  tester_assignee: 'Ownership/Owner',
};

function isEmptyString(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

function isFieldMissing(key: TrackerMissingFieldKey, row: TrackerIssueRow): boolean {
  switch (key) {
    case 'ac_related_labels':
      return row.ac_related_labels == null || row.ac_related_labels.length === 0;
    case 'tester_assignee':
      // Ownership uses owner when present, else tester_assignee
      return isEmptyString(row.owner) && isEmptyString(row.tester_assignee);
    case 'summary':
    case 'parent':
    case 'service_feature':
    case 'severity_issue':
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

const DESCRIPTION_FIELD_LABELS = [
  'Expected Result',
  'Actual Result',
  'Steps to Reproduce',
] as const;

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function hasExpectedField(descriptionLower: string): boolean {
  if (
    containsAny(descriptionLower, [
      'expected result',
      'expected:',
      'expected |',
      '| expected |',
      '| expected',
      '|expected|',
      'expected|',
      ' expected ',
      ' expected',
      'expected ',
    ])
  ) {
    return true;
  }
  return (
    /[\s\p{P}]expected[\s\p{P}]/u.test(descriptionLower) ||
    /^expected[\s\p{P}]/u.test(descriptionLower) ||
    /[\s\p{P}]expected$/u.test(descriptionLower)
  );
}

function hasActualField(descriptionLower: string): boolean {
  if (
    containsAny(descriptionLower, [
      'actual result',
      'actual:',
      'actual |',
      '| actual |',
      '| actual',
      '|actual|',
      'actual|',
      ' actual ',
      ' actual',
      'actual ',
    ])
  ) {
    return true;
  }
  return (
    /[\s\p{P}]actual[\s\p{P}]/u.test(descriptionLower) ||
    /^actual[\s\p{P}]/u.test(descriptionLower) ||
    /[\s\p{P}]actual$/u.test(descriptionLower)
  );
}

function hasStepsField(descriptionLower: string): boolean {
  if (
    containsAny(descriptionLower, [
      'steps to reproduce',
      'step to reproduce',
      ' steps ',
      ' steps',
      'steps ',
      'steps:',
      'steps |',
      'steps|',
      'test step',
      'test steps',
      'how to repro',
      'how to reproduce',
      'reproduce',
      'repro',
    ])
  ) {
    return true;
  }
  return (
    /[\s\p{P}]steps[\s\p{P}]/u.test(descriptionLower) ||
    /^steps[\s\p{P}]/u.test(descriptionLower) ||
    /[\s\p{P}]steps$/u.test(descriptionLower)
  );
}

/** Legacy-parity: which description sections are missing from issue text. */
export function getMissingDescriptionFields(description: string | null | undefined): string[] {
  if (description == null || description.trim() === '') {
    return [...DESCRIPTION_FIELD_LABELS];
  }
  const lower = description.toLowerCase();
  const missing: string[] = [];
  if (!hasExpectedField(lower)) missing.push('Expected Result');
  if (!hasActualField(lower)) missing.push('Actual Result');
  if (!hasStepsField(lower)) missing.push('Steps to Reproduce');
  return missing;
}
