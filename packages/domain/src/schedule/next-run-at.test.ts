import { describe, expect, it } from 'vitest';
import { computeNextRunAt } from './next-run-at';

describe('computeNextRunAt (Asia/Jakarta)', () => {
  it('daily: same day later time', () => {
    // from Sat 2026-07-11 10:00 +07 → time 18:00 → same calendar day 18:00 +07
    const iso = computeNextRunAt({
      schedule_type: 'daily',
      interval_days: 1,
      time: '18:00',
      fromIso: '2026-07-11T03:00:00.000Z', // 10:00 Jakarta
    });
    expect(iso).toBe('2026-07-11T11:00:00.000Z'); // 18:00 Jakarta
  });

  it('daily: time already passed → next day', () => {
    const iso = computeNextRunAt({
      schedule_type: 'daily',
      interval_days: 1,
      time: '00:00',
      fromIso: '2026-07-11T03:00:00.000Z', // 10:00 Jakarta
    });
    expect(iso).toBe('2026-07-11T17:00:00.000Z'); // next day 00:00 Jakarta = Jul 12 00:00 +07
  });

  it('custom: adds interval_days then applies time', () => {
    const iso = computeNextRunAt({
      schedule_type: 'custom',
      interval_days: 3,
      time: '00:00',
      fromIso: '2026-07-11T03:00:00.000Z',
    });
    // Jul 11 + 3 days = Jul 14 00:00 Jakarta → 2026-07-13T17:00:00.000Z
    expect(iso).toBe('2026-07-13T17:00:00.000Z');
  });

  it('weekly: advances to target weekday at time', () => {
    // 2026-07-11 is Saturday Jakarta; next monday 00:00
    const iso = computeNextRunAt({
      schedule_type: 'weekly',
      interval_days: 1,
      time: '00:00',
      day_of_week: 'monday',
      fromIso: '2026-07-11T03:00:00.000Z',
    });
    expect(iso).toBe('2026-07-12T17:00:00.000Z'); // Mon Jul 13 00:00 Jakarta
  });

  it('monthly: day_of_month this month or next', () => {
    const iso = computeNextRunAt({
      schedule_type: 'monthly',
      interval_days: 1,
      time: '00:00',
      day_of_month: 15,
      fromIso: '2026-07-11T03:00:00.000Z',
    });
    expect(iso).toBe('2026-07-14T17:00:00.000Z'); // Jul 15 00:00 Jakarta
  });
});
