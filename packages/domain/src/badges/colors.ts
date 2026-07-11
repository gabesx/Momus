export type BadgeColor =
  | 'success'
  | 'warning'
  | 'info'
  | 'danger'
  | 'secondary';

/** BB-UI-01 badge color mappers (list age scale standardized — D-6). */

export function statusColor(statusOrCategory: string | null | undefined): BadgeColor {
  const s = (statusOrCategory ?? '').toLowerCase();
  if (['done', 'resolved', 'closed'].includes(s)) return 'success';
  if (s.includes('in progress') || s.includes('testing')) return 'warning';
  if (s.includes('waiting for test')) return 'info';
  if (s.includes('to do') || s === 'open' || s.includes('backlog')) return 'danger';
  return 'secondary';
}

export function priorityColor(priority: string | null | undefined): BadgeColor {
  const p = (priority ?? '').toLowerCase();
  if (p === 'highest' || p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'info';
  if (p === 'low' || p === 'lowest') return 'success';
  return 'secondary';
}

export function severityColor(severity: string | null | undefined): BadgeColor {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical') return 'danger';
  if (s === 'major') return 'warning';
  if (s === 'moderate') return 'info';
  if (s === 'minor') return 'success';
  if (s === 'low') return 'secondary';
  return 'secondary';
}

/** List age badge scale: >60 danger; >20 warning; >5 info; else secondary. */
export function ageBadgeColor(defectAgeDays: number | null | undefined): BadgeColor {
  const n = defectAgeDays ?? 0;
  if (n > 60) return 'danger';
  if (n > 20) return 'warning';
  if (n > 5) return 'info';
  return 'secondary';
}

export function isRecent(createdIso: string | null | undefined, nowIso: string): boolean {
  if (!createdIso) return false;
  const created = new Date(createdIso).getTime();
  const now = new Date(nowIso).getTime();
  return now - created <= 30 * 24 * 60 * 60 * 1000;
}
