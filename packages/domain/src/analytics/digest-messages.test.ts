import { describe, expect, it } from 'vitest';
import {
  buildExecutiveDigestMessage,
  buildProductDigestMessage,
  chunkDigest,
  criticalMajor,
  issueLine,
  orgTone,
  productTone,
  sparkline,
  sparklinePair,
  weekRangeLabel,
  type DigestThresholds,
} from './digest-messages';
import type { ExecutiveSummary } from './executive-summary';
import type { ProductHealth, ProductIssueRef } from './product-health';

const jiraBase = 'https://allofresh.atlassian.net/browse';

const thresholds: DigestThresholds = {
  open_warning: 100,
  open_critical_major_pct_warning: 25,
  resolution_rate_healthy_pct: 70,
};

const blocker: ProductIssueRef = {
  jira_key: 'AL-1',
  summary: 'Refund not received',
  severity: 'Critical',
  priority: 'Highest',
  assignee: 'Dewi',
  reporter: 'Budi',
  age_days: 409,
};

function issue(key: string, over: Partial<ProductIssueRef> = {}): ProductIssueRef {
  return { ...blocker, jira_key: key, summary: `Issue ${key}`, ...over };
}

function makeHealth(over: Partial<ProductHealth> = {}): ProductHealth {
  return {
    product: 'AL',
    open_total: 100,
    open_by_severity: { Critical: 5, Major: 5, Minor: 90 },
    open_by_priority: {},
    this_week: { created: 10, resolved: 10, net: 0 },
    backlog_now: 100,
    trend_8w: [],
    top_open: [],
    oldest_open: [],
    release_blockers: [],
    ...over,
  };
}

