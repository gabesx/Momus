import { describe, expect, it } from 'vitest';
import {
  buildExecutiveDigestMessage,
  buildProductDigestMessage,
  issueLine,
  sparkline,
} from './digest-messages';
import type { ExecutiveSummary } from './executive-summary';
import type { ProductHealth, ProductIssueRef } from './product-health';

const jiraBase = 'https://allofresh.atlassian.net/browse';

const blocker: ProductIssueRef = {
  jira_key: 'AL-1',
  summary: 'Refund not received',
  severity: 'Critical',
  priority: 'Highest',
  assignee: 'Dewi',
  reporter: 'Budi',
  age_days: 409,
};

describe('sparkline', () => {
  it('maps values to block chars and is flat when all zero', () => {
    expect(sparkline([0, 0, 0])).toBe('▁▁▁');
    expect(sparkline([0, 8]).endsWith('█')).toBe(true);
    expect(sparkline([]).length).toBe(0);
  });
});

describe('issueLine', () => {
  it('uses Slack link syntax and includes meta', () => {
    const s = issueLine(blocker, { jiraBase, linkStyle: 'slack' });
    expect(s).toContain('<https://allofresh.atlassian.net/browse/AL-1|AL-1>');
    expect(s).toContain('Refund not received');
    expect(s).toContain('(Critical/Highest, 409d, Dewi)');
  });

  it('uses a plain link for Google Chat', () => {
    const s = issueLine(blocker, { jiraBase, linkStyle: 'plain' });
    expect(s).toContain('AL-1 https://allofresh.atlassian.net/browse/AL-1');
    expect(s).not.toContain('<https://');
  });
});

describe('buildExecutiveDigestMessage', () => {
  const summary: ExecutiveSummary = {
    total_open: 159,
    created_this_week: 12,
    resolved_this_week: 6,
    net_this_week: 6,
    backlog_now: 159,
    backlog_prev: 153,
    release_blocking_count: 1,
    release_blockers: [blocker],
    top_squad: { key: 'AL', open: 46 },
  };

  it('renders the executive summary with blockers and a report link', () => {
    const msg = buildExecutiveDigestMessage(summary, {
      dateLabel: '2026-07-25',
      jiraBase,
      dashboardUrl: 'https://momus.example.com/reports/executive',
      linkStyle: 'slack',
    });
    expect(msg).toContain('Momus Weekly QA Digest — 2026-07-25');
    expect(msg).toContain('Total open bugs: 159');
    expect(msg).toContain('New this week: 12 · Closed: 6');
    expect(msg).toContain('Backlog: 153 → 159 (WoW +6)');
    expect(msg).toContain('Release-blocking (Highest+Critical): 1');
    expect(msg).toContain('Riskiest squad: AL (46 open)');
    expect(msg).toContain('<https://allofresh.atlassian.net/browse/AL-1|AL-1>');
    expect(msg).toContain('Full report');
  });
});

describe('buildProductDigestMessage', () => {
  const health: ProductHealth = {
    product: 'AL',
    open_total: 46,
    open_by_severity: { Critical: 6, Major: 14, Minor: 8, Low: 3 },
    open_by_priority: { Highest: 1, High: 10 },
    this_week: { created: 3, resolved: 2, net: 1 },
    backlog_now: 46,
    trend_8w: Array.from({ length: 8 }, (_, i) => ({
      week_start: `2026-0${i}`,
      created: i,
      resolved: 1,
    })),
    top_open: [blocker],
    oldest_open: [blocker],
    release_blockers: [blocker],
  };

  it('renders severity/priority/trend and issue sections', () => {
    const msg = buildProductDigestMessage(health, { jiraBase, linkStyle: 'plain' });
    expect(msg).toContain('🏷️ AL — Product Health');
    expect(msg).toContain('Open: 46 · New 3 / Closed 2 this week');
    expect(msg).toContain('Severity: Critical 6, Major 14, Minor 8, Low 3');
    expect(msg).toContain('Priority: Highest 1, High 10');
    expect(msg).toContain('Trend 8w — created');
    expect(msg).toContain('Release-blocking:');
    expect(msg).toContain('Top open (by severity):');
    expect(msg).toContain('Oldest open:');
  });
});
