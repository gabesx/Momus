import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyAnalyticsFilters,
  buildAnalyticsDigest,
  computeAnalyticsSummary,
  computeTrends,
} from '@momus/domain';
import { BugBudgetQueryRepository, loadSummaryConfig } from '../supabase/bug-budget-query';
import type { AnalyticsSettings } from '../supabase/analytics-settings';

/**
 * True when "now" (Asia/Jakarta) matches the configured digest day + hour.
 * Used by the cron to gate the scheduled send; the manual send bypasses it.
 */
export function digestScheduleMatches(settings: AnalyticsSettings, nowIso: string): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowIso));
  const weekday = parts.find((p) => p.type === 'weekday')?.value.toLowerCase();
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return weekday === settings.digest_day && hour === settings.digest_hour;
}

export type DigestRunResult = { status: number };

/**
 * Build the weekly analytics digest for the default window and POST it to the
 * configured webhook (Slack or Google Chat). Shared by the cron and the manual
 * send-now route. Throws on a missing webhook or a non-2xx response.
 */
export async function runAnalyticsDigest(
  db: SupabaseClient,
  settings: AnalyticsSettings,
  opts: { dashboardUrl?: string } = {},
): Promise<DigestRunResult> {
  const webhook = settings.digest_webhook_url?.trim();
  if (!webhook) throw new Error('No digest webhook URL configured');

  const repo = new BugBudgetQueryRepository(db);
  const [all, config] = await Promise.all([repo.listAllForFilters(), loadSummaryConfig(db)]);
  const nowIso = new Date().toISOString();
  const filtered = applyAnalyticsFilters(all, {}, nowIso);
  const summary = computeAnalyticsSummary(filtered, nowIso, {
    sla: settings,
    prod_labels: settings.prod_labels,
    escape_mode: settings.escape_mode,
    prod_issue_types: settings.prod_issue_types,
  });
  const trends = computeTrends(filtered, 'month', nowIso, config.multipliers);

  const dashboardUrl =
    opts.dashboardUrl ??
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/`
      : undefined);

  const text = buildAnalyticsDigest(summary, trends, {
    dateLabel: nowIso.slice(0, 10),
    dashboardUrl,
    linkStyle: settings.digest_provider === 'google_chat' ? 'plain' : 'slack',
  });

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`digest webhook responded ${res.status}`);
  return { status: res.status };
}
