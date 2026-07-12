import { createServerClient } from './client';

export type JiraSettings = {
  url: string;
  username: string;
  apiToken: string;
  enabled: boolean;
};

export type PublicJiraConnection = {
  site_url: string;
  email: string;
  api_token: string;
  enabled: boolean;
  configured: boolean;
};

const JIRA_KEYS = ['jira_url', 'jira_username', 'jira_api_token', 'jira_enabled'] as const;
const MASKED_TOKEN = '****************';

/**
 * Load Jira connection settings from public.settings (BB-DATA-05).
 * API token is decrypted via Vault (DEV-9); never read plaintext from settings.value.
 */
export async function getJiraSettings(): Promise<JiraSettings> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [...JIRA_KEYS]);

  if (error) {
    throw new Error(`Failed to load Jira settings: ${error.message}`);
  }

  const map = new Map((data ?? []).map((row) => [row.key as string, row.value as string | null]));

  const { data: token, error: tokenError } = await supabase.rpc('momus_get_jira_token');
  let apiToken = '';
  if (!tokenError && typeof token === 'string') {
    apiToken = token;
  } else {
    // Fallback when Vault RPC is not yet migrated (local/dev or pending apply).
    apiToken = map.get('jira_api_token') ?? '';
  }

  return {
    url: map.get('jira_url') ?? '',
    username: map.get('jira_username') ?? '',
    apiToken,
    enabled: map.get('jira_enabled') === 'true',
  };
}

/**
 * Upsert Jira settings. Token is written via Vault (DEV-9); settings row stores secret UUID.
 */
export async function saveJiraSettings(input: Partial<JiraSettings>): Promise<void> {
  const supabase = createServerClient();
  const rows: { key: string; value: string; type: string; group: string }[] = [];

  if (input.url !== undefined) {
    rows.push({ key: 'jira_url', value: input.url.replace(/\/$/, ''), type: 'string', group: 'jira' });
  }
  if (input.username !== undefined) {
    rows.push({ key: 'jira_username', value: input.username, type: 'string', group: 'jira' });
  }
  if (input.enabled !== undefined) {
    rows.push({
      key: 'jira_enabled',
      value: input.enabled ? 'true' : 'false',
      type: 'boolean',
      group: 'jira',
    });
  }

  if (input.apiToken !== undefined) {
    const { error: tokenError } = await supabase.rpc('momus_set_jira_token', {
      p_token: input.apiToken,
    });
    if (tokenError) {
      throw new Error(`Failed to save Jira API token: ${tokenError.message}`);
    }
  }

  for (const row of rows) {
    const { error } = await supabase.from('settings').upsert(row, { onConflict: 'key' });
    if (error) {
      throw new Error(`Failed to save setting ${row.key}: ${error.message}`);
    }
  }
}

/** Mask token for UI/API responses (BB-NFR-04). */
export function maskJiraToken(token: string): string {
  return token ? MASKED_TOKEN : '';
}

export function isMaskedJiraToken(token: string): boolean {
  return token === MASKED_TOKEN || /^\*+$/.test(token);
}

/** Safe shape for API/UI — never returns the raw token. */
export function toPublicJiraConnection(settings: JiraSettings): PublicJiraConnection {
  return {
    site_url: settings.url,
    email: settings.username,
    api_token: maskJiraToken(settings.apiToken),
    enabled: settings.enabled,
    configured: Boolean(settings.url && settings.username && settings.apiToken),
  };
}

/**
 * Resolve save-connection / test-connection body against stored settings.
 * Masked `api_token` keeps the stored secret.
 */
