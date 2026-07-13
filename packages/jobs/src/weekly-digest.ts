import {
  applyAnalyticsFilters,
  buildAnalyticsDigest,
  computeAnalyticsSummary,
  computeTrends,
} from '@momus/domain';
import {
  BugBudgetQueryRepository,
  createServerClient,
  loadAnalyticsSettings,
  loadSummaryConfig,
} from '@momus/infra';
import { inngest } from './client';

/**
 * Weekly analytics digest — Monday 08:00 Asia/Jakarta. Posts KPI summary,
 * deltas, and top offenders to the Slack webhook configured in the
 * Analytics settings tab. No-op unless the digest is enabled there.
 */
export const weeklyAnalyticsDigest = inngest.createFunction(
  {
    id: 'analytics-weekly-digest',
    triggers: { cron: 'TZ=Asia/Jakarta 0 8 * * 1' },
  },
  async ({ step }) => {
    const settings = await step.run('load-settings', async () =>
      loadAnalyticsSettings(createServerClient()),
    );
    if (!settings.digest_enabled || !settings.digest_webhook_url) {
      return { skipped: true, reason: 'digest disabled or webhook missing' };
    }

    const text = await step.run('build-digest', async () => {
      const db = createServerClient();
      const repo = new BugBudgetQueryRepository(db);
      const [all, config] = await Promise.all([repo.listAllForFilters(), loadSummaryConfig(db)]);
      const nowIso = new Date().toISOString();
      // Default analytics window (same as the dashboard with no filters).
      const filtered = applyAnalyticsFilters(all, {}, nowIso);
      const summary = computeAnalyticsSummary(filtered, nowIso, {
        sla: settings,
        prod_labels: settings.prod_labels,
      });
      const trends = computeTrends(filtered, 'month', nowIso, config.multipliers);
      const dateLabel = nowIso.slice(0, 10);
      const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/`
        : undefined;
      return buildAnalyticsDigest(summary, trends, { dateLabel, dashboardUrl });
    });

    await step.run('post-webhook', async () => {
      const res = await fetch(settings.digest_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        throw new Error(`digest webhook responded ${res.status}`);
      }
    });

    return { skipped: false };
  },
);
