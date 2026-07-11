import type { DashboardQueryState } from '@momus/domain';
import { MESSAGES } from '@momus/shared';

const KNOWN_KEYS = [
  'project',
  'status',
  'status_category',
  'issue_type',
  'issue_type_group',
  'reporter',
  'year',
  'quarter',
  'ac_related',
  'assignee',
  'date_from',
  'date_to',
  'age_min',
  'age_max',
  'show_all',
  'include_all_projects',
  'not_done',
  'open_critical_major',
  'page',
  'per_page',
  'sort',
  'direction',
] as const;

export function parseDashboardQuery(sp: URLSearchParams): DashboardQueryState {
  const state: DashboardQueryState = {};
  for (const key of KNOWN_KEYS) {
    const v = sp.get(key);
    if (v !== null && v !== '') state[key] = v;
  }
  return state;
}

export function toSearchParams(state: DashboardQueryState): URLSearchParams {
  const sp = new URLSearchParams();
  for (const key of KNOWN_KEYS) {
    const v = state[key];
    if (v !== undefined && v !== '') sp.set(key, v);
  }
  return sp;
}

export function toQueryString(state: DashboardQueryState): string {
  const s = toSearchParams(state).toString();
  return s ? `?${s}` : '';
}

export function interpolateM01(n: number, m: number): string {
  return MESSAGES.M01.replace('{N}', String(n)).replace('{M}', String(m));
}

/** Count of filter predicates shown in Filters (N) — exclude pagination/sort. */
export function countActiveFilters(state: DashboardQueryState): number {
  const ignore = new Set(['page', 'per_page', 'sort', 'direction']);
  return KNOWN_KEYS.filter((k) => !ignore.has(k) && state[k]).length;
}
