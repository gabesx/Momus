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
});
