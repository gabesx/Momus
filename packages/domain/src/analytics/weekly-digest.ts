import { round1 } from '../budget/status';
import { computeAnalyticsRisk } from './risk';
import type { AnalyticsDigestOptions } from './digest';
import type { AnalyticsIssueRow } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type WeeklyFlow = { created: number; resolved: number; net: number };

export type AnalyticsWeeklyDigest = {
  /** Last 7 days ending at nowIso. */
  this_week: WeeklyFlow;
  /** The 7 days before this_week. */
  prev_week: WeeklyFlow;
  /** Open issues now. */
  backlog_now: number;
  /** Open issues as of the start of this_week (7 days ago). */
  backlog_prev: number;
  /** Current-state snapshot (open only). */
  open_critical_major: number;
  open_long_overdue: number;
  /** Squads with the most issues created this week, worst first. */
  top_squads: Array<{ key: string; created: number }>;
  range: { from: string; to: string };
};

function nonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function inWindow(dateStr: string | null | undefined, fromMs: number, toMs: number): boolean {
  if (!dateStr) return false;
  const t = Date.parse(dateStr);
  return Number.isFinite(t) && t >= fromMs && t < toMs;
}

/** Open at instant T: created on/before T and not resolved by T. */
function openAt(row: AnalyticsIssueRow, tMs: number): boolean {
  if (!row.created_date) return false;
  const created = Date.parse(row.created_date);
  if (!Number.isFinite(created) || created > tMs) return false;
  if (row.is_open) return true;
  if (row.resolved_date) {
    const resolved = Date.parse(row.resolved_date);
    return Number.isFinite(resolved) && resolved > tMs;
  }
  return false; // closed with unknown resolution time — treat as not open
}

function flow(rows: AnalyticsIssueRow[], fromMs: number, toMs: number): WeeklyFlow {
  const created = rows.filter((r) => inWindow(r.created_date, fromMs, toMs)).length;
  const resolved = rows.filter((r) => !r.is_open && inWindow(r.resolved_date, fromMs, toMs)).length;
  return { created, resolved, net: created - resolved };
}

/** Rolling 7-day (this week) vs the prior 7 days, with a current-state snapshot. */
export function computeWeeklyDigest(
  rows: AnalyticsIssueRow[],
  nowIso: string,
): AnalyticsWeeklyDigest {
  const nowMs = Date.parse(nowIso);
  const thisFrom = nowMs - WEEK_MS;
  const prevFrom = nowMs - 2 * WEEK_MS;

  const this_week = flow(rows, thisFrom, nowMs);
  const prev_week = flow(rows, prevFrom, thisFrom);

  const backlog_now = rows.filter((r) => r.is_open).length;
  const backlog_prev = rows.filter((r) => openAt(r, thisFrom)).length;

  const risk = computeAnalyticsRisk(rows);

  const createdThisWeek = rows.filter((r) => inWindow(r.created_date, thisFrom, nowMs));
  const squadCounts = new Map<string, number>();
  for (const r of createdThisWeek) {
    const key = nonEmpty(r.real_project) ?? r.project;
    squadCounts.set(key, (squadCounts.get(key) ?? 0) + 1);
  }
  const top_squads = [...squadCounts.entries()]
    .map(([key, created]) => ({ key, created }))
    .sort((a, b) => b.created - a.created || a.key.localeCompare(b.key))
    .slice(0, 3);

  return {
    this_week,
    prev_week,
    backlog_now,
    backlog_prev,
    open_critical_major: risk.open_critical_major,
    open_long_overdue: risk.open_long_overdue,
    top_squads,
    range: { from: new Date(thisFrom).toISOString(), to: nowIso },
  };
}

/** Week-over-week suffix, e.g. " (↑ +11% WoW)". Empty when both are zero. */
function wow(cur: number, prev: number): string {
  if (cur === 0 && prev === 0) return '';
  if (prev === 0) return ' (↑ new)';
  const pct = round1(((cur - prev) / prev) * 100);
  if (pct === 0) return ' (→ 0% WoW)';
  return ` (${pct > 0 ? '↑ +' : '↓ '}${pct}% WoW)`;
}

/** Weekly digest text (Slack mrkdwn / plain per linkStyle). */
export function buildWeeklyDigest(
  data: AnalyticsWeeklyDigest,
  options: AnalyticsDigestOptions,
): string {
  const { this_week: t, prev_week: p } = data;
  const lines: string[] = [];

  lines.push(`*Momus weekly defect digest — ${options.dateLabel}*`);
  lines.push('_Last 7 days vs previous 7 days_');
  lines.push(`• Created: ${t.created}${wow(t.created, p.created)}`);
  lines.push(`• Resolved: ${t.resolved}${wow(t.resolved, p.resolved)}`);
  lines.push(
    `• Net this week: ${t.net >= 0 ? '+' : ''}${t.net} — backlog ${data.backlog_prev} → ${data.backlog_now}`,
  );
  lines.push(
    `• Open now: ${data.backlog_now} total · ${data.open_critical_major} Critical/Major · ` +
      `${data.open_long_overdue} long overdue`,
  );
  if (data.top_squads.length) {
    lines.push(
      `• Top squads (created this week): ${data.top_squads
        .map((s) => `${s.key} (${s.created})`)
        .join(', ')}`,
    );
  }

  if (options.dashboardUrl) {
    lines.push(
      options.linkStyle === 'plain'
        ? `Open the dashboard: ${options.dashboardUrl}`
        : `<${options.dashboardUrl}|Open the dashboard>`,
    );
  }

  return lines.join('\n');
}
