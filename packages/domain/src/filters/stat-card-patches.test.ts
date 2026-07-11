import { describe, expect, it } from 'vitest';
import { applyStatCardPatch, type DashboardQueryState } from './stat-card-patches';

const base: DashboardQueryState = {
  not_done: '1',
  status_category: 'done',
  open_critical_major: '1',
  date_from: '2020-01-01',
  date_to: '2020-02-01',
  page: '2',
};

describe('applyStatCardPatch', () => {
  it('total clears scope quick filters and resets page', () => {
    const next = applyStatCardPatch(base, 'total', '2026-07-11T00:00:00+07:00');
    expect(next.not_done).toBeUndefined();
    expect(next.status_category).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
    expect(next.date_from).toBeUndefined();
    expect(next.date_to).toBeUndefined();
    expect(next.page).toBe('1');
  });

  it('open sets not_done=1', () => {
    const next = applyStatCardPatch(base, 'open', '2026-07-11T00:00:00+07:00');
    expect(next.not_done).toBe('1');
    expect(next.status_category).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
    expect(next.page).toBe('1');
  });

  it('closed sets status_category=done', () => {
    const next = applyStatCardPatch({ ...base, not_done: '1' }, 'closed', '2026-07-11T00:00:00+07:00');
    expect(next.status_category).toBe('done');
    expect(next.not_done).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
  });

  it('critical sets not_done + open_critical_major', () => {
    const next = applyStatCardPatch(base, 'critical', '2026-07-11T00:00:00+07:00');
    expect(next.not_done).toBe('1');
    expect(next.open_critical_major).toBe('1');
    expect(next.status_category).toBeUndefined();
  });

  it('recent sets date_from to today-30 in Asia/Jakarta (YYYY-MM-DD)', () => {
    const next = applyStatCardPatch(base, 'recent', '2026-07-11T15:00:00+07:00');
    expect(next.date_from).toBe('2026-06-11');
    expect(next.not_done).toBeUndefined();
    expect(next.status_category).toBeUndefined();
    expect(next.open_critical_major).toBeUndefined();
  });
});
