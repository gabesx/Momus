import { describe, expect, it } from 'vitest';
import type { CostMultipliers } from '../budget/cost';
import { computeTrends } from './trends';
import type { AnalyticsIssueRow } from './types';

const multipliers: CostMultipliers = {
  priority: { high: 2 },
  severity: { critical: 10, minor: 1 },
};

function row(
  partial: Partial<AnalyticsIssueRow> & Pick<AnalyticsIssueRow, 'project' | 'is_open'>,
): AnalyticsIssueRow {
  return {
    created_year: 2026,
    issue_type: 'Bug',
    ...partial,
  };
}

describe('computeTrends cost series', () => {
  const nowIso = '2026-07-13T10:00:00+07:00';

  it('sums calculateCost per period when multipliers are provided', () => {
    const trends = computeTrends(
      [
        // June: 2×10 + 2×1 = 22
        row({ project: 'A', is_open: true, created_date: '2026-06-05T00:00:00+07:00', priority: 'High', severity_issue: 'Critical' }),
        row({ project: 'A', is_open: true, created_date: '2026-06-20T00:00:00+07:00', priority: 'High', severity_issue: 'Minor' }),
        // July: unknown priority/severity → 1×1
        row({ project: 'A', is_open: true, created_date: '2026-07-02T00:00:00+07:00' }),
      ],
      'month',
      nowIso,
      multipliers,
    );
    expect(trends.labels).toEqual(['Jun 2026', 'Jul 2026']);
    expect(trends.cost).toEqual([22, 1]);
  });

  it('omits the cost series when multipliers are not provided', () => {
    const trends = computeTrends(
      [row({ project: 'A', is_open: true, created_date: '2026-06-05T00:00:00+07:00' })],
      'month',
      nowIso,
    );
    expect(trends.cost).toBeUndefined();
  });

  it('returns an empty cost series for an empty row set', () => {
    const trends = computeTrends([], 'month', nowIso, multipliers);
    expect(trends.cost).toEqual([]);
    expect(trends.labels).toEqual([]);
  });
});
