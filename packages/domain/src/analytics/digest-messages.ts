import { ANALYTICS_KPI_THRESHOLDS } from './types';
import type { ExecutiveSummary } from './executive-summary';
import type { ProductHealth, ProductIssueRef, WeeklyPoint } from './product-health';

export type DigestLinkStyle = 'slack' | 'plain';

/** The three KPI thresholds that map onto data the digest already loads. */
export type DigestThresholds = {
  open_warning: number;
  open_critical_major_pct_warning: number;
  resolution_rate_healthy_pct: number;
};

export type DigestMessageOptions = {
  /** Human week range, e.g. "11–17 Aug 2026". */
  dateLabel?: string;
  /** Base like https://host/browse — issue links become `${jiraBase}/<key>`. */
  jiraBase?: string;
  /** Link to the full report page. */
  dashboardUrl?: string;
  linkStyle: DigestLinkStyle;
  /** Defaults to ANALYTICS_KPI_THRESHOLDS when omitted. */
  thresholds?: DigestThresholds;
};

const BLOCKS = '▁▂▃▄▅▆▇█';

/** Chat webhooks cap a single message; Google Chat is the tighter of the two. */
export const DIGEST_MAX_CHARS = 4096;

/** Issue lines shown per section before spilling to "+N more". */
export const DIGEST_SECTION_CAP = 5;

function defaultThresholds(opts: DigestMessageOptions): DigestThresholds {
  return opts.thresholds ?? ANALYTICS_KPI_THRESHOLDS;
}

/**
 * Unicode block sparkline. Pass a shared `max` (see `sparklinePair`) when two
 * series must be visually comparable — normalising each to its own max makes
 * "3 per week" and "300 per week" render identically.
 */
export function sparkline(values: number[], opts: { max?: number } = {}): string {
  if (values.length === 0) return '';
  const max = opts.max ?? Math.max(...values);
  if (max <= 0) return BLOCKS[0]!.repeat(values.length);
  // A flat non-zero series is *stable*; rendering it full-height reads as a
  // crisis. Only meaningful when the scale is this series' own max.
  if (opts.max == null && Math.min(...values) === max) return BLOCKS[3]!.repeat(values.length);
  return values
    .map((v) => BLOCKS[Math.min(BLOCKS.length - 1, Math.round((v / max) * (BLOCKS.length - 1)))])
    .join('');
}

/** Two series rendered on one shared scale, plus the peak for labelling. */
export function sparklinePair(
  a: number[],
  b: number[],
): { a: string; b: string; max: number } {
  const max = Math.max(0, ...a, ...b);
  return { a: sparkline(a, { max }), b: sparkline(b, { max }), max };
}

function link(url: string, label: string, style: DigestLinkStyle): string {
  return style === 'plain' ? `${label} ${url}` : `<${url}|${label}>`;
}

function issueUrl(base: string | undefined, key: string | null): string | null {
  if (!base || !key) return null;
  return `${base.replace(/\/$/, '')}/${key}`;
}

function truncate(s: string | null, n = 60): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** "• <KEY> — summary (Critical/Highest, 409d, Dewi)" (link style per provider). */
export function issueLine(it: ProductIssueRef, opts: DigestMessageOptions): string {
  const url = issueUrl(opts.jiraBase, it.jira_key);
  const key = it.jira_key ?? '—';
  const head = url ? link(url, key, opts.linkStyle) : key;
  const meta = [
    [it.severity, it.priority].filter(Boolean).join('/'),
    it.age_days != null ? `${it.age_days}d` : null,
    it.assignee ?? 'unassigned',
  ]
    .filter(Boolean)
    .join(', ');
  const summary = truncate(it.summary);
  return `• ${head}${summary ? ` — ${summary}` : ''}${meta ? ` (${meta})` : ''}`;
}

/** Capped issue section: heading, up to `cap` lines, then a "+N more" tail. */
function issueSection(
  heading: string,
  items: ProductIssueRef[],
  opts: DigestMessageOptions,
  cap = DIGEST_SECTION_CAP,
): string[] {
  if (items.length === 0) return [];
  const lines = [heading];
  for (const it of items.slice(0, cap)) lines.push(issueLine(it, opts));
  const rest = items.length - cap;
  if (rest > 0) lines.push(`…and ${rest} more`);
  return lines;
}

export type Tone = 'red' | 'amber' | 'green';

export function toneEmoji(tone: Tone): string {
  return tone === 'red' ? '🔴' : tone === 'amber' ? '🟠' : '🟢';
}

function toneFromBreaches(breaches: number, forceRed: boolean): Tone {
  if (forceRed || breaches >= 2) return 'red';
  return breaches === 1 ? 'amber' : 'green';
}

/** Open Critical+Major count and its share of the product's open bugs. */
export function criticalMajor(h: ProductHealth): { count: number; pct: number } {
  const count = (h.open_by_severity.Critical ?? 0) + (h.open_by_severity.Major ?? 0);
  const pct = h.open_total > 0 ? Math.round((count / h.open_total) * 100) : 0;
  return { count, pct };
}

/**
 * True when the week's closing rate lagged the healthy threshold. A week with
 * nothing created is *quiet*, not failing — scoring it 0% would flag every
 * idle product.
 */
function closingTooSlowly(created: number, resolved: number, healthyPct: number): boolean {
  if (created <= 0) return false;
  return (resolved / created) * 100 < healthyPct;
}

/**
 * Traffic light for a product: how many of the configured thresholds it
 * breaches. A catastrophic Critical/Major share forces red on its own so it
 * cannot be diluted by two healthy signals.
 */
