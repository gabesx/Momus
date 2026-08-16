import {
  classifyAuthSignInMethod,
  isEmailAllowlisted,
  normalizeEmail,
  type ApprovalStatus,
  type AuthSignInMethod,
} from '@momus/domain';
import type { SupabaseClient, User as AuthUser } from '@supabase/supabase-js';
import { AuthAllowlistRepository } from './auth-allowlist.repository';

const ALLOWED_PERMISSIONS = new Set([
  'view_analytics',
  'access_settings',
  'manage_users',
  'view_executive_reports',
  'view_leaderboard',
]);

const MIN_PASSWORD_LENGTH = 8;

export function normalizePermissions(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const out = [
    ...new Set(
      input.filter((p): p is string => typeof p === 'string' && ALLOWED_PERMISSIONS.has(p)),
    ),
  ];
  return out;
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

/** Provider names from a Supabase Auth user (`google`, `email`, …). */
export function authProvidersFromUser(user: AuthUser | null | undefined): string[] {
  if (!user) return [];
  const fromIdentities = (user.identities ?? [])
    .map((i) => i.provider)
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0);
  if (fromIdentities.length) return [...new Set(fromIdentities)];

  const metaProviders = user.app_metadata?.providers;
  if (Array.isArray(metaProviders)) {
    return [
      ...new Set(
        metaProviders.filter((p): p is string => typeof p === 'string' && p.trim().length > 0),
      ),
    ];
  }
  const single = user.app_metadata?.provider;
  return typeof single === 'string' && single.trim() ? [single] : [];
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
  approval_status: ApprovalStatus;
  permissions: string[];
  /** Supabase Auth identity providers (e.g. google, email). */
  auth_providers: string[];
  /** Derived sign-in method for admin UI. */
  auth_method: AuthSignInMethod;
};

export type InviteUserInput = {
  email: string;
  name: string;
  permissions: unknown;
};

export type CreatePasswordUserInput = {
  email: string;
  name: string;
  password: string;
  permissions: unknown;
};

export type UpdateUserInput = {
  permissions?: unknown;
  is_candidate?: boolean;
};

export type EnsureUserInput = {
  authUserId: string;
  email: string;
  name: string | null;
};

export type ListUsersFilter = {
  status?: ApprovalStatus;
};

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  is_candidate: boolean;
  auth_user_id: string | null;
  approval_status: ApprovalStatus;
  user_permissions?: { permission: string }[];
};

