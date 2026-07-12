import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import type { AnalyticsFilterParams, AnalyticsIssueRow } from './types';

export function jakartaYearMonth(iso: string): { y: number; m: number } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
  });
  const parts = fmt.formatToParts(new Date(iso));
  return {
    y: Number(parts.find((p) => p.type === 'year')!.value),
    m: Number(parts.find((p) => p.type === 'month')!.value),
  };
}

export function monthKeyFromIso(iso: string): string {
  const { y, m } = jakartaYearMonth(iso);
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function quarterKeyFromIso(iso: string): string {
  const { y, m } = jakartaYearMonth(iso);
  const q = Math.ceil(m / 3);
  return `${y}-Q${q}`;
}

export function yearKeyFromIso(iso: string): string {
  return String(jakartaYearMonth(iso).y);
}

/** Inclusive start of the last `months` calendar months ending at `nowIso` (Jakarta). */
export function defaultWindowStartIso(nowIso: string, months = 24): string {
  const { y, m } = jakartaYearMonth(nowIso);
  const total = y * 12 + (m - 1) - (months - 1);
  const sy = Math.floor(total / 12);
  const sm = (total % 12) + 1;
  return `${sy}-${String(sm).padStart(2, '0')}-01T00:00:00+07:00`;
}

export function issueTypeOf(row: AnalyticsIssueRow): string {
  return row.issue_type ?? row.final_issue_type ?? '';
}

export function isAcRelatedLabels(labels?: string[] | null): boolean {
  return (labels ?? []).some(
    (l) => l.toLowerCase().includes('ac-related') && !l.toLowerCase().includes('non-ac'),
  );
}

export function isNonAcRelatedLabels(labels?: string[] | null): boolean {
  return (labels ?? []).some((l) => l.toLowerCase().includes('non-ac-related'));
}

function jakartaDateKey(iso: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(iso));
}

export function applyAnalyticsFilters(
  rows: AnalyticsIssueRow[],
  params: AnalyticsFilterParams,
  nowIso: string,
): AnalyticsIssueRow[] {
  let out = rows;
  const year = params.year;
  if (year !== undefined && year !== null && year !== '' && year !== 'all') {
    const y = Number(year);
    out = out.filter(
      (r) => r.created_year === y || (r.created_date && jakartaYearMonth(r.created_date).y === y),
    );
  } else if (!params.date_from && !params.date_to) {
    const start = new Date(defaultWindowStartIso(nowIso)).getTime();
    out = out.filter((r) => {
      if (!r.created_date) return false;
      return new Date(r.created_date).getTime() >= start;
    });
  }
  if (params.date_from) {
    const from = params.date_from.slice(0, 10);
    out = out.filter((r) => r.created_date && jakartaDateKey(r.created_date) >= from);
  }
  if (params.date_to) {
    const to = params.date_to.slice(0, 10);
    out = out.filter((r) => r.created_date && jakartaDateKey(r.created_date) <= to);
  }
  if (params.project) out = out.filter((r) => r.project === params.project);
  if (params.issue_type === 'bugs') {
    out = out.filter((r) => (BUG_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)));
  } else if (params.issue_type === 'defects') {
    out = out.filter((r) => (DEFECT_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)));
  }
  if (params.status === 'open') {
    out = out.filter((r) => r.is_open);
  } else if (params.status === 'in-progress') {
    out = out.filter((r) => {
      const c = (r.status_category ?? '').toLowerCase();
      return c.includes('progress') || c.includes('testing') || c.includes('waiting');
    });
  } else if (params.status === 'resolved' || params.status === 'closed') {
    out = out.filter((r) => !r.is_open);
  }
  if (params.severity) {
    const sev = params.severity.toLowerCase();
    out = out.filter((r) => (r.severity_issue ?? '').toLowerCase() === sev);
  }
  if (params.ac_related === 'yes') {
    out = out.filter((r) => isAcRelatedLabels(r.ac_related_labels ?? r.labels));
  } else if (params.ac_related === 'no') {
    out = out.filter((r) => !isAcRelatedLabels(r.ac_related_labels ?? r.labels));
  }
  if (params.priority === '__none__') {
    out = out.filter((r) => r.priority == null || r.priority === '');
  } else if (params.priority) {
    const p = params.priority.toLowerCase();
    out = out.filter((r) => (r.priority ?? '').toLowerCase() === p);
  }
  return out;
}
