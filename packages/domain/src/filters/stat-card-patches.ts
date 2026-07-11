/** Serializable dashboard query keys (string values only). */
export type DashboardQueryState = Record<string, string | undefined>;

export type StatCardId = 'total' | 'open' | 'closed' | 'critical' | 'recent';

const SCOPE_KEYS = [
  'not_done',
  'status_category',
  'open_critical_major',
  'date_from',
  'date_to',
] as const;

function clearKeys(state: DashboardQueryState, keys: readonly string[]): DashboardQueryState {
  const next = { ...state };
  for (const k of keys) delete next[k];
  return next;
}

/** Format YYYY-MM-DD in Asia/Jakarta for an ISO instant, minus `days`. */
export function jakartaDateMinusDays(isoNow: string, days: number): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(isoNow));
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  const utc = Date.UTC(y, m - 1, d) - days * 86_400_000;
  const back = new Date(utc);
  const y2 = back.getUTCFullYear();
  const m2 = String(back.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(back.getUTCDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}

export function applyStatCardPatch(
  state: DashboardQueryState,
  card: StatCardId,
  isoNow: string,
): DashboardQueryState {
  const next = { ...clearKeys(state, SCOPE_KEYS), page: '1' };
  switch (card) {
    case 'total':
      return next;
    case 'open':
      return { ...next, not_done: '1' };
    case 'closed':
      return { ...next, status_category: 'done' };
    case 'critical':
      return { ...next, not_done: '1', open_critical_major: '1' };
    case 'recent':
      return { ...next, date_from: jakartaDateMinusDays(isoNow, 30) };
  }
}
