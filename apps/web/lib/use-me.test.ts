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

describe('reloadMe', () => {
  beforeEach(() => {
    clearMeCache();
    vi.mocked(apiJson).mockReset();
  });

  it('clears the cache and refetches updated flags', async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({
      success: true,
      user: meUser,
      flags: { show_defect_analytics: true },
    } as Awaited<ReturnType<typeof apiJson>>);
    await expect(reloadMe()).resolves.toMatchObject({
      flags: { show_defect_analytics: true },
    });

    vi.mocked(apiJson).mockResolvedValueOnce({
      success: true,
      user: meUser,
      flags: { show_defect_analytics: false },
    } as Awaited<ReturnType<typeof apiJson>>);
    await expect(reloadMe()).resolves.toMatchObject({
      flags: { show_defect_analytics: false },
    });

    expect(apiJson).toHaveBeenCalledTimes(2);
    expect(apiJson).toHaveBeenCalledWith('/api/me');
  });

  it('fail-opens flags when /api/me rejects', async () => {
    vi.mocked(apiJson).mockRejectedValueOnce(new Error('network'));
    await expect(reloadMe()).resolves.toEqual({
      user: null,
      flags: { show_defect_analytics: true },
    });
  });
});
