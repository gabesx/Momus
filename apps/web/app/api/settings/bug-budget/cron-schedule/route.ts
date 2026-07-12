import { BugBudgetConfigRepository, createServerClient } from '@momus/infra';
import { MESSAGES } from '@momus/shared';
import { writeSettingsAudit } from '@/lib/audit';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET() {
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const db = createServerClient();
    const schedule = await new BugBudgetConfigRepository(db).getOrCreateCronSchedule();
    return jsonOk({ schedule });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load cron schedule';
    return jsonFail(message, 500);
  }
}

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const scheduleType = String(body.schedule_type ?? '');
    if (!['daily', 'weekly', 'monthly', 'custom'].includes(scheduleType)) {
      return jsonFail('schedule_type must be daily, weekly, monthly, or custom', 422);
    }
    const time = String(body.time ?? '');
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return jsonFail('time must be HH:MM', 422);
    }
    const intervalDays = body.interval_days != null ? Number(body.interval_days) : 1;
    if (!Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      return jsonFail('interval_days must be 1–365', 422);
    }

    const db = createServerClient();
    const repo = new BugBudgetConfigRepository(db);
    const before = await repo.getOrCreateCronSchedule();
    const schedule = await repo.saveCronSchedule({
      is_active: Boolean(body.is_active),
      schedule_type: scheduleType as 'daily' | 'weekly' | 'monthly' | 'custom',
      interval_days: intervalDays,
      time,
      day_of_week: body.day_of_week != null ? String(body.day_of_week) : null,
      day_of_month: body.day_of_month != null ? Number(body.day_of_month) : null,
      jql: body.jql != null ? String(body.jql) : null,
      batch_size: body.batch_size != null ? Number(body.batch_size) : 50,
      max_total_issues: body.max_total_issues != null ? Number(body.max_total_issues) : 0,
    });
    await writeSettingsAudit({
      db,
      userId: auth.user.id,
      action: 'update',
      entityType: 'cron_schedules',
      entityKey: 'bug_budget_sync',
      beforeValue: before as unknown as Record<string, unknown>,
      afterValue: schedule as unknown as Record<string, unknown>,
    });

    return jsonOk({ message: MESSAGES.M17, schedule });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save cron schedule';
    return jsonFail(message, 422);
  }
}
