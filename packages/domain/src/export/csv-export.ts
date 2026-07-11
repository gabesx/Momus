import { calculateCost, type CostMultipliers } from '../budget/cost';

/** PRD §8.2 CSV columns — D-1: headers aligned with row values including computed Bug Cost. */
export const CSV_EXPORT_HEADERS = [
  'JIRA Key',
  'Project',
  'Summary',
  'Status',
  'Issue Type',
  'Priority',
  'Assignee',
  'Reporter',
  'Created Date',
  'Due Date',
  'Closed Date',
  'Complete Date',
  'Resolution Date',
  'Quarter',
  'Labels',
  'Sprint',
  'Story Points',
  'Age (Days)',
  'Bug Cost',
] as const;

export type CsvExportRow = {
  jira_key: string;
  project: string;
  summary?: string | null;
  status?: string | null;
  issue_type?: string | null;
  priority?: string | null;
  assignee_final?: string | null;
  reporter?: string | null;
  created_date?: string | null;
  due_date?: string | null;
  end_date?: string | null;
  actual_end?: string | null;
  resolved_date?: string | null;
  quarter?: string | null;
  labels?: string[] | null;
  sprint?: string | null;
  story_points?: number | null;
  defect_age_days?: number | null;
  severity_issue?: string | null;
};

export function formatCsvDate(value: string | null | undefined): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  return value;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function cell(value: string | number | null | undefined): string {
  if (value == null) return '';
  return escapeCsvCell(String(value));
}

/** Build CSV text (headers + rows). Caller orders rows (created_date desc). */
export function buildBugBudgetCsv(rows: CsvExportRow[], multipliers: CostMultipliers): string {
  const lines = [CSV_EXPORT_HEADERS.join(',')];
  for (const row of rows) {
    const cost = calculateCost(row.priority, row.severity_issue, multipliers);
    lines.push(
      [
        cell(row.jira_key),
        cell(row.project),
        cell(row.summary),
        cell(row.status),
        cell(row.issue_type),
        cell(row.priority),
        cell(row.assignee_final),
        cell(row.reporter),
        cell(formatCsvDate(row.created_date)),
        cell(formatCsvDate(row.due_date)),
        cell(formatCsvDate(row.end_date)),
        cell(formatCsvDate(row.actual_end)),
        cell(formatCsvDate(row.resolved_date)),
        cell(row.quarter),
        cell((row.labels ?? []).join(', ')),
        cell(row.sprint),
        cell(row.story_points),
        cell(row.defect_age_days),
        cell(cost),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function csvExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `bug_budget_export_${stamp}.csv`;
}
