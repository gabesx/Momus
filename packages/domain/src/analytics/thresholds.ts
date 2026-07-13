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

export function longOverduePctTone(
  pct: number,
  threshold = ANALYTICS_KPI_THRESHOLDS.open_long_overdue_pct_warning,
): KpiTone {
  if (pct >= threshold) return 'danger';
  if (pct >= threshold * 0.7) return 'warning';
  return 'ok';
}
