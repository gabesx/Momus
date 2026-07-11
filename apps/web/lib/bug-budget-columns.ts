export type ColumnId =
  | 'key'
  | 'project'
  | 'summary'
  | 'status'
  | 'priority'
  | 'severity'
  | 'assignee'
  | 'tested_by'
  | 'reporter'
  | 'created'
  | 'age'
  | 'issue_type'
  | 'closed'
  | 'complete_date'
  | 'resolution_date';

export const COLUMN_DEFS: {
  id: ColumnId;
  label: string;
  required?: boolean;
  optional?: boolean;
}[] = [
  { id: 'key', label: 'Key', required: true },
  { id: 'project', label: 'Project' },
  { id: 'summary', label: 'Summary' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'severity', label: 'Severity' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'tested_by', label: 'Test Assignee' },
  { id: 'reporter', label: 'Reporter' },
  { id: 'created', label: 'Created' },
  { id: 'age', label: 'Age' },
  { id: 'issue_type', label: 'Issue Type', optional: true },
  { id: 'closed', label: 'Closed', optional: true },
  { id: 'complete_date', label: 'Complete Date', optional: true },
  { id: 'resolution_date', label: 'Resolution Date', optional: true },
];

const STORAGE_KEY = 'momus.bugBudget.columns';

export function defaultVisibleColumns(): Record<ColumnId, boolean> {
  const vis = {} as Record<ColumnId, boolean>;
  for (const c of COLUMN_DEFS) {
    vis[c.id] = c.required ? true : !c.optional;
  }
  return vis;
}

export function loadVisibleColumns(): Record<ColumnId, boolean> {
  const defaults = defaultVisibleColumns();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<ColumnId, boolean>>;
    return { ...defaults, ...parsed, key: true };
  } catch {
    return defaults;
  }
}

export function saveVisibleColumns(vis: Record<ColumnId, boolean>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...vis, key: true }));
}
