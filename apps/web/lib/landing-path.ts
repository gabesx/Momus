import { APP_ROUTES } from './routes';
import type { MenuFlags } from './menu-visibility';

/** Map product hrefs to menu flags; reports/settings always count as shown. */
function isShown(href: string, flags: Partial<MenuFlags>): boolean {
  if (href === '/') return flags.show_defect_analytics !== false;
  if (href === '/tracker') return flags.show_defect_tracker !== false;
  if (href === '/leaderboard') return flags.show_leaderboard !== false;
  if (href === '/bug-budget') return flags.show_bug_budget !== false;
  return true;
}

/** Where to send a user who may not open the page they asked for. */
export function landingPathFor(
  permissions: string[],
  options?: { flags?: Partial<MenuFlags> },
): string {
  const flags = options?.flags ?? {};
  return (
    APP_ROUTES.find(
      (route) => isShown(route.href, flags) && permissions.includes(route.permission),
    )?.href ?? '/no-access'
  );
}
