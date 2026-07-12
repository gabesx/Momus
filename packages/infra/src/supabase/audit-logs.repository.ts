import type { SupabaseClient } from '@supabase/supabase-js';

export type WriteAuditLogInput = {
  userId: number | null;
  action: string;
  entityType: string;
  entityKey: string | null;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
};

export class AuditLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async write(input: WriteAuditLogInput): Promise<void> {
    const { error } = await this.db.from('audit_logs').insert({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_key: input.entityKey,
      before_value: input.beforeValue,
      after_value: input.afterValue,
    });
    if (error) throw new Error(`audit_logs write failed: ${error.message}`);
  }
}
