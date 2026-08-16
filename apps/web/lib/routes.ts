import type { UserPermission } from '@momus/shared';

export type AppRoute = {
  href: string;
  label: string;
  /** Whether a pathname should highlight this nav item. */
  match: (pathname: string) => boolean;
  permission: UserPermission;
};

/**
 * Single source of truth for page → permission. Drives both the header nav and
 * the fallback redirect, so a page can never be reachable in one and missing
 * from the other. Order is nav order, and doubles as landing priority: the
 * first entry a user holds is where guards send them.
 */
export const APP_ROUTES: AppRoute[] = [
  {
    href: '/',
    label: 'Defect Analytics',
    match: (p) => p === '/',
    permission: 'view_analytics',
  },
  {
    href: '/reports/executive',
    label: 'Executive Report',
    match: (p) => p.startsWith('/reports'),
    permission: 'view_executive_reports',
  },
  {
    href: '/tracker',
    label: 'Defect Tracker',
    match: (p) => p.startsWith('/tracker'),
    permission: 'view_analytics',
  },
  {
    href: '/leaderboard',
    label: 'Leaderboard',
    match: (p) => p.startsWith('/leaderboard'),
    permission: 'view_leaderboard',
  },
  {
    href: '/bug-budget',
    label: 'Bug Budget',
    match: (p) => p.startsWith('/bug-budget'),
    permission: 'view_analytics',
  },
  {
    href: '/settings/users',
    label: 'Users',
    match: (p) => p.startsWith('/settings/users'),
    permission: 'manage_users',
  },
  {
    href: '/settings/atlassian',
    label: 'Settings',
    match: (p) => p.startsWith('/settings') && !p.startsWith('/settings/users'),
    permission: 'access_settings',
  },
];