function mapUserRow(
  row: UserRow,
  auth: { providers: string[]; method: AuthSignInMethod } = {
    providers: [],
    method: 'unknown',
  },
): UserRecord {
  const permissions = (row.user_permissions ?? []).map((p) => p.permission);
  return {
    id: Number(row.id),
    email: row.email,
    name: row.name,
    is_candidate: row.is_candidate,
    auth_user_id: row.auth_user_id,
    approval_status: row.approval_status,
    permissions,
    auth_providers: auth.providers,
    auth_method: auth.method,
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

function isUniqueViolation(error: {
  code?: string;
  message?: string;
}): boolean {
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '23505' ||
    msg.includes('duplicate key') ||
    msg.includes('unique constraint')
  );
}

const USER_SELECT =
  'id, email, name, is_candidate, auth_user_id, approval_status, user_permissions(permission)';

export class UsersRepository {
  constructor(private readonly db: SupabaseClient) {}

  async listUsers(filter?: ListUsersFilter): Promise<UserRecord[]> {
    let query = this.db.from('users').select(USER_SELECT).order('id', { ascending: true });
    if (filter?.status) {
      query = query.eq('approval_status', filter.status);
    }
    const { data, error } = await query;
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const rows = (data ?? []) as UserRow[];
    const authMap = await this.loadAuthProviderMap(
      rows.map((r) => r.auth_user_id).filter((id): id is string => !!id),
    );
    return rows.map((row) => {
      const providers = row.auth_user_id ? (authMap.get(row.auth_user_id) ?? []) : [];
      return mapUserRow(row, {
        providers,
        method: classifyAuthSignInMethod(providers),
      });
    });
  }

  async ensureUser(
    input: EnsureUserInput,
  ): Promise<{ ok: true; user: UserRecord } | { ok: false; reason: 'not_allowlisted' }> {
    const allowlist = await new AuthAllowlistRepository(this.db).list();
    if (!isEmailAllowlisted(input.email, allowlist.domains, allowlist.emails)) {
      return { ok: false, reason: 'not_allowlisted' };
    }

    const existing = await this.getUserByAuthUserId(input.authUserId);
    if (existing) {
      return { ok: true, user: existing };
    }

    const { data, error } = await this.db
      .from('users')
      .insert({
        auth_user_id: input.authUserId,
        email: normalizeEmail(input.email),
        name: input.name,
        is_candidate: false,
        approval_status: 'pending',
      })
      .select(USER_SELECT)
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.getUserByAuthUserId(input.authUserId);
        if (raced) return { ok: true, user: raced };
      }
      throw new Error(`ensureUser insert failed: ${error.message}`);
    }

    return { ok: true, user: await this.enrichUser(mapUserRow(data as UserRow)) };
  }

  async approveUser(id: number, permissions: unknown): Promise<UserRecord> {
    const existing = await this.getUserById(id);
    if (!existing) throw new UserNotFoundError(`User ${id} not found`);

    const normalized = normalizePermissions(permissions);
    if (normalized === null || normalized.length === 0) {
      throw new Error('Invalid permissions');
    }

    const { error } = await this.db
      .from('users')
      .update({ approval_status: 'approved', is_candidate: false })
      .eq('id', id);
    if (error) throw new Error(`approveUser failed: ${error.message}`);

    await this.replacePermissions(id, normalized);

    const updated = await this.getUserById(id);
    if (!updated) throw new UserNotFoundError(`User ${id} not found`);
    return updated;
  }

  async rejectUser(id: number): Promise<UserRecord> {
    const existing = await this.getUserById(id);
    if (!existing) throw new UserNotFoundError(`User ${id} not found`);

    const { error } = await this.db
      .from('users')
      .update({ approval_status: 'rejected' })
      .eq('id', id);
    if (error) throw new Error(`rejectUser failed: ${error.message}`);

    await this.replacePermissions(id, []);

    const updated = await this.getUserById(id);
    if (!updated) throw new UserNotFoundError(`User ${id} not found`);
    return updated;
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

    return this.upsertApprovedMomusUser({
      authUserId,
      email: input.email,
      name: input.name,
      permissions,
    });
  }

  /**
   * Create an approved user with email + password (no invite email).
   * Confirms the email immediately so they can sign in right away.
   */
  async createUserWithPassword(input: CreatePasswordUserInput): Promise<UserRecord> {
    const permissions = normalizePermissions(input.permissions);
    if (permissions === null) {
      throw new Error('Invalid permissions');
    }
    const passwordError = validatePassword(input.password);
    if (passwordError) throw new Error(passwordError);

    const { data: created, error: createError } = await this.db.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name },
    });

    if (createError) {
      if (isAuthUserConflict(createError)) {
        throw new UserConflictError(createError.message);
      }
      throw new Error(`createUserWithPassword failed: ${createError.message}`);
    }

    const authUserId = created.user?.id;
    if (!authUserId) {
      throw new Error('createUserWithPassword failed: missing auth user id');
    }

    return this.upsertApprovedMomusUser({
      authUserId,
      email: input.email,
      name: input.name,
      permissions,
    });
  }

  async updateUserPassword(id: number, password: string): Promise<UserRecord> {
    const existing = await this.getUserById(id);
    if (!existing) throw new UserNotFoundError(`User ${id} not found`);
    if (!existing.auth_user_id) {
      throw new Error('User has no linked auth account');
    }
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);

    const { error } = await this.db.auth.admin.updateUserById(existing.auth_user_id, {
      password,
    });
    if (error) throw new Error(`updateUserPassword failed: ${error.message}`);

    return existing;
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

  private async upsertApprovedMomusUser(input: {
    authUserId: string;
    email: string;
    name: string;
    permissions: string[];
  }): Promise<UserRecord> {
    const { data: userRow, error: upsertError } = await this.db
      .from('users')
      .upsert(
        {
          auth_user_id: input.authUserId,
          email: input.email,
          name: input.name,
          is_candidate: false,
          approval_status: 'approved',
        },
        { onConflict: 'auth_user_id' },
      )
      .select('id, email, name, is_candidate, auth_user_id, approval_status')
      .single();

    if (upsertError) throw new Error(`upsertApprovedMomusUser failed: ${upsertError.message}`);

    const userId = Number(userRow.id);
    await this.replacePermissions(userId, input.permissions);

    const user = await this.getUserById(userId);
    if (!user) throw new Error(`upsertApprovedMomusUser failed: user ${userId} not found`);
    return user;
  }

  private async getUserById(id: number): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`getUserById failed: ${error.message}`);
    if (!data) return null;
    return this.enrichUser(mapUserRow(data as UserRow));
  }

  private async getUserByAuthUserId(authUserId: string): Promise<UserRecord | null> {
    const { data, error } = await this.db
      .from('users')
      .select(USER_SELECT)
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (error) throw new Error(`getUserByAuthUserId failed: ${error.message}`);
    if (!data) return null;
    return this.enrichUser(mapUserRow(data as UserRow));
  }

  private async enrichUser(user: UserRecord): Promise<UserRecord> {
    if (!user.auth_user_id) return user;
    const map = await this.loadAuthProviderMap([user.auth_user_id]);
    const providers = map.get(user.auth_user_id) ?? [];
    return {
      ...user,
      auth_providers: providers,
      auth_method: classifyAuthSignInMethod(providers),
    };
  }

  private async loadAuthProviderMap(authUserIds: string[]): Promise<Map<string, string[]>> {
    const unique = [...new Set(authUserIds)];
    const out = new Map<string, string[]>();
    if (unique.length === 0) return out;

    await Promise.all(
      unique.map(async (id) => {
        try {
          const { data, error } = await this.db.auth.admin.getUserById(id);
          if (error || !data.user) {
            out.set(id, []);
            return;
          }
          out.set(id, authProvidersFromUser(data.user));
        } catch {
          out.set(id, []);
        }
      }),
    );
    return out;
  }

  /**
   * Insert the new set first, then drop what is no longer granted. Deleting first
   * would strand the user with zero permissions if the insert is rejected (e.g. a
   * permission the DB CHECK constraint does not know yet).
   */
  private async replacePermissions(userId: number, permissions: string[]): Promise<void> {
    if (permissions.length > 0) {
      const { error: insertError } = await this.db.from('user_permissions').upsert(
        permissions.map((permission) => ({
          user_id: userId,
          permission,
        })),
        { onConflict: 'user_id,permission', ignoreDuplicates: true },
      );
      if (insertError) {
        throw new Error(`replacePermissions insert failed: ${insertError.message}`);
      }
    }

    let deleteQuery = this.db.from('user_permissions').delete().eq('user_id', userId);
    if (permissions.length > 0) {
      deleteQuery = deleteQuery.not('permission', 'in', `(${permissions.join(',')})`);
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      throw new Error(`replacePermissions delete failed: ${deleteError.message}`);
    }
  }
}
