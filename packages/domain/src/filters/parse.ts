import {
  BUG_GROUP_TYPES,
  BUG_ISSUE_TYPES,
  DEFAULT_EXCLUDED_PROJECTS,
  DEFECT_GROUP_TYPES,
  STATUS_CATEGORY_GROUPS,
} from '../constants/defaults';

export type BugBudgetFilterParams = {
  project?: string;
  status?: string;
  reporter?: string;
  year?: number | string;
  quarter?: string;
  issue_type?: string;
  status_category?: 'todo' | 'in_progress' | 'done';
  not_done?: string | boolean;
  issue_type_group?: 'bug' | 'defect';
  assignee?: string;
  ac_related?: 'ac_related' | 'non_ac_related';
  date_from?: string;
  date_to?: string;
  age_min?: number | string;
  age_max?: number | string;
  open_critical_major?: string | boolean;
  show_all?: string | boolean;
  include_all_projects?: string | boolean;
  sort?: string;
  direction?: 'asc' | 'desc';
  per_page?: number | string;
  page?: number | string;
};

export type FilterPredicate = {
  field: string;
  op:
    | 'eq'
    | 'neq'
    | 'in'
    | 'like'
    | 'gte'
    | 'lte'
    | 'json_contains_any'
    | 'and_group';
  value: unknown;
};

export type ParsedFilters = {
  predicates: FilterPredicate[];
  sort: string;
  direction: 'asc' | 'desc';
  page: number;
  perPage: number;
  perPageCapped: boolean;
};

function present(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false && value !== '';
}

const ALLOWED_SORTS = new Set([
  'created_date',
  'updated_at',
  'project',
  'status',
  'priority',
  'issue_type',
  'assignee_final',
  'severity_issue',
  'tested_by',
  'end_date',
  'defect_age_days',
]);

/** BB-API-03: parse query params into filter predicates + pagination. */
export function parseBugBudgetFilters(params: BugBudgetFilterParams): ParsedFilters {
  const predicates: FilterPredicate[] = [];

  if (params.project) predicates.push({ field: 'project', op: 'eq', value: params.project });
  if (params.status) predicates.push({ field: 'status', op: 'eq', value: params.status });
  if (params.reporter) predicates.push({ field: 'reporter', op: 'eq', value: params.reporter });
  if (params.year !== undefined && params.year !== '' && params.year !== 'all') {
    predicates.push({ field: 'created_year', op: 'eq', value: Number(params.year) });
  }
  if (params.quarter) predicates.push({ field: 'quarter', op: 'eq', value: params.quarter });
  if (params.issue_type) predicates.push({ field: 'issue_type', op: 'eq', value: params.issue_type });

  if (params.status_category) {
    const group = STATUS_CATEGORY_GROUPS[params.status_category];
    predicates.push({ field: 'status', op: 'in', value: [...group] });
  }

  if (present(params.not_done)) {
    predicates.push({ field: 'status_category', op: 'neq', value: 'Done' });
  }

  if (params.issue_type_group === 'bug') {
    predicates.push({ field: 'issue_type', op: 'in', value: [...BUG_GROUP_TYPES] });
  } else if (params.issue_type_group === 'defect') {
    predicates.push({ field: 'issue_type', op: 'in', value: [...DEFECT_GROUP_TYPES] });
  }

  if (params.assignee) {
    predicates.push({ field: 'assignee_final', op: 'like', value: params.assignee });
  }

  if (params.ac_related === 'ac_related') {
    predicates.push({
      field: 'ac_related_labels',
      op: 'json_contains_any',
      value: ['ac-related', 'ac-related-inferred'],
    });
  } else if (params.ac_related === 'non_ac_related') {
    predicates.push({
      field: 'ac_related_labels',
      op: 'json_contains_any',
      value: ['non-ac-related', 'non-ac-related-inferred'],
    });
  }

  if (params.date_from) predicates.push({ field: 'created_date', op: 'gte', value: params.date_from });
  if (params.date_to) predicates.push({ field: 'created_date', op: 'lte', value: params.date_to });
  if (params.age_min !== undefined && params.age_min !== '') {
    predicates.push({ field: 'defect_age_days', op: 'gte', value: Number(params.age_min) });
  }
  if (params.age_max !== undefined && params.age_max !== '') {
    predicates.push({ field: 'defect_age_days', op: 'lte', value: Number(params.age_max) });
  }

  if (present(params.open_critical_major)) {
    predicates.push({
      field: '_open_critical_major',
      op: 'and_group',
      value: { is_open: true, severity_issue: ['Critical', 'Major'] },
    });
  }

  // Default scopes (unless escaped)
  if (!present(params.show_all) && !params.issue_type && !params.issue_type_group) {
    predicates.push({ field: 'issue_type', op: 'in', value: [...BUG_ISSUE_TYPES] });
  }
  if (!present(params.include_all_projects) && !params.project) {
    if (DEFAULT_EXCLUDED_PROJECTS.length > 0) {
      predicates.push({
        field: 'project',
        op: 'neq',
        value: { notIn: [...DEFAULT_EXCLUDED_PROJECTS] },
      });
    }
  }

  const sort = ALLOWED_SORTS.has(params.sort ?? '') ? (params.sort as string) : 'created_date';
  const direction = params.direction === 'asc' ? 'asc' : 'desc';

  let perPage = 25;
  let perPageCapped = false;
  if (params.per_page === 'all') {
    perPage = 100;
    perPageCapped = true;
  } else if (params.per_page) {
    const n = Number(params.per_page);
    perPage = [25, 50, 100].includes(n) ? n : 25;
  }

  const page = Math.max(1, Number(params.page ?? 1) || 1);

  return { predicates, sort, direction, page, perPage, perPageCapped };
}

