-- Add view_executive_reports and view_leaderboard to the permissions checklist (BB-PERM-01)
ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_permission_check;
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_permission_check
  CHECK (permission IN (
    'view_analytics',
    'access_settings',
    'manage_users',
    'view_executive_reports',
    'view_leaderboard'
  ));

-- Grant both new permissions to every existing user by default; admins can revoke per-user later.
INSERT INTO public.user_permissions (user_id, permission)
SELECT id, perm
FROM public.users
CROSS JOIN (VALUES ('view_executive_reports'), ('view_leaderboard')) AS p(perm)
ON CONFLICT (user_id, permission) DO NOTHING;
