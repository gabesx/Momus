import { NextResponse } from 'next/server';
import { buildRangeJql, type RangeSyncType } from '@momus/domain';

export function jsonOk(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ success: true, ...body }, { status });
}

export function jsonFail(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, message, ...extra }, { status });
}

export type SyncRequestParams = {
  jql: string;
  syncType: RangeSyncType;
  batchSize: number;
  maxTotalIssues: number;
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number;
};

export function resolveSyncParams(body: Record<string, unknown>): SyncRequestParams | string {
  const syncType = (String(body.sync_type ?? 'custom') as RangeSyncType) || 'custom';
  if (!['custom', 'quarterly', 'monthly', 'yearly'].includes(syncType)) {
    return 'sync_type must be custom, quarterly, monthly, or yearly';
  }

  const yearRaw = body.year != null ? Number(body.year) : new Date().getFullYear();
  if (!Number.isInteger(yearRaw) || yearRaw < 2020 || yearRaw > 2030) {
    return 'year must be between 2020 and 2030';
  }

  let quarter: 1 | 2 | 3 | 4 | undefined;
  if (body.quarter != null) {
    const q = String(body.quarter).replace(/^Q/i, '');
    const n = Number(q);
    if (![1, 2, 3, 4].includes(n)) return 'quarter must be 1–4';
    quarter = n as 1 | 2 | 3 | 4;
  }

  let month: number | undefined;
  if (body.month != null) {
    month = Number(body.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) return 'month must be 1–12';
  }

  const batchSize = body.batch_size != null ? Number(body.batch_size) : 50;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5000) {
    return 'batch_size must be 1–5000';
  }

  const maxTotalIssues = body.max_total_issues != null ? Number(body.max_total_issues) : 0;
  if (!Number.isInteger(maxTotalIssues) || maxTotalIssues < 0 || maxTotalIssues > 50000) {
    return 'max_total_issues must be 0–50000';
  }

  let jql = typeof body.jql === 'string' ? body.jql.trim() : '';
  if (jql.length > 2000) return 'jql must be ≤2000 characters';

  if (!jql) {
    if (syncType === 'custom') {
      return 'jql is required — paste a query from Jira';
    }
    jql = buildRangeJql({
      syncType,
      year: yearRaw,
      quarter,
      month,
      excludedProjects: [],
    });
  }

  return {
    jql,
    syncType,
    batchSize,
    maxTotalIssues,
    year: yearRaw,
    quarter,
    month,
  };
}
