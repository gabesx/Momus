import { round1 } from '../budget/status';
import type {
  AnalyticsDistributionEntry,
  AnalyticsDistributionResult,
  AnalyticsIssueRow,
  AnalyticsSquadHeat,
} from './types';

/** Column priority for the squad heat map; unknown severities sort after these. */
const SEVERITY_PRIORITY = ['Critical', 'Major', 'Minor', 'Low'];

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

function severityKey(row: AnalyticsIssueRow): string {
  return nonEmpty(row.severity_issue) ?? 'Unspecified';
}

/** Squad × severity matrix of open-issue counts. Rows worst-first, columns by severity. */
function computeSquadHeat(rows: AnalyticsIssueRow[]): AnalyticsSquadHeat {
  const open: Record<string, Record<string, number>> = {};
  const row_totals: Record<string, number> = {};
  const col_totals: Record<string, number> = {};
  const critical_major: Record<string, number> = {};
  const squadSet = new Set<string>();
  const sevSet = new Set<string>();

  for (const r of rows) {
    if (!r.is_open) continue;
    const squad = nonEmpty(r.real_project) ?? r.project;
    const sev = severityKey(r);
    squadSet.add(squad);
    sevSet.add(sev);
    (open[squad] ??= {})[sev] = (open[squad]![sev] ?? 0) + 1;
    row_totals[squad] = (row_totals[squad] ?? 0) + 1;
    col_totals[sev] = (col_totals[sev] ?? 0) + 1;
    if (sev === 'Critical' || sev === 'Major') {
      critical_major[squad] = (critical_major[squad] ?? 0) + 1;
    }
  }

  const severities = [...sevSet].sort((a, b) => {
    const ia = SEVERITY_PRIORITY.indexOf(a);
    const ib = SEVERITY_PRIORITY.indexOf(b);
    const ra = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
    const rb = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
    return ra - rb || a.localeCompare(b);
  });
  const squads = [...squadSet].sort(
    (a, b) =>
      (critical_major[b] ?? 0) - (critical_major[a] ?? 0) ||
      (row_totals[b] ?? 0) - (row_totals[a] ?? 0) ||
      a.localeCompare(b),
  );

  let max = 0;
  for (const s of squads) {
    for (const v of severities) {
      const c = open[s]?.[v] ?? 0;
      if (c > max) max = c;
    }
  }

  return { squads, severities, open, row_totals, col_totals, max };
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
    squad_heat: computeSquadHeat(rows),
  };
}
