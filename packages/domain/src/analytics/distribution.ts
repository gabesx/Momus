import { round1 } from '../budget/status';
import type {
  AnalyticsDistributionEntry,
  AnalyticsDistributionResult,
  AnalyticsIssueRow,
} from './types';

function nonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = v?.trim();
    if (t) return t;
  }
  return null;
}

function groupBy(
  rows: AnalyticsIssueRow[],
  keyOf: (row: AnalyticsIssueRow) => string,
): AnalyticsDistributionEntry[] {
  const map = new Map<string, AnalyticsDistributionEntry>();
  for (const r of rows) {
    const key = keyOf(r);
    const entry = map.get(key) ?? { key, total: 0, open: 0, open_critical_major: 0 };
    entry.total += 1;
    if (r.is_open) {
      entry.open += 1;
      if (r.severity_issue === 'Critical' || r.severity_issue === 'Major') {
        entry.open_critical_major += 1;
      }
    }
    map.set(key, entry);
  }
  return [...map.values()];
}

function byTotalDesc(a: AnalyticsDistributionEntry, b: AnalyticsDistributionEntry): number {
  return b.total - a.total || a.key.localeCompare(b.key);
}

function byOpenDesc(a: AnalyticsDistributionEntry, b: AnalyticsDistributionEntry): number {
  return b.open - a.open || b.total - a.total || a.key.localeCompare(b.key);
}

/** Where defects concentrate: squad, service/feature, engineer workload, traceability. */
export function computeAnalyticsDistribution(
  rows: AnalyticsIssueRow[],
): AnalyticsDistributionResult {
  const by_squad = groupBy(rows, (r) => nonEmpty(r.real_project) ?? r.project).sort(byTotalDesc);
  const by_service = groupBy(
    rows,
    (r) => nonEmpty(r.service_feature_final, r.service_feature) ?? 'Unspecified',
  ).sort(byTotalDesc);
  const by_engineer = groupBy(
    rows,
    (r) => nonEmpty(r.engineer_assignee, r.test_engineer_assignee) ?? 'Unassigned',
  ).sort(byOpenDesc);

  const total = rows.length;
  const linked = rows.filter((r) => r.has_linked_test_execution === true).length;

  return {
    by_squad,
    by_service,
    by_engineer,
    traceability: {
      linked,
      total,
      pct: total > 0 ? round1((linked / total) * 100) : 0,
    },
  };
}
