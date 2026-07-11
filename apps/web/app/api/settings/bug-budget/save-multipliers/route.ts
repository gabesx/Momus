import {
  BugBudgetConfigRepository,
  createServerClient,
  loadSettingsConfig,
  parseMultipliers,
} from '@momus/infra';
import { MESSAGES } from '@momus/shared';
import { writeSettingsAudit } from '@/lib/audit';
import { assertCsrf, requireAccessSettings } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function POST(request: Request) {
  const csrf = assertCsrf(request);
  if (csrf) return csrf;
  const auth = await requireAccessSettings();
  if ('error' in auth) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const payload = parseMultipliers(body);
    const db = createServerClient();
    const beforeCfg = await loadSettingsConfig(db);
    const before = {
      priority_multipliers: beforeCfg.priority_multipliers,
      severity_multipliers: beforeCfg.severity_multipliers,
    };
    await new BugBudgetConfigRepository(db).saveMultipliers(payload);
    await writeSettingsAudit({
      db,
      userId: auth.user.id,
      action: 'update',
      entityType: 'bug_budget_config',
      entityKey: 'multipliers',
      beforeValue: before,
      afterValue: {
        priority_multipliers: {
          highest: payload.priority_highest,
          high: payload.priority_high,
          medium: payload.priority_medium,
          low: payload.priority_low,
          lowest: payload.priority_lowest,
        },
        severity_multipliers: {
          critical: payload.severity_critical,
          major: payload.severity_major,
          moderate: payload.severity_moderate,
          minor: payload.severity_minor,
          low: payload.severity_low,
        },
      },
    });
    return jsonOk({ message: MESSAGES.M14 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid multipliers';
    return jsonFail(message, 422);
  }
}
