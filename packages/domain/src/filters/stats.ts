import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { round1 } from '../budget/status';
import type { FilterableIssue } from '../filters/parse';

export type StatsResult = {
  total: number;
  open: number;
  closed: number;
  open_rate: number;
  severity_total: number;
  bugs: number;
  defects: number;
  open_critical: number;
  open_critical_major: number;
  open_high_priority: number;
  recent: number;
  avg_age: number;
  severity_breakdown: Record<
    string,
    {
      total: number;
      high_priority: number;
      medium_priority: number;
      low_priority: number;
      ac_related: number;
      non_ac_related: number;
    }
  >;
};

function isBug(issueType: string | null | undefined): boolean {
  return (BUG_GROUP_TYPES as readonly string[]).includes(issueType ?? '');
}

function isDefect(issueType: string | null | undefined): boolean {
  return (DEFECT_GROUP_TYPES as readonly string[]).includes(issueType ?? '');
}

function isAcRelated(labels: string[] | null | undefined): boolean {
  return (labels ?? []).some((l) => l.toLowerCase().includes('ac-related') && !l.toLowerCase().includes('non-ac'));
}

function isNonAcRelated(labels: string[] | null | undefined): boolean {
  return (labels ?? []).some((l) => l.toLowerCase().includes('non-ac-related'));
}

/** BB-API-04: aggregate stats for the current filtered row set. */
export function computeStats(
  rows: Array<
    FilterableIssue & {
      created_date?: string | null;
      ac_related_labels?: string[] | null;
    }
  >,
  nowIso: string,
): StatsResult {
  const total = rows.length;
  const open = rows.filter((r) => r.is_open).length;
  const closed = total - open;
  const open_rate = total > 0 ? round1((open / total) * 100) : 0;

  const now = new Date(nowIso).getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  const ages = rows.map((r) => r.defect_age_days ?? 0).filter((a) => a > 0);
  const avg_age = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

  const severity_breakdown: StatsResult['severity_breakdown'] = {};
  for (const row of rows) {
    const sev = row.severity_issue ?? 'Unknown';
    const bucket = (severity_breakdown[sev] ??= {
      total: 0,
      high_priority: 0,
      medium_priority: 0,
      low_priority: 0,
      ac_related: 0,
      non_ac_related: 0,
    });
    bucket.total += 1;
    const p = (row.priority ?? '').toLowerCase();
    if (p === 'highest' || p === 'high') bucket.high_priority += 1;
    else if (p === 'medium') bucket.medium_priority += 1;
    else if (p === 'low' || p === 'lowest') bucket.low_priority += 1;
    if (isAcRelated(row.ac_related_labels)) bucket.ac_related += 1;
    if (isNonAcRelated(row.ac_related_labels)) bucket.non_ac_related += 1;
  }

  return {
    total,
    open,
    closed,
    open_rate,
    severity_total: rows.filter((r) => r.severity_issue).length,
    bugs: rows.filter((r) => isBug(r.issue_type)).length,
    defects: rows.filter((r) => isDefect(r.issue_type)).length,
    open_critical: rows.filter((r) => r.is_open && r.severity_issue === 'Critical').length,
    open_critical_major: rows.filter(
      (r) => r.is_open && (r.severity_issue === 'Critical' || r.severity_issue === 'Major'),
    ).length,
    open_high_priority: rows.filter(
      (r) =>
        r.is_open &&
        (r.priority === 'Highest' || r.priority === 'High'),
    ).length,
    recent: rows.filter((r) => {
      if (!r.created_date) return false;
      return now - new Date(r.created_date).getTime() <= thirtyDaysMs;
    }).length,
    avg_age,
    severity_breakdown,
  };
}