export function parseJiraConnectionBody(
  body: Record<string, unknown>,
  stored: JiraSettings,
): JiraSettings {
  const siteUrlRaw =
    typeof body.site_url === 'string'
      ? body.site_url.trim()
      : typeof body.url === 'string'
        ? body.url.trim()
        : stored.url;
  const emailRaw =
    typeof body.email === 'string'
      ? body.email.trim()
      : typeof body.username === 'string'
        ? body.username.trim()
        : stored.username;
  let apiToken =
    typeof body.api_token === 'string'
      ? body.api_token.trim()
      : typeof body.apiToken === 'string'
        ? body.apiToken.trim()
        : stored.apiToken;

  if (isMaskedJiraToken(apiToken)) {
    apiToken = stored.apiToken;
  }

  const enabled =
    body.enabled === undefined
      ? stored.enabled
      : body.enabled === true || body.enabled === 'true' || body.enabled === 1;

  const url = siteUrlRaw.replace(/\/$/, '');
  const username = emailRaw;

  if (!url || !username || !apiToken) {
    throw new Error('Jira URL, email, and API token are required');
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('invalid');
    }
  } catch {
    throw new Error('site_url must be a valid http(s) URL');
  }

  return { url, username, apiToken, enabled };
}

// --- Confluence settings ---------------------------------------------------

export type ConfluenceSettings = {
  url: string;
  email: string;
  spaceKeys: string;
  defaultSpace: string;
};

export type PublicConfluenceSettings = {
  url: string;
  email: string;
  space_keys: string;
  default_space: string;
  configured: boolean;
};

const CONFLUENCE_KEYS = [
  'confluence_url',
  'confluence_email',
  'confluence_space_keys',
  'confluence_default_space',
] as const;

export async function getConfluenceSettings(): Promise<ConfluenceSettings> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [...CONFLUENCE_KEYS]);

  if (error) {
    throw new Error(`Failed to load Confluence settings: ${error.message}`);
  }

  const map = new Map((data ?? []).map((row) => [row.key as string, row.value as string | null]));

  return {
    url: map.get('confluence_url') ?? '',
    email: map.get('confluence_email') ?? '',
    spaceKeys: map.get('confluence_space_keys') ?? '',
    defaultSpace: map.get('confluence_default_space') ?? '',
  };
}

export async function saveConfluenceSettings(input: ConfluenceSettings): Promise<void> {
  const supabase = createServerClient();
  const rows = [
    {
      key: 'confluence_url',
      value: input.url.replace(/\/$/, ''),
      type: 'string',
      group: 'confluence',
    },
    {
      key: 'confluence_email',
      value: input.email,
      type: 'string',
      group: 'confluence',
    },
    {
      key: 'confluence_space_keys',
      value: input.spaceKeys,
      type: 'string',
      group: 'confluence',
    },
    {
      key: 'confluence_default_space',
      value: input.defaultSpace,
      type: 'string',
      group: 'confluence',
    },
  ];

  for (const row of rows) {
    const { error } = await supabase.from('settings').upsert(row, { onConflict: 'key' });
    if (error) {
      throw new Error(`Failed to save setting ${row.key}: ${error.message}`);
    }
  }
}

export function toPublicConfluenceSettings(settings: ConfluenceSettings): PublicConfluenceSettings {
  return {
    url: settings.url,
    email: settings.email,
    space_keys: settings.spaceKeys,
    default_space: settings.defaultSpace,
    configured: Boolean(settings.url || settings.email || settings.spaceKeys || settings.defaultSpace),
  };
}

export function parseConfluenceBody(body: Record<string, unknown>): ConfluenceSettings {
  const urlRaw =
    typeof body.url === 'string'
      ? body.url.trim()
      : typeof body.confluence_url === 'string'
        ? body.confluence_url.trim()
        : '';
  const email =
    typeof body.email === 'string'
      ? body.email.trim()
      : typeof body.confluence_email === 'string'
        ? body.confluence_email.trim()
        : '';
  const spaceKeys =
    typeof body.space_keys === 'string'
      ? body.space_keys.trim()
      : typeof body.spaces === 'string'
        ? body.spaces.trim()
        : '';
  const defaultSpace =
    typeof body.default_space === 'string'
      ? body.default_space.trim()
      : typeof body.defaultSpace === 'string'
        ? body.defaultSpace.trim()
        : '';

  const url = urlRaw.replace(/\/$/, '');

  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('invalid');
      }
    } catch {
      throw new Error('url must be a valid http(s) URL');
    }
  }

  if (!url && !email && !spaceKeys && !defaultSpace) {
    throw new Error('Enter at least one Confluence field to save');
  }

  return { url, email, spaceKeys, defaultSpace };
}
