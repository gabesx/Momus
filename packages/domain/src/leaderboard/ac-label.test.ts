import { describe, expect, it } from 'vitest';
import {
  acLabelGroupOf,
  buildAcLabelMatrix,
  computeLeaderboard,
  filterReporterDrilldown,
} from './compute';
import type { LeaderboardIssueRow } from './types';

function row(partial: Partial<LeaderboardIssueRow>): LeaderboardIssueRow {
  return {
    reporter: 'Ari',
    issue_type: 'Bug',
    created_date: '2026-07-05T00:00:00+07:00',
    jira_key: 'AO-1',
    ...partial,
  };
}

const params = { period_type: 'quarterly' as const, year: 2026, period: 'Q3' };
const nowIso = '2026-07-14T10:00:00+07:00';

describe('acLabelGroupOf', () => {
  it('classifies AC-related and Non-AC-related from derived labels', () => {
    expect(acLabelGroupOf(row({ ac_related_labels: ['ac-related'] }))).toBe('AC-related');
    expect(acLabelGroupOf(row({ ac_related_labels: ['ac-related-inferred'] }))).toBe('AC-related');
    expect(acLabelGroupOf(row({ ac_related_labels: ['non-ac-related'] }))).toBe('Non-AC-related');
    expect(acLabelGroupOf(row({}))).toBe('Unlabeled');
  });

  it('flags Both labels when raw labels carry AC and non-AC at once', () => {
    // The sync collapses this to one derived label; raw labels reveal it.
    expect(
      acLabelGroupOf(
        row({ labels: ['ac-related', 'non-ac-related'], ac_related_labels: ['ac-related'] }),
      ),
    ).toBe('Both labels');
    expect(acLabelGroupOf(row({ labels: ['AC-Related', 'not-ac-related'] }))).toBe('Both labels');
  });

  it('does not treat non-ac as AC', () => {
    expect(acLabelGroupOf(row({ labels: ['non-ac-related'] }))).toBe('Non-AC-related');
  });
});

const rows: LeaderboardIssueRow[] = [
  // Ari: 2 bug AC + 1 defect non-AC
  row({ reporter: 'Ari', ac_related_labels: ['ac-related'] }),
  row({ reporter: 'Ari', jira_key: 'AO-2', ac_related_labels: ['ac-related'] }),
  row({
    reporter: 'Ari',
    jira_key: 'AO-3',
    issue_type: 'Defect',
    ac_related_labels: ['non-ac-related'],
  }),
  // Citra: 1 bug with both labels, 1 unlabeled defect
  row({ reporter: 'Citra', jira_key: 'AO-4', labels: ['ac-related', 'non-ac-related'] }),
  row({ reporter: 'Citra', jira_key: 'AO-5', issue_type: 'Defect Sub-task' }),
];

describe('buildAcLabelMatrix', () => {
  it('builds User × (Defect Group | Bug) × AC bucket rows sorted by total', () => {
    const matrix = buildAcLabelMatrix(rows);
    expect(matrix).toEqual([
      {
        reporter: 'Ari',
        defect_ac: 0,
        defect_non_ac: 1,
        defect_both: 0,
        bug_ac: 2,
        bug_non_ac: 0,
        bug_both: 0,
        unlabeled: 0,
        total: 3,
      },
      {
        reporter: 'Citra',
        defect_ac: 0,
        defect_non_ac: 0,
        defect_both: 0,
        bug_ac: 0,
        bug_non_ac: 0,
        bug_both: 1,
        unlabeled: 1,
        total: 2,
      },
    ]);
  });

  it('is exposed on computeLeaderboard results', () => {
    const result = computeLeaderboard(rows, params, nowIso);
    expect(result.ac_label_matrix.map((r) => r.reporter)).toEqual(['Ari', 'Citra']);
  });
});

describe('ac_label drilldown', () => {
  it('filters by matrix cell (issue group + AC bucket)', () => {
    const issues = filterReporterDrilldown(rows, params, nowIso, 'Ari', 'ac_label', 'Bug|AC-related');
    expect(issues.map((i) => i.jira_key)).toEqual(['AO-1', 'AO-2']);
    expect(
      filterReporterDrilldown(rows, params, nowIso, 'Ari', 'ac_label', 'Defect|Non-AC-related'),
    ).toHaveLength(1);
    expect(
      filterReporterDrilldown(rows, params, nowIso, 'Citra', 'ac_label', 'Bug|Both labels'),
    ).toHaveLength(1);
  });

  it('accepts a bare bucket without an issue group', () => {
    expect(filterReporterDrilldown(rows, params, nowIso, 'Ari', 'ac_label', 'AC-related')).toHaveLength(2);
  });
});
