-- DEV-9 / BB-NFR-04: Jira API token at rest via Supabase Vault
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

CREATE OR REPLACE FUNCTION public.momus_jira_token_is_uuid(p_value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

/**
 * Store plaintext Jira token in Vault; settings.jira_api_token holds secret UUID (or '').
 * service_role only.
 */
CREATE OR REPLACE FUNCTION public.momus_set_jira_token(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_current text;
  v_id uuid;
  v_token text := coalesce(p_token, '');
BEGIN
  SELECT s.value INTO v_current
  FROM public.settings s
  WHERE s.key = 'jira_api_token';

  IF v_token = '' THEN
    UPDATE public.settings
    SET value = '',
        updated_at = now()
    WHERE key = 'jira_api_token';
    IF NOT FOUND THEN
      INSERT INTO public.settings (key, value, type, "group", description)
      VALUES (
        'jira_api_token',
        '',
        'secret',
        'jira',
        'Jira API token (Vault secret UUID; empty if unset)'
      );
    END IF;
    RETURN;
  END IF;

  IF v_current IS NOT NULL AND public.momus_jira_token_is_uuid(v_current) THEN
    PERFORM vault.update_secret(v_current::uuid, v_token);
    UPDATE public.settings
    SET updated_at = now()
    WHERE key = 'jira_api_token';
  ELSE
    v_id := vault.create_secret(
      v_token,
      NULL,
      'Jira API token for Momus Bug Budget'
    );
    INSERT INTO public.settings (key, value, type, "group", description)
    VALUES (
      'jira_api_token',
      v_id::text,
      'secret',
      'jira',
      'Jira API token (Vault secret UUID; empty if unset)'
    )
    ON CONFLICT (key) DO UPDATE
    SET value = excluded.value,
        type = 'secret',
        "group" = 'jira',
        description = excluded.description,
        updated_at = now();
  END IF;
END;
$$;

/**
 * Decrypt Jira token for server-side use. Returns '' if unset/orphan.
 * service_role only.
 */
CREATE OR REPLACE FUNCTION public.momus_get_jira_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_current text;
  v_plain text;
BEGIN
  SELECT s.value INTO v_current
  FROM public.settings s
  WHERE s.key = 'jira_api_token';

  IF v_current IS NULL OR v_current = '' THEN
    RETURN '';
  END IF;

  IF NOT public.momus_jira_token_is_uuid(v_current) THEN
    -- Legacy plaintext until migrate runs (should be rare after this migration)
    RETURN v_current;
  END IF;

  SELECT d.decrypted_secret INTO v_plain
  FROM vault.decrypted_secrets d
  WHERE d.id = v_current::uuid;

  RETURN coalesce(v_plain, '');
END;
$$;

REVOKE ALL ON FUNCTION public.momus_jira_token_is_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.momus_set_jira_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.momus_get_jira_token() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.momus_jira_token_is_uuid(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.momus_set_jira_token(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.momus_get_jira_token() TO service_role;

-- One-time: move non-empty plaintext tokens into Vault (idempotent)
DO $$
DECLARE
  v_current text;
  v_id uuid;
BEGIN
  SELECT s.value INTO v_current
  FROM public.settings s
  WHERE s.key = 'jira_api_token';

  IF v_current IS NULL OR v_current = '' THEN
    RETURN;
  END IF;

  IF public.momus_jira_token_is_uuid(v_current) THEN
    RETURN;
  END IF;

  v_id := vault.create_secret(
    v_current,
    NULL,
    'Jira API token for Momus Bug Budget (migrated from plaintext)'
  );

  UPDATE public.settings
  SET value = v_id::text,
      type = 'secret',
      description = 'Jira API token (Vault secret UUID; empty if unset)',
      updated_at = now()
  WHERE key = 'jira_api_token';
END;
$$;