describe('sparkline', () => {
  it('maps values to block chars and is flat when all zero', () => {
    expect(sparkline([0, 0, 0])).toBe('▁▁▁');
    expect(sparkline([0, 8]).endsWith('█')).toBe(true);
    expect(sparkline([]).length).toBe(0);
  });

  it('renders a flat non-zero series at mid height, not full height', () => {
    // A stable week must not look like a crisis.
    expect(sparkline([1, 1, 1, 1])).toBe('▄▄▄▄');
    expect(sparkline([5, 5, 5])).toBe('▄▄▄');
  });

  it('honours a shared max so two series stay comparable', () => {
    const { a, b, max } = sparklinePair([1, 1, 1], [10, 10, 10]);
    expect(max).toBe(10);
    // Same input shape, wildly different magnitude — must render differently.
    expect(a).not.toBe(b);
    expect(b).toBe('███');
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

describe('weekRangeLabel', () => {
  it('renders a same-month range compactly', () => {
    expect(weekRangeLabel('2026-08-17T00:00:00Z')).toBe('11–17 Aug 2026');
  });

  it('spells out both months when the week straddles them', () => {
    expect(weekRangeLabel('2026-09-02T00:00:00Z')).toBe('27 Aug–2 Sep 2026');
  });
});

describe('tones', () => {
  it('is green when nothing breaches', () => {
    expect(productTone(makeHealth(), thresholds)).toBe('green');
  });

  it('is amber on a single breach', () => {
    expect(
      productTone(makeHealth({ this_week: { created: 5, resolved: 5, net: 3 } }), thresholds),
    ).toBe('amber');
  });

  it('is red on two breaches', () => {
    const h = makeHealth({ this_week: { created: 10, resolved: 2, net: 8 } });
    expect(productTone(h, thresholds)).toBe('red');
  });

  it('forces red when the critical/major share is catastrophic', () => {
    // 60% C/M is >= 2x the 25% threshold: red even though nothing else breaches.
    const h = makeHealth({ open_by_severity: { Critical: 30, Major: 30, Minor: 40 } });
    expect(productTone(h, thresholds)).toBe('red');
  });

  it('is green when nothing is open, whatever the week did', () => {
    // Regression: a product with 0 open bugs was rendering 🔴 because a week
    // with no closures scored a 0% resolution rate.
    const h = makeHealth({
      open_total: 0,
      open_by_severity: {},
      this_week: { created: 1, resolved: 0, net: 1 },
    });
    expect(productTone(h, thresholds)).toBe('green');
  });

  it('does not treat a quiet week as a resolution-rate breach', () => {
    // 0 created / 0 resolved is idle, not failing.
    const h = makeHealth({
      open_by_severity: { Critical: 1, Major: 1, Minor: 98 },
      this_week: { created: 0, resolved: 0, net: 0 },
    });
    expect(productTone(h, thresholds)).toBe('green');
  });

  it('counts total volume against open_warning for the org', () => {
    const s = { total_open: 20, created_this_week: 5, resolved_this_week: 5, net_this_week: 0 };
    expect(orgTone(s as ExecutiveSummary, 10, thresholds)).toBe('green');
    expect(orgTone({ ...s, total_open: 150 } as ExecutiveSummary, 10, thresholds)).toBe('amber');
  });
});

describe('criticalMajor', () => {
  it('counts Critical + Major and their share', () => {
    const h = makeHealth({
      open_total: 34,
      open_by_severity: { Critical: 6, Major: 6, Minor: 22 },
    });
    expect(criticalMajor(h)).toEqual({ count: 12, pct: 35 });
  });

  it('does not divide by zero on an empty product', () => {
    const h = makeHealth({ open_total: 0, open_by_severity: {} });
    expect(criticalMajor(h)).toEqual({ count: 0, pct: 0 });
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

  const opts = {
    dateLabel: '11–17 Aug 2026',
    jiraBase,
    dashboardUrl: 'https://momus.example.com/reports/executive',
    linkStyle: 'slack' as const,
    thresholds,
  };

  it('renders the executive summary with blockers and a report link', () => {
    const msg = buildExecutiveDigestMessage(summary, opts);
    expect(msg).toContain('Momus Weekly QA Digest — 11–17 Aug 2026');
    expect(msg).toContain('*159 open*');
    expect(msg).toContain('+6 net (12 new / 6 closed)');
    expect(msg).toContain('1 release-blocking');
    expect(msg).toContain('Backlog: 153 → 159');
    expect(msg).toContain('Riskiest squad: AL (46 open)');
    expect(msg).toContain('<https://allofresh.atlassian.net/browse/AL-1|AL-1>');
    expect(msg).toContain('Full report →');
  });

  it('states the open count once rather than duplicating backlog_now', () => {
    const msg = buildExecutiveDigestMessage(summary, opts);
    expect(msg).not.toContain('Total open bugs');
  });

  it('caps release blockers and reports the remainder', () => {
    const many = Array.from({ length: 9 }, (_, i) => issue(`AL-${i + 1}`));
    const msg = buildExecutiveDigestMessage({ ...summary, release_blockers: many }, opts);
    expect(msg).toContain('…and 4 more');
    expect(msg).toContain('AL-5');
    expect(msg).not.toContain('AL-6 ');
  });

  it('labels the flow sparkline with its scale', () => {
    const flow = Array.from({ length: 8 }, (_, i) => ({
      week_start: '2026-06-23T00:00:00Z',
      created: i,
      resolved: 1,
    }));
    const msg = buildExecutiveDigestMessage(summary, { ...opts, flow });
    expect(msg).toContain('Flow 8w');
    expect(msg).toContain('peak 7/wk');
    expect(msg).toContain('new ');
    expect(msg).toContain('closed ');
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
    trend_8w: [],
    top_open: [blocker, issue('AL-2')],
    oldest_open: [blocker],
    release_blockers: [blocker],
  };

  const opts = {
    jiraBase,
    linkStyle: 'plain' as const,
    dashboardUrl: 'https://momus.example.com/reports/executive',
    thresholds,
  };

  it('renders a compact header with tone, C/M share and oldest age', () => {
    const msg = buildProductDigestMessage(health, opts);
    expect(msg).toContain('AL — Product Health');
    expect(msg).toContain('Open: 46 · 20 Critical/Major (43%) · oldest 409d');
    expect(msg).toContain('This week: +1 net (3 new / 2 closed)');
    expect(msg).toContain('Full report →');
  });

  it('drops the trimmed sections', () => {
    const msg = buildProductDigestMessage(health, opts);
    expect(msg).not.toContain('Oldest open:');
    expect(msg).not.toContain('Priority:');
    expect(msg).not.toContain('Trend 8w');
    expect(msg).not.toContain('Severity: Critical');
  });

  it('never lists the same issue twice across sections', () => {
    const msg = buildProductDigestMessage(health, opts);
    const occurrences = msg.split('\n').filter((l) => l.includes('AL-1 ')).length;
    expect(occurrences).toBe(1);
    // The non-blocker still shows under "Needs attention".
    expect(msg).toContain('AL-2');
  });

  it('caps the attention list', () => {
    const many = Array.from({ length: 8 }, (_, i) => issue(`AL-${i + 10}`));
    const msg = buildProductDigestMessage(
      { ...health, release_blockers: [], top_open: many },
      opts,
    );
    expect(msg).toContain('…and 3 more');
  });
});

describe('chunkDigest', () => {
  it('leaves a short message alone', () => {
    expect(chunkDigest('short')).toEqual(['short']);
  });

  it('splits on line boundaries when over the limit', () => {
    const text = ['aaaa', 'bbbb', 'cccc'].join('\n');
    const chunks = chunkDigest(text, 10);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 10)).toBe(true);
    expect(chunks.join('\n')).toBe(text);
  });
});
