import type { MenuVisibility } from '@momus/infra';

export type MenuModule =
  | 'defect_analytics'
  | 'defect_tracker'
  | 'leaderboard'
  | 'bug_budget';

export type MenuFlags = {
  show_defect_analytics: boolean;
  show_defect_tracker: boolean;
  show_leaderboard: boolean;
  show_bug_budget: boolean;
};

function moduleShown(
  visible: boolean,
  allowlist: number[],
  userId: number | null | undefined,
): boolean {
  if (visible) return true;
  if (userId == null) return false;
  return allowlist.includes(userId);
}

/** Resolve per-module nav flags from settings + optional allowlist bypass. */
export function effectiveMenuFlags(
  menu: MenuVisibility,
  userId: number | null | undefined,
): MenuFlags {
  const allowlist = menu.allowlist_user_ids;
  return {
    show_defect_analytics: moduleShown(menu.defect_analytics, allowlist, userId),
    show_defect_tracker: moduleShown(menu.defect_tracker, allowlist, userId),
    show_leaderboard: moduleShown(menu.leaderboard, allowlist, userId),
    show_bug_budget: moduleShown(menu.bug_budget, allowlist, userId),
  };
}
