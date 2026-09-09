import { describe, expect, it } from 'vitest';
import { DEFAULT_MENU_VISIBILITY } from '@momus/infra';
import { effectiveMenuFlags } from './menu-visibility';

const DEFAULT = DEFAULT_MENU_VISIBILITY;

describe('effectiveMenuFlags', () => {
  it('module false + empty allowlist → false', () => {
    expect(
      effectiveMenuFlags(
        { ...DEFAULT, defect_analytics: false, allowlist_user_ids: [] },
        9,
      ).show_defect_analytics,
    ).toBe(false);
  });

  it('module false + user on allowlist → true', () => {
    expect(
      effectiveMenuFlags(
        { ...DEFAULT, defect_analytics: false, allowlist_user_ids: [9] },
        9,
      ).show_defect_analytics,
    ).toBe(true);
  });
});
