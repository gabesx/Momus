import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { round1 } from '../budget/status';
import {
  issueTypeOf,
  monthKeyFromIso,
  quarterKeyFromIso,
  yearKeyFromIso,
} from './filter';
import type { AnalyticsIssueRow, AnalyticsTrendGrain, AnalyticsTrendsResult } from './types';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function periodKeyFromIso(iso: string, grain: AnalyticsTrendGrain): string {
  if (grain === 'quarter') return quarterKeyFromIso(iso);
  if (grain === 'year') return yearKeyFromIso(iso);
  return monthKeyFromIso(iso);
}

function labelForKey(key: string, grain: AnalyticsTrendGrain): string {
  if (grain === 'year') return key;
  if (grain === 'quarter') {
    const [y, q] = key.split('-Q');
    return `Q${q} ${y}`;
  }
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}

function nextKey(key: string, grain: AnalyticsTrendGrain): string {
  if (grain === 'year') return String(Number(key) + 1);
  if (grain === 'quarter') {
    const [y, q] = key.split('-Q').map(Number);
    if (q >= 4) return `${y + 1}-Q1`;
    return `${y}-Q${q + 1}`;
  }
  let [y, m] = key.split('-').map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

function cmpKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function bucketStats(bucket: AnalyticsIssueRow[]) {
  const bugs = bucket.filter((r) =>
    (BUG_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)),
  ).length;
  const defects = bucket.filter((r) =>
    (DEFECT_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)),
  ).length;
  const total = bucket.length;
  const resolved = bucket.filter((r) => !r.is_open).length;
  return {
    bugs,
    defects,
    total,
    resolution_rate: total > 0 ? round1((resolved / total) * 100) : 0,
  };
}

export function computeTrends(
  rows: AnalyticsIssueRow[],
  grain: AnalyticsTrendGrain,
  nowIso: string,
): AnalyticsTrendsResult {
  const withDate = rows.filter((r) => r.created_date);
  if (withDate.length === 0) {
    return { labels: [], bugs: [], defects: [], total: [], resolution_rate: [], grain };
  }
  const keys = [
    ...new Set(withDate.map((r) => periodKeyFromIso(r.created_date!, grain))),
  ].sort(cmpKey);
  const start = keys[0]!;
  const nowKey = periodKeyFromIso(nowIso, grain);
  const lastData = keys[keys.length - 1]!;
  const end = cmpKey(lastData, nowKey) < 0 ? lastData : nowKey;

  const labels: string[] = [];
  const period_keys: string[] = [];
  const bugs: number[] = [];
  const defects: number[] = [];
  const total: number[] = [];
  const resolution_rate: number[] = [];

  let key = start;
  for (;;) {
    const bucket = withDate.filter((r) => periodKeyFromIso(r.created_date!, grain) === key);
    const stats = bucketStats(bucket);
    labels.push(labelForKey(key, grain));
    period_keys.push(key);
    bugs.push(stats.bugs);
    defects.push(stats.defects);
    total.push(stats.total);
    resolution_rate.push(stats.resolution_rate);
    if (cmpKey(key, end) >= 0) break;
    key = nextKey(key, grain);
  }

  return { labels, period_keys, bugs, defects, total, resolution_rate, grain };
}

/** @deprecated Prefer computeTrends(..., 'month', nowIso) */
export function computeMonthlyTrends(
  rows: AnalyticsIssueRow[],
  nowIso: string,
): AnalyticsTrendsResult {
  const t = computeTrends(rows, 'month', nowIso);
  return {
    labels: t.labels,
    period_keys: t.period_keys,
    bugs: t.bugs,
    defects: t.defects,
    total: t.total,
    resolution_rate: t.resolution_rate,
  };
}
