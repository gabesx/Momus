import { round1 } from '../budget/status';
import type { AnalyticsIssueRow, AnalyticsMttrStats, AnalyticsResolutionResult } from './types';

const EMPTY_STATS: AnalyticsMttrStats = {
  resolved_count: 0,
  avg_hours: 0,
  median_hours: 0,
};

function severityKey(severity: string | null | undefined): string {
  const t = severity?.trim();
  return t ? t : 'Unknown';
}

/**
 * Hours from creation to resolution. Prefers the synced
 * `time_to_resolution_hours`; falls back to `resolved_date - created_date`
 * so rows missing the Jira field still count. Null when unusable.
 */
export function resolutionHours(row: AnalyticsIssueRow): number | null {
  const synced = row.time_to_resolution_hours;
  if (synced != null && synced > 0) return synced;
  if (row.resolved_date && row.created_date) {
    const ms = Date.parse(row.resolved_date) - Date.parse(row.created_date);
    if (Number.isFinite(ms) && ms > 0) return ms / 3_600_000;
  }
  return null;
}

/** Count, avg, and median (round1) of a duration series. Zeros when empty. */
export function summarizeDurations(values: number[]): {
  count: number;
  avg: number;
  median: number;
} {
  if (values.length === 0) return { count: 0, avg: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  return { count: sorted.length, avg: round1(avg), median: round1(median) };
}

function stats(hours: number[]): AnalyticsMttrStats {
  if (hours.length === 0) return { ...EMPTY_STATS };
  const { count, avg, median } = summarizeDurations(hours);
  return { resolved_count: count, avg_hours: avg, median_hours: median };
}

/** MTTR metrics for the filtered analytics row set (no MoM). */
export function computeAnalyticsResolution(
  rows: AnalyticsIssueRow[],
): Omit<AnalyticsResolutionResult, 'mom'> {
  const resolved = rows
    .filter((r) => !r.is_open)
    .map((r) => ({ row: r, hours: resolutionHours(r) }))
    .filter((e): e is { row: AnalyticsIssueRow; hours: number } => e.hours != null);

  const criticalMajor = resolved.filter(
    (e) => e.row.severity_issue === 'Critical' || e.row.severity_issue === 'Major',
  );
  const other = resolved.filter(
    (e) => !(e.row.severity_issue === 'Critical' || e.row.severity_issue === 'Major'),
  );

  const bySeverityHours = new Map<string, number[]>();
  for (const e of resolved) {
    const key = severityKey(e.row.severity_issue);
    const list = bySeverityHours.get(key) ?? [];
    list.push(e.hours);
    bySeverityHours.set(key, list);
  }
  const by_severity: Record<string, AnalyticsMttrStats> = {};
  for (const [key, hours] of bySeverityHours) {
    by_severity[key] = stats(hours);
  }

  return {
    overall: stats(resolved.map((e) => e.hours)),
    critical_major: stats(criticalMajor.map((e) => e.hours)),
    other: stats(other.map((e) => e.hours)),
    by_severity,
  };
}
