import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiJson: vi.fn(),
}));

import { apiJson } from '@/lib/api-client';
import { clearMeCache, reloadMe } from './use-me';

const meUser = {
  id: 1,
  email: 'a@b.c',
  name: 'A',
  permissions: ['view_analytics'],
};

const ALL_TRUE = {
  show_defect_analytics: true,
  show_defect_tracker: true,
  show_leaderboard: true,
  show_bug_budget: true,
};

describe('reloadMe', () => {
  beforeEach(() => {
    clearMeCache();
    vi.mocked(apiJson).mockReset();
  });

  it('clears the cache and refetches updated flags', async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({
      success: true,
      user: meUser,
      flags: ALL_TRUE,
    } as Awaited<ReturnType<typeof apiJson>>);
    await expect(reloadMe()).resolves.toMatchObject({
      flags: ALL_TRUE,
    });

    vi.mocked(apiJson).mockResolvedValueOnce({
      success: true,
      user: meUser,
      flags: {
        show_defect_analytics: false,
        show_defect_tracker: false,
        show_leaderboard: true,
        show_bug_budget: true,
      },
    } as Awaited<ReturnType<typeof apiJson>>);
    await expect(reloadMe()).resolves.toMatchObject({
      flags: {
        show_defect_analytics: false,
        show_defect_tracker: false,
        show_leaderboard: true,
        show_bug_budget: true,
      },
    });

    expect(apiJson).toHaveBeenCalledTimes(2);
    expect(apiJson).toHaveBeenCalledWith('/api/me');
  });

  it('fail-opens missing flags to true when /api/me succeeds', async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({
      success: true,
      user: meUser,
      flags: { show_defect_analytics: false },
    } as Awaited<ReturnType<typeof apiJson>>);
    await expect(reloadMe()).resolves.toMatchObject({
      flags: {
        show_defect_analytics: false,
        show_defect_tracker: true,
        show_leaderboard: true,
        show_bug_budget: true,
      },
    });
  });

  it('fail-opens flags when /api/me rejects', async () => {
    vi.mocked(apiJson).mockRejectedValueOnce(new Error('network'));
    await expect(reloadMe()).resolves.toEqual({
      user: null,
      flags: ALL_TRUE,
    });
  });
});
