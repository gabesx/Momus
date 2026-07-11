import { TIMEZONE } from '../constants/defaults';

export type NextRunAtInput = {
  schedule_type: 'daily' | 'weekly' | 'monthly' | 'custom' | string;
  interval_days: number;
  time: string; // HH:MM
  day_of_week?: string | null;
  day_of_month?: number | null;
  fromIso?: string;
  from?: Date;
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

/** Parts of `instant` in Asia/Jakarta. */
export function jakartaParts(instant: Date): {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
  weekday: string;
} {
  const dateParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const weekdayPart = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    weekday: 'long',
  }).format(instant);

  const get = (type: string) => Number(dateParts.find((p) => p.type === type)?.value);

  return {
    y: get('year'),
    m: get('month'),
    d: get('day'),
    hh: get('hour'),
    mm: get('minute'),
    weekday: weekdayPart.toLowerCase(),
  };
}

/** Construct UTC Date for Jakarta local wall time y-m-d hh:mm (fixed +07, no DST). */
export function zonedJakartaToUtc(
  y: number,
  m: number,
  d: number,
  hh: number,
  mm: number,
): Date {
  return new Date(Date.UTC(y, m - 1, d, hh - 7, mm, 0, 0));
}

function parseTime(time: string): { hh: number; mm: number } {
  const [hhStr, mmStr] = time.split(':');
  return { hh: Number(hhStr) || 0, mm: Number(mmStr) || 0 };
}

function addJakartaDays(y: number, m: number, d: number, days: number): { y: number; m: number; d: number } {
  const anchor = zonedJakartaToUtc(y, m, d, 12, 0);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  const parts = jakartaParts(anchor);
  return { y: parts.y, m: parts.m, d: parts.d };
}

function computeDaily(from: Date, hh: number, mm: number): Date {
  const { y, m, d } = jakartaParts(from);
  let candidate = zonedJakartaToUtc(y, m, d, hh, mm);
  if (candidate <= from) {
    const next = addJakartaDays(y, m, d, 1);
    candidate = zonedJakartaToUtc(next.y, next.m, next.d, hh, mm);
  }
  return candidate;
}

function computeCustom(from: Date, intervalDays: number, hh: number, mm: number): Date {
  const { y, m, d } = jakartaParts(from);
  const next = addJakartaDays(y, m, d, Math.max(1, intervalDays));
  return zonedJakartaToUtc(next.y, next.m, next.d, hh, mm);
}

function computeWeekly(
  from: Date,
  dayOfWeek: string,
  hh: number,
  mm: number,
): Date {
  const target = WEEKDAYS.indexOf(dayOfWeek.toLowerCase() as (typeof WEEKDAYS)[number]);
  if (target < 0) {
    return computeDaily(from, hh, mm);
  }

  const { y, m, d, weekday } = jakartaParts(from);
  const current = WEEKDAYS.indexOf(weekday as (typeof WEEKDAYS)[number]);
  let daysUntil = (target - current + 7) % 7;
  let next = addJakartaDays(y, m, d, daysUntil);
  let candidate = zonedJakartaToUtc(next.y, next.m, next.d, hh, mm);

  if (candidate <= from) {
    next = addJakartaDays(next.y, next.m, next.d, 7);
    candidate = zonedJakartaToUtc(next.y, next.m, next.d, hh, mm);
  }

  return candidate;
}

function computeMonthly(from: Date, dayOfMonth: number, hh: number, mm: number): Date {
  const { y, m } = jakartaParts(from);
  let candidate = zonedJakartaToUtc(y, m, dayOfMonth, hh, mm);

  if (candidate <= from) {
    const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
    candidate = zonedJakartaToUtc(nextMonth.y, nextMonth.m, dayOfMonth, hh, mm);
  }

  return candidate;
}

export function computeNextRunAt(input: NextRunAtInput): string {
  const from = input.fromIso ? new Date(input.fromIso) : (input.from ?? new Date());
  const { hh, mm } = parseTime(input.time);

  let next: Date;

  switch (input.schedule_type) {
    case 'custom':
      next = computeCustom(from, input.interval_days, hh, mm);
      break;
    case 'weekly':
      next = input.day_of_week
        ? computeWeekly(from, input.day_of_week, hh, mm)
        : computeDaily(from, hh, mm);
      break;
    case 'monthly':
      next = input.day_of_month
        ? computeMonthly(from, input.day_of_month, hh, mm)
        : computeDaily(from, hh, mm);
      break;
    case 'daily':
    default:
      next = computeDaily(from, hh, mm);
      break;
  }

  return next.toISOString();
}
