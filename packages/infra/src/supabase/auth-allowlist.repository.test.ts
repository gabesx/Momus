import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthAllowlistRepository } from './auth-allowlist.repository';

describe('AuthAllowlistRepository', () => {
  it('list returns domains and emails', async () => {
    const db = {
      from: vi.fn((table: string) => {
        if (table === 'auth_allowed_domains') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ domain: 'allofresh.id' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'auth_allowed_emails') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ email: 'admin@allofresh.id' }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const repo = new AuthAllowlistRepository(db);
    await expect(repo.list()).resolves.toEqual({
      domains: ['allofresh.id'],
      emails: ['admin@allofresh.id'],
    });
  });

  it('setAllowlist normalizes, dedupes, and replaces rows', async () => {
    const insertedDomains: unknown[] = [];
    const insertedEmails: unknown[] = [];

    const db = {
      from: vi.fn((table: string) => {
        if (table === 'auth_allowed_domains') {
          return {
            delete: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: vi.fn((rows: unknown[]) => {
              insertedDomains.push(...rows);
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'auth_allowed_emails') {
          return {
            delete: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ error: null }),
            }),
            insert: vi.fn((rows: unknown[]) => {
              insertedEmails.push(...rows);
              return Promise.resolve({ error: null });
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const repo = new AuthAllowlistRepository(db);
    await repo.setAllowlist(
      {
        domains: [' AlloFresh.ID ', 'allofresh.id', ''],
        emails: [' Admin@AlloFresh.ID ', 'admin@allofresh.id'],
      },
      42,
    );

    expect(insertedDomains).toEqual([{ domain: 'allofresh.id', created_by: 42 }]);
    expect(insertedEmails).toEqual([{ email: 'admin@allofresh.id', created_by: 42 }]);
  });
});
