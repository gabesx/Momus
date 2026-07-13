import { ANALYTICS_KPI_THRESHOLDS } from './types';

export type KpiTone = 'ok' | 'warning' | 'danger' | 'neutral';

export function openIssuesTone(
  open: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.open_warning,
): KpiTone {
  if (open >= threshold) return 'danger';
  if (open >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function avgAgeTone(
  avgAge: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.avg_age_warning_days,
): KpiTone {
  if (avgAge >= threshold) return 'danger';
  if (avgAge >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function resolutionRateTone(
  rate: number,
  healthy = ANALYTICS_KPI_THRESHOLDS.resolution_rate_healthy_pct,
): KpiTone {
  if (rate >= healthy) return 'ok';
  if (rate >= healthy - 15) return 'warning';
  return 'danger';
}

export function criticalMajorPctTone(
  pct: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.open_critical_major_pct_warning,
): KpiTone {
  if (pct >= threshold) return 'danger';
  if (pct >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function slaComplianceTone(
  pct: number | null,
  healthy = ANALYTICS_KPI_THRESHOLDS.sla_compliance_healthy_pct,
): KpiTone {
  if (pct === null) return 'neutral';
  if (pct >= healthy) return 'ok';
  if (pct >= healthy - 15) return 'warning';
  return 'danger';
}

export function firstResponseTone(
  avgDays: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.sla_first_response_days,
): KpiTone {
  if (avgDays >= threshold) return 'danger';
  if (avgDays >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function mttrCriticalMajorTone(
  avgHours: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.mttr_critical_major_warning_hours,
): KpiTone {
  if (avgHours >= threshold) return 'danger';
  if (avgHours >= threshold * 0.7) return 'warning';
  return 'ok';
}

export function longOverduePctTone(
  pct: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning,
): KpiTone {
  if (pct >= threshold) return 'danger';
  if (pct >= threshold * 0.7) return 'warning';
  return 'ok';
}
