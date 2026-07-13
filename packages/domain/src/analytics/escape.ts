import { round1 } from '../budget/status';
import type { AnalyticsEscapeResult, AnalyticsIssueRow } from './types';

/**
 * Label convention marking an issue as found in production. Overridable via
 * analytics settings (bug_budget_config.analytics_settings.prod_labels).
 */
export const DEFAULT_PROD_LABELS: readonly string[] = ['found-in-prod'];

export function isFoundInProd(
  row: AnalyticsIssueRow,
  prodLabels: readonly string[] = DEFAULT_PROD_LABELS,
): boolean {
  if (!Array.isArray(row.labels) || prodLabels.length === 0) return false;
  const wanted = new Set(prodLabels.map((l) => l.trim().toLowerCase()).filter(Boolean));
  return row.labels.some(
    (label) => typeof label === 'string' && wanted.has(label.trim().toLowerCase()),
  );
}

/** Defect escape rate: share of issues in scope labeled as found in production. */
export function computeAnalyticsEscape(
  rows: AnalyticsIssueRow[],
  prodLabels: readonly string[] = DEFAULT_PROD_LABELS,
): AnalyticsEscapeResult {
  const total = rows.length;
  const prod = rows.filter((r) => isFoundInProd(r, prodLabels)).length;
  return {
    prod,
    total,
    pct: total > 0 ? round1((prod / total) * 100) : 0,
    labels_used: [...prodLabels],
  };
}
