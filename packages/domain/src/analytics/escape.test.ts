import { describe, expect, it } from 'vitest';
import { computeAnalyticsEscape, isFoundInProd } from './escape';
import { computeAnalyticsResponse } from './response';
import type { AnalyticsIssueRow } from './types';

function row(
  partial: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>,
): AnalyticsIssueRow {
  return {
    created_date: '2026-06-01T00:00:00+07:00',
    created_year: 2026,
    issue_type: 'Bug',
    ...partial,
  };
}

describe('isFoundInProd', () => {
  it('matches the default found-in-prod label case-insensitively', () => {
    expect(
      isFoundInProd(row({ project: 'A', is_open: true, labels: ['Found-In-Prod', 'x'] })),
    ).toBe(true);
    expect(isFoundInProd(row({ project: 'A', is_open: true, labels: ['staging'] }))).toBe(false);
    expect(isFoundInProd(row({ project: 'A', is_open: true, labels: null }))).toBe(false);
  });

  it('honors custom label conventions', () => {
    const r = row({ project: 'A', is_open: true, labels: ['prod-bug'] });
    expect(isFoundInProd(r, ['prod-bug', 'production'])).toBe(true);
    expect(isFoundInProd(r)).toBe(false);
  });
});

describe('computeAnalyticsEscape', () => {
  it('computes escape percentage over all rows in scope', () => {
    const res = computeAnalyticsEscape([
      row({ project: 'A', is_open: true, labels: ['found-in-prod'] }),
      row({ project: 'A', is_open: false, labels: [] }),
      row({ project: 'A', is_open: false }),
    ]);
    expect(res).toEqual({
      prod: 1,
      total: 3,
      pct: 33.3,
      labels_used: ['found-in-prod'],
    });
  });

  it('handles empty scope', () => {
    expect(computeAnalyticsEscape([]).pct).toBe(0);
  });
});

describe('computeAnalyticsResponse custom SLA settings', () => {
  it('uses configured thresholds instead of defaults', () => {
    const res = computeAnalyticsResponse(
      [row({ project: 'A', is_open: false, first_response_age_days: 4 })],
      {
        sla_first_response_days: 5,
        sla_critical_resolution_days: 1,
        sla_major_resolution_days: 2,
      },
    );
    expect(res.sla_first_response).toEqual({
      pct: 100,
      within: 1,
      eligible: 1,
      threshold_days: 5,
    });
  });
});
