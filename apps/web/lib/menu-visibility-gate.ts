import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextResponse } from 'next/server';
import { createServerClient, loadAnalyticsSettings } from '@momus/infra';
import { effectiveMenuFlags, type MenuFlags, type MenuModule } from './menu-visibility';
import { jsonFail } from './sync-params';

const ALL_TRUE: MenuFlags = {
  show_defect_analytics: true,
  show_defect_tracker: true,
  show_leaderboard: true,
  show_bug_budget: true,
};

const MODULE_FLAG: Record<MenuModule, keyof MenuFlags> = {
  defect_analytics: 'show_defect_analytics',
  defect_tracker: 'show_defect_tracker',
  leaderboard: 'show_leaderboard',
  bug_budget: 'show_bug_budget',
};

const MODULE_LABEL: Record<MenuModule, string> = {
  defect_analytics: 'Defect Analytics',
  defect_tracker: 'Defect Tracker',
  leaderboard: 'Leaderboard',
  bug_budget: 'Bug Budget',
};

/** Load effective menu flags for a user; fail-open all true on settings errors. */
export async function loadMenuFlagsForUser(
  userId: number,
  db?: SupabaseClient,
): Promise<MenuFlags> {
  try {
    const settings = await loadAnalyticsSettings(db ?? createServerClient());
    return effectiveMenuFlags(settings.menu_visibility, userId);
  } catch {
    return { ...ALL_TRUE };
  }
}

export function moduleDisabledResponse(label: string): NextResponse {
  return jsonFail(`${label} is disabled`, 403);
}

/** null = module visible; otherwise a 403 response. */
export async function assertModuleVisible(
  module: MenuModule,
  userId: number,
): Promise<NextResponse | null> {
  const flags = await loadMenuFlagsForUser(userId);
  if (flags[MODULE_FLAG[module]]) return null;
  return moduleDisabledResponse(MODULE_LABEL[module]);
}
