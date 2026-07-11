import { describe, expect, it } from 'vitest';
import {
  countBusinessDaysInclusive,
  defectAgeBucket,
  timeToResolutionHours,
} from './business-days';
import { isOpenStatusCategory } from '../budget/is-open';
import { getBudgetStatus } from '../budget/status';
import { ageBadgeColor, priorityColor, severityColor, statusColor } from '../badges/colors';
import { buildDefaultJql, jqlHasDateFilter, parseScopeFromJql } from '../jql/builders';

describe('BB-CALC-05 is_open', () => {
  it('treats done/resolved/closed as closed', () => {
    expect(isOpenStatusCategory('Done')).toBe(false);
    expect(isOpenStatusCategory('RESOLVED')).toBe(false);
    expect(isOpenStatusCategory('closed')).toBe(false);
    expect(isOpenStatusCategory('In Progress')).toBe(true);
  });
});

describe('BB-CALC-07 business days', () => {
  it('counts inclusive weekdays for A.1 window', () => {
    expect(
      countBusinessDaysInclusive(
        '2026-03-02T09:00:00.000+0700',
        '2026-03-06T17:00:00.000+0700',
        [],
      ),
    ).toBe(5);
  });

  it('excludes holidays', () => {
    expect(
      countBusinessDaysInclusive(
        '2026-03-02T09:00:00.000+0700',
        '2026-03-06T17:00:00.000+0700',
        ['2026-03-04'],
      ),
    ).toBe(4);
  });

  it('buckets ages', () => {
    expect(defectAgeBucket(5)).toBe('fresh');
    expect(defectAgeBucket(6)).toBe('aging');
    expect(defectAgeBucket(21)).toBe('stale');
    expect(defectAgeBucket(81)).toBe('long overdue');
  });

  it('computes 104h resolution for A.1', () => {
    expect(
      timeToResolutionHours(
        '2026-03-02T09:00:00.000+0700',
        '2026-03-06T17:00:00.000+0700',
      ),
    ).toBe(104);
  });
});

describe('BB-CALC-04 budget status', () => {
  it('maps thresholds', () => {
    expect(getBudgetStatus(0).status_color).toBe('dark');
    expect(getBudgetStatus(14).status_color).toBe('danger');
    expect(getBudgetStatus(24).status_message).toBe('Be careful with budget');
    expect(getBudgetStatus(85).status_message).toBe('Warning');
    expect(getBudgetStatus(86).status_color).toBe('success');
  });
});

describe('BB-UI-01 badges', () => {
  it('maps colors', () => {
    expect(statusColor('Done')).toBe('success');
    expect(priorityColor('Highest')).toBe('danger');
    expect(severityColor('Major')).toBe('warning');
    expect(ageBadgeColor(61)).toBe('danger');
    expect(ageBadgeColor(3)).toBe('secondary');
  });
});

describe('BB-SCOPE JQL builders', () => {
  it('builds rolling-year default JQL', () => {
    const jql = buildDefaultJql({ year: 2026 });
    expect(jql).toContain('issuetype IN (Bug, Defect, "Defect Sub-task", "Defect Task")');
    expect(jql).toContain('created >= "2026-01-01"');
    expect(jql).toContain('created <= "2026-12-31"');
  });

  it('parses scope from JQL', () => {
    const parsed = parseScopeFromJql(
      'issuetype IN (Bug) AND project NOT IN (AFI, BUGS) AND created >= "2026-01-01"',
    );
    expect(parsed.issueTypes).toContain('Bug');
    expect(parsed.excludedProjects).toEqual(['AFI', 'BUGS']);
  });

  it('omits project exclusion when none configured', () => {
    const jql = buildDefaultJql({ year: 2026, excludedProjects: [] });
    expect(jql).not.toContain('project NOT IN');
  });

  it('detects date filters', () => {
    expect(jqlHasDateFilter('created >= "2026-01-01"')).toBe(true);
    expect(jqlHasDateFilter('project = AO')).toBe(false);
  });
});
