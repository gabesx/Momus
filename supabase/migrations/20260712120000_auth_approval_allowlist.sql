-- approval_status on users (existing rows = approved)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_approval_status_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.users SET approval_status = 'approved' WHERE approval_status IS NULL;

CREATE TABLE IF NOT EXISTS public.auth_allowed_domains (
  domain TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.auth_allowed_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.auth_allowed_domains (domain)
VALUES ('allofresh.id')
ON CONFLICT (domain) DO NOTHING;

ALTER TABLE public.auth_allowed_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_allowed_emails ENABLE ROW LEVEL SECURITY;
