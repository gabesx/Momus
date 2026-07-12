import type { SupabaseClient } from '@supabase/supabase-js';

const ALLOWED_PERMISSIONS = new Set([
  'view_analytics',
  'access_settings',
  'manage_users',
]);

export function normalizePermissions(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out = [
    ...new Set(
      input.filter((p): p is string => typeof p === 'string' && ALLOWED_PERMISSIONS.has(p)),
    ),
  ];
  return out;
}

export class UserConflictError extends Error {
  constructor(message = 'User already exists') {
    super(message);
    this.name = 'UserConflictError';
  }
}

export class UserNotFoundError extends Error {
  constructor(message = 'User not found') {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

export type UserRecord = {
  id: number;
  email: string;
  name: string | null;
  is_candidate: boolean;
  auth_user_id: string | null;
  permissions: string[];
};

export type InviteUserInput = {
  email: string;
  name: string;
  permissions: unknown;
};

export type UpdateUserInput = {
  permissions?: unknown;
  is_candidate?: boolean;
};

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  is_candidate: boolean;
  auth_user_id: string | null;
  user_permissions?: { permission: string }[];
};

function mapUserRow(row: UserRow): UserRecord {
  const permissions = (row.user_permissions ?? []).map((p) => p.permission);
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    is_candidate: row.is_candidate,
    auth_user_id: row.auth_user_id,
    permissions,
  };
}

function isAuthUserConflict(error: { message?: string; status?: number }): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.status === 422 ||
    msg.includes('already been registered') ||
    msg.includes('already exists') ||
    msg.includes('email address has already')
  );
}

const USER_SELECT =
  'id, email, name, is_candidate, auth_user_id, user_permissions(permission)';

export class UsersRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listUsers(): Promise<UserRecord[]> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_SELECT)
      .order('id', { ascending: true });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    return (data ?? []).map((row) => mapUserRow(row as UserRow));
  }

  async inviteUser(input: InviteUserInput): Promise<UserRecord> {
    const permissions = normalizePermissions(input.permissions);
    if (permissions === null) {
      throw new Error('Invalid permissions');
    }

    const { data: inviteData, error: inviteError } =
      await this.db.auth.admin.inviteUserByEmail(input.email, {
        data: { name: input.name },
      });

    if (inviteError) {
      if (isAuthUserConflict(inviteError)) {
        throw new UserConflictError(inviteError.message);
      }
      throw new Error(`inviteUser failed: ${inviteError.message}`);
    }

    const authUserId = inviteData.user?.id;
    if (!authUserId) {
      throw new Error('inviteUser failed: missing auth user id');
    }

    const { data: userRow, error: upsertError } = await this.db
      .from('users')
      .upsert(
        {
          auth_user_id: authUserId,
          email: input.email,
          name: input.name,
          is_candidate: false,
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id, email, name, is_candidate, auth_user_id')
      .single();

    if (upsertError) throw new Error(`inviteUser upsert failed: ${upsertError.message}`);

    const userId = Number(userRow.id);
    await this.replacePermissions(userId, permissions);

    const user = await this.getUserById(userId);
    if (!user) throw new Error(`inviteUser failed: user ${userId} not found after insert`);
    return user;
  }

  async updateUser(id: number, input: UpdateUserInput): Promise<UserRecord> {
    const existing = await this.getUserById(id);
    if (!existing) throw new UserNotFoundError(`User ${id} not found`);

    if (input.is_candidate !== undefined) {
      const { error } = await this.db
        .from('users')
        .update({ is_candidate: input.is_candidate })
        .eq('id', id);
      if (error) throw new Error(`updateUser failed: ${error.message}`);
    }

    if (input.permissions !== undefined) {
      const permissions = normalizePermissions(input.permissions);
      if (permissions === null) {
        throw new Error('Invalid permissions');
      }
      await this.replacePermissions(id, permissions);
    }

    const updated = await this.getUserById(id);
    if (!updated) throw new UserNotFoundError(`User ${id} not found`);
    return updated;
  }

  private async getUserById(id: number): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`getUserById failed: ${error.message}`);
    return data ? mapUserRow(data as UserRow) : null;
  }

  private async replacePermissions(userId: number, permissions: string[]): Promise<void> {
    const { error: deleteError } = await this.db
      .from('user_permissions')
      .delete()
      .eq('user_id', userId);
    if (deleteError) {
      throw new Error(`replacePermissions delete failed: ${deleteError.message}`);
    }

    if (permissions.length === 0) return;

    const { error: insertError } = await this.db.from('user_permissions').insert(
      permissions.map((permission) => ({
        user_id: userId,
        permission,
      })),
    );
    if (insertError) {
      throw new Error(`replacePermissions insert failed: ${insertError.message}`);
    }
  }
}
