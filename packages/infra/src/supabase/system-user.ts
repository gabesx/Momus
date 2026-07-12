import type { SupabaseClient } from '@supabase/supabase-js';

export const AUTOMATED_SYSTEM_EMAIL = 'automated@system';

const REQUIRED_PERMISSIONS = ['view_analytics', 'access_settings'] as const;

export async function ensureAutomatedSystemUser(
  db: SupabaseClient,
): Promise<{ id: number; email: string }> {
  const { data: existing, error: selectError } = await db
    .from('users')
    .select('id, email')
    .eq('email', AUTOMATED_SYSTEM_EMAIL)
    .eq('is_candidate', false)
    .maybeSingle();

  if (selectError) {
    throw new Error(`ensureAutomatedSystemUser select failed: ${selectError.message}`);
  }

  let userId: number;
  let email: string;

  if (existing) {
    userId = Number(existing.id);
    email = existing.email as string;
  } else {
    const { data: created, error: insertError } = await db
      .from('users')
      .insert({
        email: AUTOMATED_SYSTEM_EMAIL,
        name: 'Automated System',
        is_candidate: false,
      })
      .select('id, email')
      .single();

    if (insertError) {
      throw new Error(`ensureAutomatedSystemUser insert failed: ${insertError.message}`);
    }

    userId = Number(created.id);
    email = created.email as string;
  }

  const { data: existingPerms, error: permsError } = await db
    .from('user_permissions')
    .select('permission')
    .eq('user_id', userId);

  if (permsError) {
    throw new Error(`ensureAutomatedSystemUser permissions select failed: ${permsError.message}`);
  }

  const have = new Set((existingPerms ?? []).map((p) => p.permission as string));
  const missing = REQUIRED_PERMISSIONS.filter((p) => !have.has(p));

  if (missing.length > 0) {
    const { error: insertPermsError } = await db
      .from('user_permissions')
      .insert(missing.map((permission) => ({ user_id: userId, permission })));

    if (insertPermsError) {
      throw new Error(
        `ensureAutomatedSystemUser permissions insert failed: ${insertPermsError.message}`,
      );
    }
  }

  return { id: userId, email };
}
