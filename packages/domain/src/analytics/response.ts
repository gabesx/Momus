import { round1 } from '../budget/status';
import { resolutionHours, summarizeDurations } from './resolution';
import { ANALYTICS_KPI_THRESHOLDS } from './types';
import type {
  AnalyticsIssueRow,
  AnalyticsResponseResult,
  AnalyticsSlaCompliance,
  AnalyticsSlaSettings,
} from './types';

/**
 * Days from creation to first response. Prefers the synced
 * `first_response_age_days`; falls back to
 * `chart_date_first_response - created_date` (the sync only fills the
 * latter). Null when the issue was never responded to.
 */
export function firstResponseDays(row: AnalyticsIssueRow): number | null {
  const synced = row.first_response_age_days;
  if (synced != null && synced >= 0) return synced;
  if (row.chart_date_first_response && row.created_date) {
    const ms = Date.parse(row.chart_date_first_response) - Date.parse(row.created_date);
    if (Number.isFinite(ms) && ms >= 0) return round1(ms / 86_400_000);
  }
  return null;
}

function compliance(daysValues: number[], thresholdDays: number): AnalyticsSlaCompliance {
  const eligible = daysValues.length;
  const within = daysValues.filter((d) => d <= thresholdDays).length;
  return {
    pct: eligible > 0 ? round1((within / eligible) * 100) : null,
    within,
    eligible,
    threshold_days: thresholdDays,
  };
}

/**
 * First-response speed and SLA compliance for the filtered row set.
 * Response SLA is measured over issues that got a response; issues still
 * waiting are surfaced separately as `open_untouched` so silence can't
 * inflate compliance.
 */
export function computeAnalyticsResponse(
  rows: AnalyticsIssueRow[],
  thresholds: AnalyticsSlaSettings = ANALYTICS_KPI_THRESHOLDS,
): AnalyticsResponseResult {
  const responded = rows
    .map(firstResponseDays)
    .filter((d): d is number => d != null);
  const { count, avg, median } = summarizeDurations(responded);
  const open_untouched = rows.filter(
    (r) => r.is_open && firstResponseDays(r) == null,
  ).length;

  const resolutionDaysBySeverity = (severity: string): number[] =>
    rows
      .filter((r) => !r.is_open && r.severity_issue === severity)
      .map(resolutionHours)
      .filter((h): h is number => h != null)
      .map((h) => h / 24);

  return {
    responded_count: count,
    avg_days: avg,
    median_days: median,
    open_untouched,
    sla_first_response: compliance(responded, thresholds.sla_first_response_days),
    sla_critical_resolution: compliance(
      resolutionDaysBySeverity('Critical'),
      thresholds.sla_critical_resolution_days,
    ),
    sla_major_resolution: compliance(
      resolutionDaysBySeverity('Major'),
      thresholds.sla_major_resolution_days,
    ),
  };
}
