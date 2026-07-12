-- Automated system user for cron-triggered Bug Budget sync runs (PRD §4.4)

INSERT INTO public.users (email, name, is_candidate)
SELECT 'automated@system', 'Automated System', false
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE email = 'automated@system' AND is_candidate = false
);

INSERT INTO public.user_permissions (user_id, permission)
SELECT u.id, p.perm
FROM public.users u
CROSS JOIN (VALUES ('view_analytics'), ('access_settings')) AS p(perm)
WHERE u.email = 'automated@system' AND u.is_candidate = false
ON CONFLICT (user_id, permission) DO NOTHING;
