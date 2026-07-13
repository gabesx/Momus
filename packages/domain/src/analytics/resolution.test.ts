import { describe, expect, it } from 'vitest';
import { computeAnalyticsResolution, resolutionHours } from './resolution';
import { computeAnalyticsSummary } from './summary';
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

describe('resolutionHours', () => {
  it('prefers the synced time_to_resolution_hours column', () => {
    expect(
      resolutionHours(
        row({ project: 'A', is_open: false, time_to_resolution_hours: 12.5 }),
      ),
    ).toBe(12.5);
  });

  it('falls back to resolved_date - created_date when the column is missing', () => {
    expect(
      resolutionHours(
        row({
          project: 'A',
          is_open: false,
          time_to_resolution_hours: null,
          created_date: '2026-06-01T00:00:00+07:00',
          resolved_date: '2026-06-02T12:00:00+07:00',
        }),
      ),
    ).toBe(36);
  });

  it('returns null when neither source is usable', () => {
    expect(
      resolutionHours(row({ project: 'A', is_open: false, resolved_date: null })),
    ).toBeNull();
    // resolved before created → invalid
    expect(
      resolutionHours(
        row({
          project: 'A',
          is_open: false,
          created_date: '2026-06-02T00:00:00+07:00',
          resolved_date: '2026-06-01T00:00:00+07:00',
        }),
      ),
    ).toBeNull();
  });
});

describe('computeAnalyticsResolution', () => {
  it('scopes to resolved issues with a usable resolution time', () => {
    const res = computeAnalyticsResolution([
      row({ project: 'A', is_open: true, time_to_resolution_hours: 10 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: 24 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: null, resolved_date: null }),
    ]);
    expect(res.overall.resolved_count).toBe(1);
    expect(res.overall.avg_hours).toBe(24);
    expect(res.overall.median_hours).toBe(24);
  });

  it('computes avg and median (even count averages middle pair)', () => {
    const res = computeAnalyticsResolution([
      row({ project: 'A', is_open: false, time_to_resolution_hours: 10 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: 20 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: 30 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: 100 }),
    ]);
    expect(res.overall.resolved_count).toBe(4);
    expect(res.overall.avg_hours).toBe(40);
    expect(res.overall.median_hours).toBe(25);
  });

  it('splits Critical/Major from the rest with exact severity match', () => {
    const res = computeAnalyticsResolution([
      row({ project: 'A', is_open: false, severity_issue: 'Critical', time_to_resolution_hours: 10 }),
      row({ project: 'A', is_open: false, severity_issue: 'Major', time_to_resolution_hours: 20 }),
      row({ project: 'A', is_open: false, severity_issue: 'critical', time_to_resolution_hours: 90 }),
      row({ project: 'A', is_open: false, severity_issue: 'Minor', time_to_resolution_hours: 30 }),
      row({ project: 'A', is_open: false, severity_issue: null, time_to_resolution_hours: 40 }),
    ]);
    expect(res.critical_major.resolved_count).toBe(2);
    expect(res.critical_major.avg_hours).toBe(15);
    expect(res.other.resolved_count).toBe(3);
    expect(res.by_severity.Critical.resolved_count).toBe(1);
    expect(res.by_severity.Major.median_hours).toBe(20);
    expect(res.by_severity.Unknown.avg_hours).toBe(40);
  });

  it('returns zeroed stats when nothing resolved is in scope', () => {
    const res = computeAnalyticsResolution([
      row({ project: 'A', is_open: true, time_to_resolution_hours: 10 }),
    ]);
    expect(res.overall).toEqual({ resolved_count: 0, avg_hours: 0, median_hours: 0 });
    expect(res.critical_major.resolved_count).toBe(0);
    expect(res.by_severity).toEqual({});
  });

  it('rounds avg and median to one decimal', () => {
    const res = computeAnalyticsResolution([
      row({ project: 'A', is_open: false, time_to_resolution_hours: 10 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: 10 }),
      row({ project: 'A', is_open: false, time_to_resolution_hours: 11 }),
    ]);
    expect(res.overall.avg_hours).toBe(10.3);
    expect(res.overall.median_hours).toBe(10);
  });
});

describe('computeAnalyticsSummary resolution MoM', () => {
  const nowIso = '2026-07-13T10:00:00+07:00';

  it('compares cohorts by resolved month, not created month', () => {
    const rows = [
      // resolved this month (July) — avg 20h
      row({
        project: 'A',
        is_open: false,
        created_date: '2026-05-01T00:00:00+07:00',
        resolved_date: '2026-07-02T00:00:00+07:00',
        time_to_resolution_hours: 20,
      }),
      // resolved previous month (June) — avg 40h
      row({
        project: 'A',
        is_open: false,
        created_date: '2026-05-01T00:00:00+07:00',
        resolved_date: '2026-06-15T00:00:00+07:00',
        time_to_resolution_hours: 40,
      }),
    ];
    const summary = computeAnalyticsSummary(rows, nowIso);
    expect(summary.resolution.overall.resolved_count).toBe(2);
    // (20 - 40) / 40 = -50%
    expect(summary.resolution.mom.avg_hours).toBe(-50);
    expect(summary.resolution.mom.median_hours).toBe(-50);
  });

  it('yields null MoM when the previous month has no resolutions', () => {
    const rows = [
      row({
        project: 'A',
        is_open: false,
        resolved_date: '2026-07-02T00:00:00+07:00',
        time_to_resolution_hours: 20,
      }),
    ];
    const summary = computeAnalyticsSummary(rows, nowIso);
    expect(summary.resolution.mom.avg_hours).toBeNull();
  });
});
