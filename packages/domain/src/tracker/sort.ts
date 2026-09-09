import { getMissingDescriptionFields, getMissingFields } from './missing-fields';
import { trackerOwnerKey } from './filter';
import type { TrackerIssueRow } from './types';

export const TRACKER_SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type TrackerSortDirection = (typeof TRACKER_SORT_DIRECTIONS)[number];

export const TRACKER_SORT_COLUMNS = [
  'issue_type',
  'jira_key',
  'summary',
  'missing_fields',
  'reporter',
  'creator',
  'owner',
  'created_date',
  'end_date',
  'parent',
  'description',
  'labels',
  'severity_issue',
  'service_feature',
  'missing_description_fields',
  'project',
  'status',
  'linked_issues',
] as const;

export type TrackerSortColumn = (typeof TRACKER_SORT_COLUMNS)[number];

export function isTrackerSortColumn(value: string): value is TrackerSortColumn {
  return (TRACKER_SORT_COLUMNS as readonly string[]).includes(value);
}

function formatLinkedIssues(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry && typeof entry === 'object') {
          const e = entry as { key?: string; type?: string };
          if (e.key && e.type) return `${e.key} (${e.type})`;
          if (e.key) return String(e.key);
        }
        return String(entry);
      })
      .filter(Boolean)
      .join(', ');
  }
  return JSON.stringify(value);
}

function formatLabels(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(String).filter(Boolean).join(', ');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean).join(', ');
    } catch {
      return value;
    }
    return value;
  }
  return String(value);
}

function dateValue(raw: string | null | undefined): { empty: boolean; value: number } {
  if (!raw?.trim()) return { empty: true, value: 0 };
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return { empty: true, value: 0 };
  return { empty: false, value: t };
}

function stringValue(raw: string | null | undefined): { empty: boolean; value: string } {
  const t = raw?.trim() ?? '';
  if (!t) return { empty: true, value: '' };
  return { empty: false, value: t.toLowerCase() };
}

function sortKey(
  row: TrackerIssueRow,
  column: TrackerSortColumn,
): { empty: boolean; value: string | number } {
  switch (column) {
    case 'jira_key':
      return stringValue(row.jira_key);
    case 'summary':
      return stringValue(row.summary);
    case 'issue_type':
      return stringValue(row.issue_type);
    case 'reporter':
      return stringValue(row.reporter);
    case 'creator':
      return stringValue(row.creator);
    case 'owner': {
      const k = trackerOwnerKey(row);
      return k === 'Unassigned' ? { empty: true, value: '' } : stringValue(k);
    }
    case 'project':
      return stringValue(row.project);
    case 'status':
      return stringValue(row.status);
    case 'parent':
      return stringValue(row.parent);
    case 'description':
      return stringValue(row.description);
    case 'severity_issue':
      return stringValue(row.severity_issue);
    case 'service_feature':
      return stringValue(row.service_feature);
    case 'created_date':
      return dateValue(row.created_date);
    case 'end_date':
      return dateValue(row.end_date);
    case 'labels':
      return stringValue(formatLabels(row.labels));
    case 'linked_issues':
      return stringValue(formatLinkedIssues(row.linked_issues));
    case 'missing_fields':
      return stringValue(getMissingFields(row, []).join(','));
    case 'missing_description_fields':
      return stringValue(getMissingDescriptionFields(row.description).join(','));
    default:
      return { empty: true, value: '' };
  }
}

export function sortTrackerRows(
  rows: TrackerIssueRow[],
  sort: string | null | undefined,
  direction: 'asc' | 'desc' | null | undefined,
): TrackerIssueRow[] {
  if (!sort || !isTrackerSortColumn(sort)) return rows;
  const dir = direction === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const ka = sortKey(a, sort);
    const kb = sortKey(b, sort);
    if (ka.empty && kb.empty) return a.jira_key.localeCompare(b.jira_key);
    if (ka.empty) return 1;
    if (kb.empty) return -1;
    if (ka.value < kb.value) return -1 * dir;
    if (ka.value > kb.value) return 1 * dir;
    return a.jira_key.localeCompare(b.jira_key);
  });
}
