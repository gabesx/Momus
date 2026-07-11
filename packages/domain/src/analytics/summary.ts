import { round1 } from '../budget/status';
import { monthKeyFromIso } from './filter';
import type { AnalyticsIssueRow, AnalyticsSummaryMetrics, AnalyticsSummaryResult } from './types';

function metrics(rows: AnalyticsIssueRow[]): AnalyticsSummaryMetrics {
  const total = rows.length;
  const open = rows.filter((r) => r.is_open).length;
  const resolved = total - open;
  const resolution_rate = total > 0 ? round1((resolved / total) * 100) : 0;
  const ages = rows.map((r) => r.defect_age_days ?? 0).filter((a) => a > 0);
  const avg_age = ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
  return { total, open, resolved, resolution_rate, avg_age };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

export function computeAnalyticsSummary(
  rows: AnalyticsIssueRow[],
  nowIso: string,
): AnalyticsSummaryResult {
  const base = metrics(rows);
  const curKey = monthKeyFromIso(nowIso);
  const { y, m } = (() => {
    const [yy, mm] = curKey.split('-').map(Number);
    const d = new Date(Date.UTC(yy, mm - 2, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  })();
  const prevKey = `${y}-${String(m).padStart(2, '0')}`;

  const curRows = rows.filter((r) => r.created_date && monthKeyFromIso(r.created_date) === curKey);
  const prevRows = rows.filter((r) => r.created_date && monthKeyFromIso(r.created_date) === prevKey);
  const cur = metrics(curRows);
  const prev = metrics(prevRows);

  return {
    ...base,
    mom: {
      total: pctChange(cur.total, prev.total),
      open: pctChange(cur.open, prev.open),
      resolved: pctChange(cur.resolved, prev.resolved),
      resolution_rate: pctChange(cur.resolution_rate, prev.resolution_rate),
      avg_age: pctChange(cur.avg_age, prev.avg_age),
    },
  };
}
