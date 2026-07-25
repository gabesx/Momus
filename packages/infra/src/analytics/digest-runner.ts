import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildExecutiveDigestMessage,
  buildProductDigestMessage,
  computeExecutiveSummary,
  computeProductHealth,
  hasDigestContent,
  listProductsByRisk,
} from '@momus/domain';
import { BugBudgetQueryRepository } from '../supabase/bug-budget-query';
import { getJiraSettings } from '../supabase/settings';
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

export type DigestRunResult = { messages: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chat webhooks rate-limit (~1 msg/sec); throttle between posts and back off on 429. */
async function postMessage(webhook: string, text: string, attempt = 0): Promise<void> {
  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 2 ** attempt) * 1000);
    return postMessage(webhook, text, attempt + 1);
  }
  if (!res.ok) throw new Error(`digest webhook responded ${res.status}`);
}

/**
 * Send the executive weekly digest to the configured webhook (Slack or Google
 * Chat): an Executive Summary message followed by one Product Health message
 * per product (riskiest first; products with no open bugs and no activity
 * this week are skipped). Shared by the cron and the manual send-now route.
 * Throws on a missing webhook or any non-2xx response.
 */
export async function runAnalyticsDigest(
  db: SupabaseClient,
  settings: AnalyticsSettings,
  opts: { dashboardUrl?: string } = {},
): Promise<DigestRunResult> {
  const webhook = settings.digest_webhook_url?.trim();
  if (!webhook) throw new Error('No digest webhook URL configured');

  const repo = new BugBudgetQueryRepository(db);
  const all = await repo.listAllForFilters();
  const nowIso = new Date().toISOString();
  const linkStyle = settings.digest_provider === 'google_chat' ? 'plain' : 'slack';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  const dashboardUrl = opts.dashboardUrl ?? (appUrl ? `${appUrl}/reports/executive` : undefined);

  let jiraBase: string | undefined;
  try {
    const jira = await getJiraSettings();
    jiraBase = jira.url ? `${jira.url.replace(/\/$/, '')}/browse` : undefined;
  } catch {
    jiraBase = undefined;
  }

  const summary = computeExecutiveSummary(all, nowIso);
  const products = listProductsByRisk(all)
    .map((p) => computeProductHealth(all, p, nowIso))
    .filter(hasDigestContent);

  const messages = [
    buildExecutiveDigestMessage(summary, {
      dateLabel: nowIso.slice(0, 10),
      jiraBase,
      dashboardUrl,
      linkStyle,
    }),
    ...products.map((h) => buildProductDigestMessage(h, { jiraBase, linkStyle })),
  ];

  for (let i = 0; i < messages.length; i++) {
    if (i > 0) await sleep(1200); // stay under the ~1 msg/sec chat webhook limit
    await postMessage(webhook, messages[i]!);
  }
  return { messages: messages.length };
}
