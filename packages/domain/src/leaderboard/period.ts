import type { LeaderboardPeriodType } from './types';

export type DateRange = { start: string; end: string }; // YYYY-MM-DD inclusive

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function defaultPeriodForType(
  periodType: LeaderboardPeriodType,
  nowIso: string,
): string {
  const d = new Date(nowIso);
  const month = d.getUTCMonth() + 1;
  if (periodType === 'all') return 'all';
  if (periodType === 'yearly') return 'full';
  if (periodType === 'semester') return month <= 6 ? 'H1' : 'H2';
  const q = Math.ceil(month / 3);
  return `Q${q}`;
}

export function resolvePeriodRange(
  year: number,
  periodType: LeaderboardPeriodType,
  period: string,
): DateRange | null {
  if (periodType === 'all') return null;
  if (periodType === 'yearly') {
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }
  if (periodType === 'semester') {
    if (period === 'H2') return { start: `${year}-07-01`, end: `${year}-12-31` };
    return { start: `${year}-01-01`, end: `${year}-06-30` };
  }
  // quarterly
  const map: Record<string, DateRange> = {
    Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
    Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
    Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
    Q4: {
      start: `${year}-10-01`,
      end: `${year}-12-${pad(lastDayOfMonth(year, 12))}`,
    },
  };
  return map[period] ?? map[defaultPeriodForType('quarterly', `${year}-06-15T00:00:00.000Z`)]!;
}

export function dateInRange(isoDate: string | null | undefined, range: DateRange | null): boolean {
  if (!isoDate) return false;
  if (!range) return true;
  const day = isoDate.slice(0, 10);
  return day >= range.start && day <= range.end;
}

export function availableYears(nowIso: string): number[] {
  const y = new Date(nowIso).getUTCFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}
