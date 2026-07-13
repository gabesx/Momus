import { round1 } from '../budget/status';
import { monthKeyFromIso } from './filter';
import { computeAnalyticsDistribution } from './distribution';
import { computeAnalyticsEscape } from './escape';
import { computeAnalyticsResolution } from './resolution';
import { computeAnalyticsResponse } from './response';
import { computeAnalyticsRisk } from './risk';
import type {
  AnalyticsIssueRow,
  AnalyticsSummaryMetrics,
  AnalyticsSummaryOptions,
  AnalyticsSummaryResult,
} from './types';

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
  options: AnalyticsSummaryOptions = {},
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
  const baseRisk = computeAnalyticsRisk(rows);
  const curRisk = computeAnalyticsRisk(curRows);
  const prevRisk = computeAnalyticsRisk(prevRows);

  // MTTR MoM compares issues by the month they were resolved, not created.
  const resolvedIn = (key: string) =>
    rows.filter((r) => r.resolved_date && monthKeyFromIso(r.resolved_date) === key);
  const baseResolution = computeAnalyticsResolution(rows);
  const curResolution = computeAnalyticsResolution(resolvedIn(curKey));
  const prevResolution = computeAnalyticsResolution(resolvedIn(prevKey));

  return {
    ...base,
    mom: {
      total: pctChange(cur.total, prev.total),
      open: pctChange(cur.open, prev.open),
      resolved: pctChange(cur.resolved, prev.resolved),
      resolution_rate: pctChange(cur.resolution_rate, prev.resolution_rate),
      avg_age: pctChange(cur.avg_age, prev.avg_age),
    },
    risk: {
      ...baseRisk,
      mom: {
        open_critical_major: pctChange(curRisk.open_critical_major, prevRisk.open_critical_major),
        open_long_overdue: pctChange(curRisk.open_long_overdue, prevRisk.open_long_overdue),
      },
    },
    resolution: {
      ...baseResolution,
      mom: {
        avg_hours: pctChange(curResolution.overall.avg_hours, prevResolution.overall.avg_hours),
        median_hours: pctChange(
          curResolution.overall.median_hours,
          prevResolution.overall.median_hours,
        ),
      },
    },
    response: computeAnalyticsResponse(rows, options.sla),
    distribution: computeAnalyticsDistribution(rows),
    escape: computeAnalyticsEscape(rows, options.prod_labels),
  };
}
