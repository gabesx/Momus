import { describe, expect, it } from 'vitest';
import { computeAnalyticsResponse, firstResponseDays } from './response';
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

describe('firstResponseDays', () => {
  it('prefers the synced first_response_age_days (0 is valid: same-day response)', () => {
    expect(
      firstResponseDays(row({ project: 'A', is_open: true, first_response_age_days: 0 })),
    ).toBe(0);
    expect(
      firstResponseDays(row({ project: 'A', is_open: true, first_response_age_days: 4 })),
    ).toBe(4);
  });

  it('falls back to chart_date_first_response - created_date', () => {
    expect(
      firstResponseDays(
        row({
          project: 'A',
          is_open: true,
          created_date: '2026-06-01T00:00:00+07:00',
          chart_date_first_response: '2026-06-04T12:00:00+07:00',
        }),
      ),
    ).toBe(3.5);
  });

  it('returns null when never responded', () => {
    expect(firstResponseDays(row({ project: 'A', is_open: true }))).toBeNull();
  });
});

describe('computeAnalyticsResponse', () => {
  it('computes avg/median over responded rows and counts untouched open rows', () => {
    const res = computeAnalyticsResponse([
      row({ project: 'A', is_open: true, first_response_age_days: 1 }),
      row({ project: 'A', is_open: false, first_response_age_days: 3 }),
      row({ project: 'A', is_open: true }), // untouched open
      row({ project: 'A', is_open: false }), // untouched but resolved
    ]);
    expect(res.responded_count).toBe(2);
    expect(res.avg_days).toBe(2);
    expect(res.median_days).toBe(2);
    expect(res.open_untouched).toBe(1);
  });

  it('measures first-response SLA over responded rows (default 2 days)', () => {
    const res = computeAnalyticsResponse([
      row({ project: 'A', is_open: false, first_response_age_days: 1 }),
      row({ project: 'A', is_open: false, first_response_age_days: 2 }),
      row({ project: 'A', is_open: false, first_response_age_days: 5 }),
    ]);
    expect(res.sla_first_response).toEqual({
      pct: 66.7,
      within: 2,
      eligible: 3,
      threshold_days: 2,
    });
  });

  it('measures resolution SLA per severity with exact match (Critical 3d, Major 7d)', () => {
    const res = computeAnalyticsResponse([
      // Critical: 48h = 2d (within), 96h = 4d (breach)
      row({ project: 'A', is_open: false, severity_issue: 'Critical', time_to_resolution_hours: 48 }),
      row({ project: 'A', is_open: false, severity_issue: 'Critical', time_to_resolution_hours: 96 }),
      // Major: 144h = 6d (within)
      row({ project: 'A', is_open: false, severity_issue: 'Major', time_to_resolution_hours: 144 }),
      // Open Critical does not count
      row({ project: 'A', is_open: true, severity_issue: 'Critical', time_to_resolution_hours: 500 }),
      // Minor is out of both SLAs
      row({ project: 'A', is_open: false, severity_issue: 'Minor', time_to_resolution_hours: 999 }),
    ]);
    expect(res.sla_critical_resolution).toEqual({
      pct: 50,
      within: 1,
      eligible: 2,
      threshold_days: 3,
    });
    expect(res.sla_major_resolution).toEqual({
      pct: 100,
      within: 1,
      eligible: 1,
      threshold_days: 7,
    });
  });

  it('yields null pct when nothing is eligible', () => {
    const res = computeAnalyticsResponse([row({ project: 'A', is_open: true })]);
    expect(res.sla_first_response.pct).toBeNull();
    expect(res.sla_critical_resolution.pct).toBeNull();
    expect(res.responded_count).toBe(0);
    expect(res.avg_days).toBe(0);
  });
});