export function productTone(h: ProductHealth, t: DigestThresholds): Tone {
  // Nothing open means nothing to act on, whatever the week's flow looked like.
  if (h.open_total === 0) return 'green';
  const { pct } = criticalMajor(h);
  const breaches = [
    pct >= t.open_critical_major_pct_warning,
    closingTooSlowly(h.this_week.created, h.this_week.resolved, t.resolution_rate_healthy_pct),
    h.this_week.net > 0,
  ].filter(Boolean).length;
  return toneFromBreaches(breaches, pct >= t.open_critical_major_pct_warning * 2);
}

/** Traffic light for the org header, using the same rules plus total volume. */
export function orgTone(s: ExecutiveSummary, cmPct: number, t: DigestThresholds): Tone {
  if (s.total_open === 0) return 'green';
  const breaches = [
    s.total_open >= t.open_warning,
    cmPct >= t.open_critical_major_pct_warning,
    closingTooSlowly(s.created_this_week, s.resolved_this_week, t.resolution_rate_healthy_pct),
    s.net_this_week > 0,
  ].filter(Boolean).length;
  return toneFromBreaches(breaches, cmPct >= t.open_critical_major_pct_warning * 2);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dayMonth(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "11–17 Aug 2026" — the week the digest covers, so "this week" is concrete. */
export function weekRangeLabel(nowIso: string): string {
  const end = new Date(nowIso);
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const left = sameMonth ? String(start.getUTCDate()) : dayMonth(start);
  return `${left}–${dayMonth(end)} ${end.getUTCFullYear()}`;
}

/** "2 Jun – 17 Aug" — the span a trend series covers. */
export function seriesRangeLabel(points: WeeklyPoint[], nowIso: string): string {
  const first = points[0]?.week_start;
  if (!first) return '';
  return `${dayMonth(new Date(first))} – ${dayMonth(new Date(nowIso))}`;
}

/** Executive Summary message (message 1 of the weekly digest). */
export function buildExecutiveDigestMessage(
  s: ExecutiveSummary,
  opts: DigestMessageOptions & { flow?: WeeklyPoint[]; criticalMajorPct?: number },
): string {
  const t = defaultThresholds(opts);
  const cmPct = opts.criticalMajorPct ?? 0;
  const lines: string[] = [];

  lines.push(`*📊 Momus Weekly QA Digest — ${opts.dateLabel ?? ''}*`.trim());

  // `total_open` and `backlog_now` are the same value, so state it once and let
  // the backlog delta carry the movement.
  const net = `${s.net_this_week >= 0 ? '+' : ''}${s.net_this_week}`;
  lines.push(
    `${toneEmoji(orgTone(s, cmPct, t))} *${s.total_open} open* · ${net} net (${s.created_this_week} new / ${s.resolved_this_week} closed) · ${s.release_blocking_count} release-blocking`,
  );
  lines.push(`• Backlog: ${s.backlog_prev} → ${s.backlog_now}`);

  if (opts.flow?.length) {
    const flow = sparklinePair(
      opts.flow.map((p) => p.created),
      opts.flow.map((p) => p.resolved),
    );
    const range = seriesRangeLabel(opts.flow, new Date().toISOString());
    const scale = `${range ? `${range}, ` : ''}peak ${flow.max}/wk`;
    lines.push(`• Flow 8w (${scale}) — new ${flow.a} · closed ${flow.b}`);
  }

  if (s.top_squad) lines.push(`• Riskiest squad: ${s.top_squad.key} (${s.top_squad.open} open)`);

  lines.push(...issueSection('🚨 Release blockers (Highest+Critical):', s.release_blockers, opts));

  if (opts.dashboardUrl) lines.push(link(opts.dashboardUrl, 'Full report →', opts.linkStyle));
  return lines.join('\n');
}

/**
 * Per-product Product Health message. "Oldest open" is deliberately a scalar
 * rather than a list: as a list it duplicated entries already shown under top
 * open, since that list is sorted by severity *then* age.
 */
export function buildProductDigestMessage(
  h: ProductHealth,
  opts: DigestMessageOptions,
): string {
  const t = defaultThresholds(opts);
  const { count, pct } = criticalMajor(h);
  const lines: string[] = [];

  lines.push(`${toneEmoji(productTone(h, t))} *${h.product} — Product Health*`);

  const oldest = h.oldest_open[0]?.age_days;
  lines.push(
    `• Open: ${h.open_total} · ${count} Critical/Major (${pct}%)${oldest != null ? ` · oldest ${oldest}d` : ''}`,
  );
  const net = `${h.this_week.net >= 0 ? '+' : ''}${h.this_week.net}`;
  lines.push(
    `• This week: ${net} net (${h.this_week.created} new / ${h.this_week.resolved} closed)`,
  );

  lines.push(...issueSection('🚨 Release-blocking:', h.release_blockers, opts));

  // Anything already listed as a blocker must not repeat below.
  const shown = new Set(
    h.release_blockers.map((b) => b.jira_key).filter((k): k is string => !!k),
  );
  const attention = h.top_open.filter((it) => !it.jira_key || !shown.has(it.jira_key));
  lines.push(...issueSection('Needs attention:', attention, opts));

  if (opts.dashboardUrl) lines.push(link(opts.dashboardUrl, 'Full report →', opts.linkStyle));
  return lines.join('\n');
}

/**
 * Split an over-long message on section boundaries. A safety net for the
 * provider character cap — with the caps above it should never fire.
 */
export function chunkDigest(text: string, limit = DIGEST_MAX_CHARS): string[] {
  if (text.length <= limit) return [text];
  const out: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > limit && current) {
      out.push(current);
      current = line;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}
