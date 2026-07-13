import type { TrackerFilterParams, TrackerTab } from '@momus/domain';
import { TIMEZONE } from '@momus/domain';

const VALID_TABS: TrackerTab[] = ['all', 'missing_fields', 'no_linked_test'];
const DEFAULT_TAB: TrackerTab = 'missing_fields';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Current calendar year in Asia/Jakarta. */
export function trackerDefaultYear(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric' }).format(now),
  );
}

function parseTab(raw: string | null): TrackerTab {
  if (raw && (VALID_TABS as readonly string[]).includes(raw)) {
    return raw as TrackerTab;
  }
  return DEFAULT_TAB;
}

function parsePage(raw: string | null): number {
  const n = raw != null ? Number(raw) : DEFAULT_PAGE;
  if (!Number.isInteger(n) || n < 1) return DEFAULT_PAGE;
  return n;
}

function parsePageSize(raw: string | null): number {
  const n = raw != null ? Number(raw) : DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(n, MAX_PAGE_SIZE);
}

function parseYear(raw: string | null): string {
  if (raw === 'all') return 'all';
  if (raw != null && raw !== '' && Number.isFinite(Number(raw))) return String(Number(raw));
  return String(trackerDefaultYear());
}

function parseExcludeProjects(sp: URLSearchParams): string[] | undefined {
  const raw = sp.get('exclude_projects') ?? sp.get('exclude');
  if (!raw?.trim()) return undefined;
  const list = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)] : undefined;
}

export function trackerParamsFromUrl(url: URL): TrackerFilterParams {
  const sp = url.searchParams;
  const get = (k: string) => sp.get(k) ?? undefined;
  return {
    tab: parseTab(sp.get('tab')),
    year: parseYear(sp.get('year')),
    project: get('project'),
    exclude_projects: parseExcludeProjects(sp),
    issue_type: (get('issue_type') as TrackerFilterParams['issue_type']) || undefined,
    q: get('q'),
    missing_field: get('missing_field'),
    squad: get('squad'),
    service: get('service'),
    engineer: get('engineer'),
    page: parsePage(sp.get('page')),
    page_size: parsePageSize(sp.get('page_size')),
  };
}

export function trackerParamsToQuery(state: TrackerFilterParams): string {
  const sp = new URLSearchParams();
  const tab = state.tab ?? DEFAULT_TAB;
  if (tab !== DEFAULT_TAB) sp.set('tab', tab);

  const year =
    state.year == null || state.year === ''
      ? String(trackerDefaultYear())
      : String(state.year);
  // Always emit year so "all" is distinct from the default (this year).
  sp.set('year', year);

  if (state.project) sp.set('project', state.project);
  if (state.exclude_projects?.length) {
    sp.set('exclude_projects', state.exclude_projects.join(','));
  }
  if (state.issue_type) sp.set('issue_type', state.issue_type);
  if (state.q) sp.set('q', state.q);
  if (state.missing_field) sp.set('missing_field', state.missing_field);
  if (state.squad) sp.set('squad', state.squad);
  if (state.service) sp.set('service', state.service);
  if (state.engineer) sp.set('engineer', state.engineer);
  const page = state.page ?? DEFAULT_PAGE;
  if (page !== DEFAULT_PAGE) sp.set('page', String(page));
  const pageSize = state.page_size ?? DEFAULT_PAGE_SIZE;
  if (pageSize !== DEFAULT_PAGE_SIZE) sp.set('page_size', String(pageSize));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
