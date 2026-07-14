-- Configurable delivery roster used by QA ownership reporting.
CREATE TABLE public.roster_members (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  jira_account_id VARCHAR(255),
  discipline VARCHAR(16) NOT NULL CHECK (discipline IN ('QA', 'BE', 'Apps', 'FE', 'Data')),
  tribe VARCHAR(255),
  squad VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roster_members_name_discipline_unique UNIQUE (name, discipline)
);

CREATE TRIGGER roster_members_updated_at
  BEFORE UPDATE ON public.roster_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX roster_members_discipline_name_idx ON public.roster_members (discipline, name);

-- Preserve the existing QA checker list as the initial QA roster.
INSERT INTO public.roster_members (name, discipline)
SELECT name, 'QA' FROM public.qa_checker_names WHERE is_active = true
ON CONFLICT (name, discipline) DO NOTHING;

ALTER TABLE public.roster_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY roster_members_select ON public.roster_members
  FOR SELECT TO authenticated
  USING (public.has_permission('view_analytics') OR public.has_permission('access_settings'));

CREATE POLICY roster_members_write ON public.roster_members
  FOR ALL TO authenticated
  USING (public.has_permission('access_settings'))
  WITH CHECK (public.has_permission('access_settings'));
