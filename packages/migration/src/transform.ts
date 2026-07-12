import {
  BOOL_COLUMNS,
  BUG_BUDGET_COLUMNS,
  DATE_ONLY_COLUMNS,
  JSON_COLUMNS,
  type BugBudgetColumn,
} from './columns.js';

export function parseJsonField(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function toBool(value: unknown, fallback = false): boolean {
  if (value == null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (Buffer.isBuffer(value)) return value[0] !== 0;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === '1' || v === 'true') return true;
    if (v === '0' || v === 'false') return false;
  }
  return Boolean(value);
}

export function toIsoTimestamp(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }
  return null;
}

/** DATE columns → YYYY-MM-DD (Postgres date). Uses local Y-M-D for JS Date
 *  so MySQL DATE values are not shifted by UTC conversion. */
export function toDateOnly(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }
  return null;
}

export function transformBugBudgetRow(
  row: Record<string, unknown>,
): Record<BugBudgetColumn, unknown> {
  const out = {} as Record<BugBudgetColumn, unknown>;
  for (const col of BUG_BUDGET_COLUMNS) {
    const raw = row[col];
    if (JSON_COLUMNS.has(col)) {
      out[col] = parseJsonField(raw);
    } else if (BOOL_COLUMNS.has(col)) {
      out[col] = toBool(raw, col === 'is_open');
    } else if (DATE_ONLY_COLUMNS.has(col)) {
      out[col] = toDateOnly(raw);
    } else if (
      col.endsWith('_date') ||
      col.endsWith('_at') ||
      col === 'status_category_changed' ||
      col === 'chart_date_first_response' ||
      col === 'actual_start' ||
      col === 'actual_end'
    ) {
      out[col] = toIsoTimestamp(raw);
    } else if (col === 'summary' || col === 'project' || col === 'jira_key') {
      out[col] = raw == null ? '' : String(raw);
    } else {
      out[col] = raw;
    }
  }
  return out;
}

/** Canonical checksum line for BB-MIG-02. */
export function checksumLine(
  jiraKey: string,
  updatedDate: unknown,
  isOpen: unknown,
): string {
  const updated =
    updatedDate instanceof Date
      ? updatedDate.toISOString()
      : updatedDate == null
        ? ''
        : String(updatedDate);
  const open = toBool(isOpen, false) ? '1' : '0';
  return `${jiraKey}|${updated}|${open}`;
}
