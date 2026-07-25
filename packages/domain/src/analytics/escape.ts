import { round1 } from '../budget/status';
import { issueTypeOf } from './filter';
import type {
  AnalyticsEscapeMode,
  AnalyticsEscapeResult,
  AnalyticsIssueRow,
} from './types';

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

/** True when the row's issue type is one of the configured escape types. */
export function isEscapeIssueType(
  row: AnalyticsIssueRow,
  prodIssueTypes: readonly string[],
): boolean {
  const wanted = new Set(prodIssueTypes.map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return false;
  return wanted.has(issueTypeOf(row).trim().toLowerCase());
}

export type EscapeConfig = {
  mode?: AnalyticsEscapeMode;
  prodLabels?: readonly string[];
  prodIssueTypes?: readonly string[];
};

/**
 * Defect escape rate: share of issues in scope found in production — detected by
 * Jira label ('labels' mode) or by issue type ('issue_type' mode).
 */
export function computeAnalyticsEscape(
  rows: AnalyticsIssueRow[],
  config: EscapeConfig = {},
): AnalyticsEscapeResult {
  const mode: AnalyticsEscapeMode = config.mode ?? 'labels';
  const total = rows.length;

  let prod: number;
  let signals: string[];
  if (mode === 'issue_type') {
    const types = config.prodIssueTypes ?? [];
    prod = rows.filter((r) => isEscapeIssueType(r, types)).length;
    signals = [...types];
  } else {
    const labels = config.prodLabels ?? DEFAULT_PROD_LABELS;
    prod = rows.filter((r) => isFoundInProd(r, labels)).length;
    signals = [...labels];
  }

  return {
    prod,
    total,
    pct: total > 0 ? round1((prod / total) * 100) : 0,
    labels_used: signals,
    mode,
  };
}
