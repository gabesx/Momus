/**
 * BB-CALC-07: business-day age (Asia/Jakarta calendar dates).
 * Inclusive count of Mon–Fri excluding holiday dates (YYYY-MM-DD).
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type DefectAgeBucket = 'fresh' | 'aging' | 'stale' | 'long overdue';

/** Format a Date as YYYY-MM-DD in Asia/Jakarta. */
export function toJakartaDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function parseJakartaParts(iso: string): { y: number; m: number; d: number; h: number; min: number; s: number } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute'), s: get('second') };
}

/** Inclusive business days between two instants (Jakarta calendar). */
export function countBusinessDaysInclusive(
  startIso: string,
  endIso: string,
  holidays: ReadonlySet<string> | readonly string[] = [],
): number {
  const holidaySet = holidays instanceof Set ? holidays : new Set(holidays);
  const start = parseJakartaParts(startIso);
  const end = parseJakartaParts(endIso);

  let cursor = Date.UTC(start.y, start.m - 1, start.d);
  const endUtc = Date.UTC(end.y, end.m - 1, end.d);
  if (cursor > endUtc) return 0;

  let count = 0;
  while (cursor <= endUtc) {
    const dt = new Date(cursor);
    const dow = dt.getUTCDay(); // 0 Sun … 6 Sat
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (dow !== 0 && dow !== 6 && !holidaySet.has(key)) {
      count += 1;
    }
    cursor += 24 * 60 * 60 * 1000;
  }
  return count;
}

export function defectAgeBucket(days: number): DefectAgeBucket {
  if (days <= 5) return 'fresh';
  if (days <= 20) return 'aging';
  if (days <= 80) return 'stale';
  return 'long overdue';
}

/**
 * Hours between created and resolution.
 * If resolution is exactly midnight (Jakarta), use end-of-day (23:59:59.999).
 */
export function timeToResolutionHours(createdIso: string, resolutionIso: string): number {
  const created = new Date(createdIso);
  let resolution = new Date(resolutionIso);
  const parts = parseJakartaParts(resolutionIso);
  if (parts.h === 0 && parts.min === 0 && parts.s === 0) {
    // End of that Jakarta calendar day ≈ next midnight Jakarta - 1ms
    // Construct as UTC equivalent of Jakarta end-of-day: date + 16:59:59.999 UTC when +07
    const eod = new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 16, 59, 59, 999));
    resolution = eod;
  }
  return (resolution.getTime() - created.getTime()) / (1000 * 60 * 60);
}

export function calendarFieldsFromCreated(createdIso: string) {
  const p = parseJakartaParts(createdIso);
  const quarter = Math.floor((p.m - 1) / 3) + 1;
  return {
    created_year: p.y,
    created_num_month: p.m,
    created_month_alpha: MONTH_NAMES[p.m - 1],
    quarter: `Q${quarter} ${p.y}`,
  };
}

export function calendarFieldsFromResolved(resolutionIso: string | null | undefined) {
  if (!resolutionIso) {
    return {
      closed_year: null as number | null,
      closed_month: null as string | null,
      closed_alpha_month: null as string | null,
    };
  }
  const p = parseJakartaParts(resolutionIso);
  return {
    closed_year: p.y,
    closed_month: String(p.m),
    closed_alpha_month: MONTH_NAMES[p.m - 1],
  };
}

/**
 * Pre-2024 age special case: use sprint completeDate (highest id), else resolution, else 10.
 * For created >= 2024: business days from created → end (resolution or now).
 */
export function computeDefectAgeDays(input: {
  createdIso: string;
  endIso: string | null;
  nowIso: string;
  holidays?: ReadonlySet<string> | readonly string[];
  pre2024AgeDays?: number | null;
}): number {
  const createdYear = parseJakartaParts(input.createdIso).y;
  if (createdYear < 2024) {
    if (input.pre2024AgeDays != null) return input.pre2024AgeDays;
    return 10;
  }
  const end = input.endIso ?? input.nowIso;
  return countBusinessDaysInclusive(input.createdIso, end, input.holidays ?? []);
}

/** Extract pre-2024 age from raw Jira sprint data when available. */
export function pre2024AgeFromRaw(
  createdIso: string,
  raw: { fields?: { customfield_10020?: unknown; resolutiondate?: string | null } } | null,
  holidays: ReadonlySet<string> | readonly string[] = [],
): number {
  const sprints = raw?.fields?.customfield_10020;
  if (Array.isArray(sprints) && sprints.length > 0) {
    const withId = sprints
      .map((s) => {
        if (typeof s === 'string') {
          const idMatch = /id=(\d+)/.exec(s);
          const completeMatch = /completeDate=([^,\]]+)/.exec(s);
          return {
            id: idMatch ? Number(idMatch[1]) : 0,
            completeDate: completeMatch?.[1] && completeMatch[1] !== 'null' ? completeMatch[1] : null,
          };
        }
        if (s && typeof s === 'object') {
          const obj = s as { id?: number; completeDate?: string };
          return { id: obj.id ?? 0, completeDate: obj.completeDate ?? null };
        }
        return { id: 0, completeDate: null };
      })
      .filter((s) => s.completeDate);
    if (withId.length > 0) {
      withId.sort((a, b) => b.id - a.id);
      return countBusinessDaysInclusive(createdIso, withId[0].completeDate!, holidays);
    }
  }
  const resolution = raw?.fields?.resolutiondate;
  if (resolution) {
    return countBusinessDaysInclusive(createdIso, resolution, holidays);
  }
  return 10;
}
