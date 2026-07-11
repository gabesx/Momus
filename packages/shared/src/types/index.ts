export type SyncStatus = 'queued' | 'running' | 'completed' | 'failed';

export type UserPermission = 'view_analytics' | 'access_settings' | 'manage_users';

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
} as const satisfies Record<string, UserPermission>;
