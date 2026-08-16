import type { UserPermission } from '@momus/shared';

/**
 * Ordered by nav position. The first entry a user holds becomes the page we
 * fall back to when they are turned away from somewhere else — so a guard can
 * never redirect someone to a page they also cannot open.
 */
export const LANDING_ROUTES: { path: string; permission: UserPermission }[] = [
  { path: '/', permission: 'view_analytics' },
  { path: '/reports/executive', permission: 'view_executive_reports' },
  { path: '/leaderboard', permission: 'view_leaderboard' },
  { path: '/settings/atlassian', permission: 'access_settings' },
  { path: '/settings/users', permission: 'manage_users' },
];

/** Where to send a user who may not open the page they asked for. */
export function landingPathFor(permissions: string[]): string {
  return (
    LANDING_ROUTES.find((route) => permissions.includes(route.permission))?.path ?? '/no-access'
  );
}
