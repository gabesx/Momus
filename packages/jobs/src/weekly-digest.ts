import {
  createServerClient,
  digestScheduleMatches,
  loadAnalyticsSettings,
  runAnalyticsDigest,
} from '@momus/infra';
import { inngest } from './client';

/**
 * Weekly analytics digest. Runs hourly (Asia/Jakarta) and sends only when the
 * current day + hour match the schedule configured in the Analytics settings
 * tab (default Monday 08:00). Posts KPIs, deltas, and top offenders to the
 * configured Slack or Google Chat webhook. No-op unless enabled there.
 */
export const weeklyAnalyticsDigest = inngest.createFunction(
  {
    id: 'analytics-weekly-digest',
    triggers: { cron: 'TZ=Asia/Jakarta 0 * * * *' },
  },
  async ({ step }) => {
    const settings = await step.run('load-settings', async () =>
      loadAnalyticsSettings(createServerClient()),
    );
    if (!settings.digest_enabled || !settings.digest_webhook_url) {
      return { skipped: true, reason: 'digest disabled or webhook missing' };
    }
    if (!digestScheduleMatches(settings, new Date().toISOString())) {
      return { skipped: true, reason: 'not the scheduled day/hour' };
    }

    const result = await step.run('send-digest', async () =>
      runAnalyticsDigest(createServerClient(), settings),
    );

    return { skipped: false, status: result.status };
  },
);
