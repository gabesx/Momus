-- Ensure PostgREST roles can access public tables/sequences.
-- Tables were created without GRANT SELECT/INSERT/UPDATE/DELETE, so API
-- clients (including service_role) hit "permission denied for table …".
-- RLS still enforces row access for anon/authenticated; service_role bypasses RLS.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;

GRANT USAGE, SELECT, UPDATE
  ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE
  ON SEQUENCES TO anon, authenticated, service_role;