export type FilterableIssue = {
  jira_key: string;
  project: string;
  status?: string | null;
  status_category?: string | null;
  reporter?: string | null;
  created_year?: number | null;
  quarter?: string | null;
  issue_type?: string | null;
  assignee_final?: string | null;
  ac_related_labels?: string[] | null;
  created_date?: string | null;
  defect_age_days?: number | null;
  is_open?: boolean;
  severity_issue?: string | null;
  priority?: string | null;
  final_issue_type?: string | null;
};

/** Apply parsed filters in-memory (for fixtures / unit tests). */
export function applyFilters<T extends FilterableIssue>(
  rows: T[],
  parsed: ParsedFilters,
): T[] {
  return rows.filter((row) =>
    parsed.predicates.every((p) => {
      switch (p.op) {
        case 'eq':
          return (row as Record<string, unknown>)[p.field] === p.value;
        case 'neq':
          if (p.value && typeof p.value === 'object' && 'notIn' in (p.value as object)) {
            const notIn = (p.value as { notIn: string[] }).notIn;
            return !notIn.includes(String((row as Record<string, unknown>)[p.field] ?? ''));
          }
          return (row as Record<string, unknown>)[p.field] !== p.value;
        case 'in':
          return (p.value as unknown[]).includes((row as Record<string, unknown>)[p.field]);
        case 'like': {
          const hay = String((row as Record<string, unknown>)[p.field] ?? '').toLowerCase();
          return hay.includes(String(p.value).toLowerCase());
        }
        case 'gte':
          return Number((row as Record<string, unknown>)[p.field] ?? 0) >= Number(p.value);
        case 'lte':
          return Number((row as Record<string, unknown>)[p.field] ?? 0) <= Number(p.value);
        case 'json_contains_any': {
          const labels = (row.ac_related_labels ?? []).map((l) => l.toLowerCase());
          return (p.value as string[]).some((v) => labels.includes(v.toLowerCase()));
        }
        case 'and_group': {
          const g = p.value as { is_open: boolean; severity_issue: string[] };
          return row.is_open === g.is_open && g.severity_issue.includes(row.severity_issue ?? '');
        }
        default:
          return true;
      }
    }),
  );
}
