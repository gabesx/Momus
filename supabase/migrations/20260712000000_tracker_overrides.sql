ALTER TABLE public.bug_budget
  ADD COLUMN IF NOT EXISTS tracker_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bug_budget.tracker_overrides IS
  'Momus Tracker field overrides: keys among parent|linked_issues|severity_issue|service_feature; values {at,by}. Sync must skip those columns.';
