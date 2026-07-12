import { AuditLogRepository, createServerClient } from '@momus/infra';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function writeSettingsAudit(input: {
  db?: SupabaseClient;
  userId: number;
  action: 'create' | 'update';
  entityType: string;
  entityKey: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const db = input.db ?? createServerClient();
    await new AuditLogRepository(db).write({
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityKey: input.entityKey,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[audit]', input.entityType, input.entityKey, message);
  }
}
