import { defectAgeBucket } from '../age/business-days';
import { round1 } from '../budget/status';
import type { AnalyticsAgeBuckets, AnalyticsIssueRow, AnalyticsRiskResult } from './types';

const EMPTY_BUCKETS: AnalyticsAgeBuckets = {
  fresh: 0,
  aging: 0,
  stale: 0,
  long_overdue: 0,
};

function severityKey(severity: string | null | undefined): string {
  const t = severity?.trim();
  return t ? t : 'Unknown';
}

/** Open-only risk metrics for the filtered analytics row set (no MoM). */
export function computeAnalyticsRisk(rows: AnalyticsIssueRow[]): Omit<AnalyticsRiskResult, 'mom'> {
  const open = rows.filter((r) => r.is_open);
  const openCount = open.length;

  const open_critical = open.filter((r) => r.severity_issue === 'Critical').length;
  const open_major = open.filter((r) => r.severity_issue === 'Major').length;
  const open_critical_major = open_critical + open_major;

  const open_age_buckets: AnalyticsAgeBuckets = { ...EMPTY_BUCKETS };
  for (const r of open) {
    const days = r.defect_age_days;
    if (days == null || days <= 0) continue;
    const bucket = defectAgeBucket(days);
    if (bucket === 'long overdue') open_age_buckets.long_overdue += 1;
    else open_age_buckets[bucket] += 1;
  }

  const open_long_overdue = open_age_buckets.long_overdue;
  const open_severity: Record<string, number> = {};
  for (const r of open) {
    const key = severityKey(r.severity_issue);
    open_severity[key] = (open_severity[key] ?? 0) + 1;
  }

  return {
    open_critical,
    open_major,
    open_critical_major,
    open_critical_major_pct_of_open:
      openCount === 0 ? 0 : round1((open_critical_major / openCount) * 100),
    open_long_overdue,
    open_long_overdue_pct_of_open:
      openCount === 0 ? 0 : round1((open_long_overdue / openCount) * 100),
    open_age_buckets,
    open_severity,
  };
}
