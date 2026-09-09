import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_ANALYTICS_SETTINGS, DEFAULT_MENU_VISIBILITY } from '@momus/infra';

vi.mock('@momus/infra', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@momus/infra')>();
  return {
    ...actual,
    createServerClient: vi.fn(),
    loadAnalyticsSettings: vi.fn(),
  };
});

import { loadAnalyticsSettings } from '@momus/infra';
import {
  assertModuleVisible,
  loadMenuFlagsForUser,
  moduleDisabledResponse,
} from './menu-visibility-gate';

const ALL_TRUE = {
  show_defect_analytics: true,
  show_defect_tracker: true,
  show_leaderboard: true,
  show_bug_budget: true,
};

describe('loadMenuFlagsForUser', () => {
  it('fail-opens to all true when load throws', async () => {
    vi.mocked(loadAnalyticsSettings).mockRejectedValue(new Error('db down'));
    expect(await loadMenuFlagsForUser(9, {} as never)).toEqual(ALL_TRUE);
  });

  it('hides module when false and user not on allowlist', async () => {
    vi.mocked(loadAnalyticsSettings).mockResolvedValue({
      ...DEFAULT_ANALYTICS_SETTINGS,
      menu_visibility: {
        ...DEFAULT_MENU_VISIBILITY,
        defect_analytics: false,
        allowlist_user_ids: [],
      },
    });
    expect(await loadMenuFlagsForUser(9, {} as never)).toMatchObject({
      show_defect_analytics: false,
    });
  });

  it('shows module when false but user is on allowlist', async () => {
    vi.mocked(loadAnalyticsSettings).mockResolvedValue({
      ...DEFAULT_ANALYTICS_SETTINGS,
      menu_visibility: {
        ...DEFAULT_MENU_VISIBILITY,
        defect_analytics: false,
        allowlist_user_ids: [9],
      },
    });
    expect(await loadMenuFlagsForUser(9, {} as never)).toMatchObject({
      show_defect_analytics: true,
    });
  });
});

describe('moduleDisabledResponse', () => {
  it('returns 403 with module label', async () => {
    const res = moduleDisabledResponse('Defect Analytics');
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      success: false,
      message: 'Defect Analytics is disabled',
    });
  });
});

describe('assertModuleVisible', () => {
  it('returns null when module is visible', async () => {
    vi.mocked(loadAnalyticsSettings).mockResolvedValue(DEFAULT_ANALYTICS_SETTINGS);
    expect(await assertModuleVisible('defect_analytics', 1)).toBeNull();
  });

  it('returns 403 when module is hidden', async () => {
    vi.mocked(loadAnalyticsSettings).mockResolvedValue({
      ...DEFAULT_ANALYTICS_SETTINGS,
      menu_visibility: {
        ...DEFAULT_MENU_VISIBILITY,
        leaderboard: false,
        allowlist_user_ids: [],
      },
    });
    const denied = await assertModuleVisible('leaderboard', 1);
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(403);
    await expect(denied!.json()).resolves.toEqual({
      success: false,
      message: 'Leaderboard is disabled',
    });
  });
});
