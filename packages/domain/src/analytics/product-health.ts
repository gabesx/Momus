import { isReleaseBlocking } from './executive-summary';
import { computeWeeklyDigest } from './weekly-digest';
import type { AnalyticsIssueRow } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const SEVERITY_RANK = ['Critical', 'Major', 'Minor', 'Low'];

function nonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function squadKey(r: AnalyticsIssueRow): string {
  return nonEmpty(r.real_project) ?? r.project;
}

function inWindow(dateStr: string | null | undefined, fromMs: number, toMs: number): boolean {
  if (!dateStr) return false;
  const t = Date.parse(dateStr);
  return Number.isFinite(t) && t >= fromMs && t < toMs;
}

function severityRank(sev: string | null | undefined): number {
  const i = SEVERITY_RANK.indexOf((sev ?? '').trim());
  return i === -1 ? SEVERITY_RANK.length : i;
}

export type ProductIssueRef = {
  jira_key: string | null;
  summary: string | null;
  severity: string | null;
  priority: string | null;
  assignee: string | null;
  reporter: string | null;
  age_days: number | null;
};

function toRef(r: AnalyticsIssueRow): ProductIssueRef {
  return {
    jira_key: r.jira_key ?? null,
    summary: r.summary ?? null,
    severity: r.severity_issue ?? null,
    priority: r.priority ?? null,
    assignee: nonEmpty(r.assignee_final, r.engineer_assignee),
    reporter: r.reporter ?? null,
    age_days: r.defect_age_days ?? null,
  };
}

export type WeeklyPoint = { week_start: string; created: number; resolved: number };

export type ProductHealth = {
  product: string;
  open_total: number;
  open_by_severity: Record<string, number>;
  open_by_priority: Record<string, number>;
  this_week: { created: number; resolved: number; net: number };
  backlog_now: number;
  trend_8w: WeeklyPoint[];
  top_open: ProductIssueRef[];
  oldest_open: ProductIssueRef[];
  release_blockers: ProductIssueRef[];
};

/** Distinct products (real_project ?? project) ordered by open Critical/Major desc. */
export function listProductsByRisk(rows: AnalyticsIssueRow[]): string[] {
  const cm = new Map<string, number>();
  const seen = new Set<string>();
  for (const r of rows) {
    const key = squadKey(r);
    seen.add(key);
    if (r.is_open && (r.severity_issue === 'Critical' || r.severity_issue === 'Major')) {
      cm.set(key, (cm.get(key) ?? 0) + 1);
    }
  }
  return [...seen].sort(
    (a, b) => (cm.get(b) ?? 0) - (cm.get(a) ?? 0) || a.localeCompare(b),
  );
}

/**
 * Whether a product has anything worth a digest message: open bugs or
 * created/resolved activity this week. Keeps quiet products out of the send.
 */
export function hasDigestContent(h: ProductHealth): boolean {
  return h.open_total > 0 || h.this_week.created > 0 || h.this_week.resolved > 0;
}

/** Weekly created/resolved series for the last `weeks` rolling 7-day windows (oldest first). */
export function weeklySeries(
  rows: AnalyticsIssueRow[],
  nowIso: string,
  weeks = 8,
): WeeklyPoint[] {
  const nowMs = Date.parse(nowIso);
  const out: WeeklyPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const to = nowMs - i * WEEK_MS;
    const from = to - WEEK_MS;
    const created = rows.filter((r) => inWindow(r.created_date, from, to)).length;
    const resolved = rows.filter(
      (r) => !r.is_open && inWindow(r.resolved_date, from, to),
    ).length;
    out.push({ week_start: new Date(from).toISOString().slice(0, 10), created, resolved });
  }
  return out;
}

function countBy(
  rows: AnalyticsIssueRow[],
  keyOf: (r: AnalyticsIssueRow) => string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[keyOf(r)] = (out[keyOf(r)] ?? 0) + 1;
  return out;
}

/** Full Product Health block for a single product. */
export function computeProductHealth(
  allRows: AnalyticsIssueRow[],
  product: string,
  nowIso: string,
  topN = 10,
): ProductHealth {
  const rows = allRows.filter((r) => squadKey(r) === product);
  const open = rows.filter((r) => r.is_open);
  const weekly = computeWeeklyDigest(rows, nowIso);

  const byAgeDesc = (a: AnalyticsIssueRow, b: AnalyticsIssueRow) =>
    (b.defect_age_days ?? 0) - (a.defect_age_days ?? 0);

  const top_open = [...open]
    .sort((a, b) => severityRank(a.severity_issue) - severityRank(b.severity_issue) || byAgeDesc(a, b))
    .slice(0, topN)
    .map(toRef);

  const oldest_open = [...open].sort(byAgeDesc).slice(0, topN).map(toRef);

  const release_blockers = rows
    .filter(isReleaseBlocking)
    .sort(byAgeDesc)
    .map(toRef);

  return {
    product,
    open_total: open.length,
    open_by_severity: countBy(open, (r) => nonEmpty(r.severity_issue) ?? 'Unspecified'),
    open_by_priority: countBy(open, (r) => nonEmpty(r.priority) ?? 'No priority'),
    this_week: weekly.this_week,
    backlog_now: weekly.backlog_now,
    trend_8w: weeklySeries(rows, nowIso),
    top_open,
    oldest_open,
    release_blockers,
  };
}
