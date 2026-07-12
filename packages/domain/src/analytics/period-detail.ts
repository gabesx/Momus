import { BUG_GROUP_TYPES, DEFECT_GROUP_TYPES } from '../constants/defaults';
import {
  isAcRelatedLabels,
  issueTypeOf,
  monthKeyFromIso,
  quarterKeyFromIso,
  yearKeyFromIso,
} from './filter';
import type {
  AnalyticsIssueRow,
  AnalyticsPeriodDetail,
  AnalyticsTrendGrain,
} from './types';

function periodKeyFromIso(iso: string, grain: AnalyticsTrendGrain): string {
  if (grain === 'quarter') return quarterKeyFromIso(iso);
  if (grain === 'year') return yearKeyFromIso(iso);
  return monthKeyFromIso(iso);
}

export function computePeriodDetail(
  rows: AnalyticsIssueRow[],
  periodKey: string,
  grain: AnalyticsTrendGrain,
): AnalyticsPeriodDetail {
  const bucket = rows.filter(
    (r) => r.created_date && periodKeyFromIso(r.created_date, grain) === periodKey,
  );
  const severity_by_priority: Record<string, Record<string, number>> = {};
  const severity_by_ac: Record<string, { ac: number; non_ac: number }> = {};

  for (const row of bucket) {
    const sev = row.severity_issue?.trim() || 'Unknown';
    const pri = row.priority?.trim() || 'None';
    severity_by_priority[sev] = severity_by_priority[sev] ?? {};
    severity_by_priority[sev][pri] = (severity_by_priority[sev][pri] ?? 0) + 1;

    severity_by_ac[sev] = severity_by_ac[sev] ?? { ac: 0, non_ac: 0 };
    if (isAcRelatedLabels(row.ac_related_labels ?? row.labels)) {
      severity_by_ac[sev].ac += 1;
    } else {
      severity_by_ac[sev].non_ac += 1;
    }
  }

  return {
    period_key: periodKey,
    grain,
    total: bucket.length,
    bugs: bucket.filter((r) =>
      (BUG_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)),
    ).length,
    defects: bucket.filter((r) =>
      (DEFECT_GROUP_TYPES as readonly string[]).includes(issueTypeOf(r)),
    ).length,
    severity_by_priority,
    severity_by_ac,
  };
}
