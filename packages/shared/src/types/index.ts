export type SyncStatus = 'queued' | 'running' | 'completed' | 'failed';

/**
 * Single source of truth for permission keys. Kept in sync with the
 * user_permissions CHECK constraint in supabase/migrations — adding a value
 * here without a migration will be rejected at write time.
 */
export type UserPermission =
  | 'view_analytics'
  | 'access_settings'
  | 'manage_users'
  | 'view_executive_reports'
  | 'view_leaderboard';

export const SYNC_STATUS = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const satisfies Record<string, SyncStatus>;

export const USER_PERMISSIONS = {
  VIEW_ANALYTICS: 'view_analytics',
  ACCESS_SETTINGS: 'access_settings',
  MANAGE_USERS: 'manage_users',
  VIEW_EXECUTIVE_REPORTS: 'view_executive_reports',
  VIEW_LEADERBOARD: 'view_leaderboard',
} as const satisfies Record<string, UserPermission>;

/** Every permission value; use for validation instead of a hand-kept list. */
export const ALL_USER_PERMISSIONS: readonly UserPermission[] =
  Object.values(USER_PERMISSIONS);
