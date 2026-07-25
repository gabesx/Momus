import type { ExecutiveSummary } from './executive-summary';
import type { ProductHealth, ProductIssueRef } from './product-health';

/** How many products (by risk) get a dedicated message; tunable. */
export const DIGEST_TOP_PRODUCTS = 5;

export type DigestLinkStyle = 'slack' | 'plain';

export type DigestMessageOptions = {
  dateLabel?: string;
  /** Base like https://host/browse — issue links become `${jiraBase}/<key>`. */
  jiraBase?: string;
  /** Link to the full report page. */
  dashboardUrl?: string;
  linkStyle: DigestLinkStyle;
};

const BLOCKS = '▁▂▃▄▅▆▇█';
const SEV_ORDER = ['Critical', 'Major', 'Minor', 'Low'];
const PRIO_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

/** Unicode block sparkline for a small series. */
export function sparkline(values: number[]): string {
  if (values.length === 0) return '';
  const max = Math.max(...values);
  if (max <= 0) return BLOCKS[0]!.repeat(values.length);
  return values
    .map((v) => BLOCKS[Math.min(BLOCKS.length - 1, Math.round((v / max) * (BLOCKS.length - 1)))])
    .join('');
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

function orderedCounts(rec: Record<string, number>, order: string[]): string {
  const known = order.filter((k) => rec[k] != null).map((k) => `${k} ${rec[k]}`);
  const rest = Object.entries(rec)
    .filter(([k]) => !order.includes(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k} ${n}`);
  const all = [...known, ...rest];
  return all.length ? all.join(', ') : 'none';
}

/** Executive Summary message (message 1 of the weekly digest). */
export function buildExecutiveDigestMessage(
  s: ExecutiveSummary,
  opts: DigestMessageOptions,
): string {
  const lines: string[] = [];
  lines.push(`*📊 Momus Weekly QA Digest — ${opts.dateLabel ?? ''}*`.trim());
  lines.push('*Executive Summary*');
  lines.push(`• Total open bugs: ${s.total_open}`);
  lines.push(`• New this week: ${s.created_this_week} · Closed: ${s.resolved_this_week}`);
  lines.push(
    `• Backlog: ${s.backlog_prev} → ${s.backlog_now} (WoW ${s.net_this_week >= 0 ? '+' : ''}${s.net_this_week})`,
  );
  lines.push(`• Release-blocking (Highest+Critical): ${s.release_blocking_count}`);
  if (s.top_squad) lines.push(`• Riskiest squad: ${s.top_squad.key} (${s.top_squad.open} open)`);
  if (s.release_blockers.length) {
    lines.push('Release blockers:');
    for (const b of s.release_blockers) lines.push(issueLine(b, opts));
  }
  if (opts.dashboardUrl) lines.push(link(opts.dashboardUrl, 'Full report', opts.linkStyle));
  return lines.join('\n');
}

/** Per-product Product Health message. */
export function buildProductDigestMessage(
  h: ProductHealth,
  opts: DigestMessageOptions,
): string {
  const lines: string[] = [];
  lines.push(`*🏷️ ${h.product} — Product Health*`);
  lines.push(
    `• Open: ${h.open_total} · New ${h.this_week.created} / Closed ${h.this_week.resolved} this week`,
  );
  lines.push(`• Severity: ${orderedCounts(h.open_by_severity, SEV_ORDER)}`);
  lines.push(`• Priority: ${orderedCounts(h.open_by_priority, PRIO_ORDER)}`);
  lines.push(
    `• Trend 8w — created ${sparkline(h.trend_8w.map((p) => p.created))} · resolved ${sparkline(h.trend_8w.map((p) => p.resolved))}`,
  );
  if (h.release_blockers.length) {
    lines.push('Release-blocking:');
    for (const b of h.release_blockers) lines.push(issueLine(b, opts));
  }
  if (h.top_open.length) {
    lines.push('Top open (by severity):');
    for (const it of h.top_open) lines.push(issueLine(it, opts));
  }
  if (h.oldest_open.length) {
    lines.push('Oldest open:');
    for (const it of h.oldest_open) lines.push(issueLine(it, opts));
  }
  return lines.join('\n');
}
