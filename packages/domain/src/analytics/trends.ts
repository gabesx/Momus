import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { round1 } from '../budget/status';
import { monthKeyFromIso } from './filter';
import type { AnalyticsIssueRow, AnalyticsTrendsResult } from './types';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function computeMonthlyTrends(rows: AnalyticsIssueRow[], nowIso: string): AnalyticsTrendsResult {
  const withDate = rows.filter((r) => r.created_date);
  if (withDate.length === 0) {
    return { labels: [], bugs: [], defects: [], total: [], resolution_rate: [] };
  }
  const keys = [...new Set(withDate.map((r) => monthKeyFromIso(r.created_date!)))].sort();
  const start = keys[0];
  const nowKey = monthKeyFromIso(nowIso);
  const lastData = keys[keys.length - 1]!;
  // Do not pad empty months past the last data month (e.g. year=2024 should not extend to now).
  const end = lastData < nowKey ? lastData : nowKey;
  const labels: string[] = [];
  const bugs: number[] = [];
  const defects: number[] = [];
  const total: number[] = [];
  const resolution_rate: number[] = [];

  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const bucket = withDate.filter((r) => monthKeyFromIso(r.created_date!) === key);
    const b = bucket.filter((r) =>
      (BUG_GROUP_TYPES as readonly string[]).includes(r.issue_type ?? r.final_issue_type ?? ''),
    ).length;
    const d = bucket.filter((r) =>
      (DEFECT_GROUP_TYPES as readonly string[]).includes(r.issue_type ?? r.final_issue_type ?? ''),
    ).length;
    const t = bucket.length;
    const resolved = bucket.filter((r) => !r.is_open).length;
    labels.push(`${MONTH_LABELS[m - 1]} ${y}`);
    bugs.push(b);
    defects.push(d);
    total.push(t);
    resolution_rate.push(t > 0 ? round1((resolved / t) * 100) : 0);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return { labels, bugs, defects, total, resolution_rate };
}
