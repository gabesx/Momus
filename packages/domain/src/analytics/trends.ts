import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import { calculateCost, type CostMultipliers } from '../budget/cost';
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
  multipliers?: CostMultipliers,
): AnalyticsTrendsResult {
  const withDate = rows.filter((r) => r.created_date);
  if (withDate.length === 0) {
    return {
      labels: [],
      bugs: [],
      defects: [],
      total: [],
      resolution_rate: [],
      ...(multipliers ? { cost: [] } : {}),
      created: [],
      resolved: [],
      net: [],
      backlog: [],
      grain,
    };
  }

  const nowKey = periodKeyFromIso(nowIso, grain);
  // Precompute per-row created/resolved period keys once. A row contributes to
  // outflow only when it is closed and carries a usable `resolved_date`; a
  // resolution key beyond "now" (bad data) is ignored.
  const enriched = withDate.map((r) => {
    let rk: string | null = null;
    if (!r.is_open && r.resolved_date) {
      const k = periodKeyFromIso(r.resolved_date, grain);
      if (cmpKey(k, nowKey) <= 0) rk = k;
    }
    return { row: r, ck: periodKeyFromIso(r.created_date!, grain), rk };
  });

  const createdKeys = enriched.map((e) => e.ck).sort(cmpKey);
  const start = createdKeys[0]!;
  const lastCreated = createdKeys[createdKeys.length - 1]!;
  const lastData = cmpKey(lastCreated, nowKey) < 0 ? lastCreated : nowKey;
  // Extend the range so periods where issues were resolved (but none created)
  // still appear for outflow — capped at "now".
  let end = lastData;
  for (const e of enriched) {
    if (e.rk && cmpKey(e.rk, end) > 0) end = e.rk;
  }

  const labels: string[] = [];
  const period_keys: string[] = [];
  const bugs: number[] = [];
  const defects: number[] = [];
  const total: number[] = [];
  const resolution_rate: number[] = [];
  const cost: number[] | undefined = multipliers ? [] : undefined;
  const created: number[] = [];
  const resolved: number[] = [];
  const net: number[] = [];
  const backlog: number[] = [];

  let key = start;
  for (;;) {
    const bucket = enriched.filter((e) => e.ck === key).map((e) => e.row);
    const stats = bucketStats(bucket);
    labels.push(labelForKey(key, grain));
    period_keys.push(key);
    bugs.push(stats.bugs);
    defects.push(stats.defects);
    total.push(stats.total);
    resolution_rate.push(stats.resolution_rate);
    if (cost && multipliers) {
      cost.push(
        round1(
          bucket.reduce(
            (sum, r) => sum + calculateCost(r.priority, r.severity_issue, multipliers),
            0,
          ),
        ),
      );
    }

    const inflow = bucket.length;
    const outflow = enriched.filter((e) => e.rk === key).length;
    created.push(inflow);
    resolved.push(outflow);
    net.push(inflow - outflow);
    // Open backlog at period end: created on/before this period AND not yet
    // resolved by its end (still open, or resolved strictly after it).
    backlog.push(
      enriched.filter(
        (e) => cmpKey(e.ck, key) <= 0 && (e.rk === null ? e.row.is_open : cmpKey(e.rk, key) > 0),
      ).length,
    );

    if (cmpKey(key, end) >= 0) break;
    key = nextKey(key, grain);
  }

  return {
    labels,
    period_keys,
    bugs,
    defects,
    total,
    resolution_rate,
    ...(cost ? { cost } : {}),
    created,
    resolved,
    net,
    backlog,
    grain,
  };
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
