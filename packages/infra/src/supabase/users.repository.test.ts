import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  UserConflictError,
  UserNotFoundError,
  UsersRepository,
  normalizePermissions,
} from './users.repository';

describe('normalizePermissions', () => {
  it('returns null for non-array input', () => {
    expect(normalizePermissions(null)).toBeNull();
    expect(normalizePermissions(undefined)).toBeNull();
    expect(normalizePermissions('view_analytics')).toBeNull();
    expect(normalizePermissions({ permissions: [] })).toBeNull();
  });

  it('filters unknown permissions', () => {
    expect(
      normalizePermissions(['view_analytics', 'admin', 'access_settings', 42, null]),
    ).toEqual(['view_analytics', 'access_settings']);
  });

  it('dedupes allowed permissions', () => {
    expect(
      normalizePermissions([
        'manage_users',
        'view_analytics',
        'manage_users',
        'view_analytics',
      ]),
    ).toEqual(['manage_users', 'view_analytics']);
  });

  it('returns empty array for empty input', () => {
    expect(normalizePermissions([])).toEqual([]);
  });
});

function makeUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    email: 'user@allofresh.id',
    name: 'Test User',
    is_candidate: false,
    auth_user_id: 'auth-123',
    approval_status: 'pending',
    user_permissions: [],
    ...overrides,
  };
}

function makeUsersTableMock(options: {
  existingByAuthUserId?: ReturnType<typeof makeUserRow> | null;
  insertResult?: ReturnType<typeof makeUserRow>;
}) {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: options.existingByAuthUserId ?? null,
      error: null,
    }),
    single: vi.fn().mockResolvedValue({
      data: options.insertResult ?? makeUserRow(),
      error: null,
    }),
  };

  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: options.insertResult ?? makeUserRow(),
          error: null,
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
    upsert: vi.fn(),
    _selectChain: selectChain,
  };
}

function makeAllowlistDb(options: {
  domains?: string[];
  emails?: string[];
  users?: ReturnType<typeof makeUsersTableMock>;
}) {
  const usersTable = options.users ?? makeUsersTableMock({});

  const db = {
    auth: { admin: { inviteUserByEmail: vi.fn() } },
    from: vi.fn((table: string) => {
      if (table === 'auth_allowed_domains') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: (options.domains ?? []).map((domain) => ({ domain })),
              error: null,
            }),
          }),
        };
      }
      if (table === 'auth_allowed_emails') {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: (options.emails ?? []).map((email) => ({ email })),
              error: null,
            }),
          }),
        };
      }
      if (table === 'users') return usersTable;
      if (table === 'user_permissions') {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;

  return { db, usersTable };
}

describe('UsersRepository', () => {
  it('inviteUser throws UserConflictError when auth reports duplicate email', async () => {
    const db = {
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'A user with this email address has already been registered', status: 422 },
          }),
        },
      },
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const repo = new UsersRepository(db);

    await expect(
      repo.inviteUser({
        email: 'existing@example.com',
        name: 'Existing User',
        permissions: ['view_analytics'],
      }),
    ).rejects.toBeInstanceOf(UserConflictError);
  });

  it('inviteUser throws when permissions are invalid', async () => {
    const db = {
      auth: { admin: { inviteUserByEmail: vi.fn() } },
      from: vi.fn(),
    } as unknown as SupabaseClient;

    const repo = new UsersRepository(db);

    await expect(
      repo.inviteUser({
        email: 'new@example.com',
        name: 'New User',
        permissions: 'view_analytics',
      }),
    ).rejects.toThrow(/invalid permissions/i);
  });

  it('updateUser throws UserNotFoundError when user is missing', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
      }),
    } as unknown as SupabaseClient;

    const repo = new UsersRepository(db);

    await expect(repo.updateUser(99, { is_candidate: true })).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('ensureUser returns not_allowlisted when email is not on allowlist', async () => {
    const { db } = makeAllowlistDb({
      domains: ['other.com'],
      emails: ['allowed@example.com'],
    });

    const repo = new UsersRepository(db);
    const result = await repo.ensureUser({
      authUserId: 'auth-new',
      email: 'user@allofresh.id',
      name: 'New User',
    });

    expect(result).toEqual({ ok: false, reason: 'not_allowlisted' });
  });

  it('ensureUser returns existing user without resetting approval', async () => {
    const existing = makeUserRow({
      id: 7,
      approval_status: 'approved',
      user_permissions: [{ permission: 'view_analytics' }],
    });
    const { db } = makeAllowlistDb({
      domains: ['allofresh.id'],
      users: makeUsersTableMock({ existingByAuthUserId: existing }),
    });

    const repo = new UsersRepository(db);
    const result = await repo.ensureUser({
      authUserId: 'auth-123',
      email: 'user@allofresh.id',
      name: 'Test User',
    });

    expect(result).toEqual({
      ok: true,
      user: {
        id: 7,
        email: 'user@allofresh.id',
        name: 'Test User',
        is_candidate: false,
        auth_user_id: 'auth-123',
        approval_status: 'approved',
        permissions: ['view_analytics'],
      },
    });
  });

  it('ensureUser inserts pending user when allowlisted and new', async () => {
    const inserted = makeUserRow({ approval_status: 'pending' });
    const { db } = makeAllowlistDb({
      domains: ['allofresh.id'],
      users: makeUsersTableMock({ existingByAuthUserId: null, insertResult: inserted }),
    });

    const repo = new UsersRepository(db);
    const result = await repo.ensureUser({
      authUserId: 'auth-new',
      email: 'new@allofresh.id',
      name: 'New User',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.approval_status).toBe('pending');
      expect(result.user.permissions).toEqual([]);
    }
  });

  it('approveUser throws when permissions are invalid', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: makeUserRow({ id: 5, approval_status: 'pending' }),
        error: null,
      }),
    };

    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
      }),
    } as unknown as SupabaseClient;

    const repo = new UsersRepository(db);

    await expect(repo.approveUser(5, 'view_analytics')).rejects.toThrow(/invalid permissions/i);
    await expect(repo.approveUser(5, [])).rejects.toThrow(/invalid permissions/i);
    await expect(repo.approveUser(5, ['admin'])).rejects.toThrow(/invalid permissions/i);
  });

  it('approveUser throws UserNotFoundError when user is missing', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
      }),
    } as unknown as SupabaseClient;

    const repo = new UsersRepository(db);

    await expect(repo.approveUser(99, ['view_analytics'])).rejects.toBeInstanceOf(
      UserNotFoundError,
    );
  });

  it('rejectUser throws UserNotFoundError when user is missing', async () => {
    const selectChain = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(selectChain),
      }),
    } as unknown as SupabaseClient;

    const repo = new UsersRepository(db);

    await expect(repo.rejectUser(99)).rejects.toBeInstanceOf(UserNotFoundError);
  });
});
