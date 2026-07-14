export type JiraCredentials = {
  baseUrl: string;
  email: string;
  apiToken: string;
};

export type JiraSearchPage = {
  issues: Record<string, unknown>[];
  nextPageToken?: string;
  isLast: boolean;
};

export type JiraIdentity = {
  displayName: string;
  accountId?: string;
  emailAddress?: string;
};

export type JiraTeam = { id: string; name: string };
export type JiraTeamMember = { name: string; accountId: string | null };

export class JiraApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'JiraApiError';
  }
}

const DEFAULT_FIELDS = [
  'key',
  'project',
  'summary',
  'description',
  'assignee',
  'status',
  'created',
  'updated',
  'resolutiondate',
  'duedate',
  'issuetype',
  'priority',
  'labels',
  'reporter',
  'creator',
  'parent',
  'components',
  'fixVersions',
  'timetracking',
  'issuelinks',
  'customfield_10069',
  'customfield_10042',
  'customfield_10014',
  'customfield_10011',
  'customfield_10016',
  'customfield_10029',
  'customfield_10020',
  'customfield_10076',
  'customfield_10015',
  'customfield_10056',
  'customfield_10008',
  'customfield_10024',
  'customfield_10043',
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function authHeader(creds: JiraCredentials): string {
  const token = Buffer.from(`${creds.email}:${creds.apiToken}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * BB-SYNC-01 — Jira Cloud REST v3 client (read-only).
 */
export class JiraClient {
  constructor(
    private readonly creds: JiraCredentials,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private url(path: string): string {
    return `${this.creds.baseUrl.replace(/\/$/, '')}${path}`;
  }

  private async request<T>(path: string, init: RequestInit & { retry?: number } = {}): Promise<T> {
    const retry = init.retry ?? 0;
    const { retry: _r, ...rest } = init;
    const res = await this.fetchFn(this.url(path), {
      ...rest,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: authHeader(this.creds),
        ...(rest.headers ?? {}),
      },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '60');
      if (retry < 3) {
        await sleep(retryAfter * 1000);
        return this.request<T>(path, { ...init, retry: retry + 1 });
      }
      throw new JiraApiError('Jira rate limited (429)', 429, retryAfter);
    }

    if (res.status >= 500 && retry < 2) {
      await sleep(1000 * (retry + 1));
      return this.request<T>(path, { ...init, retry: retry + 1 });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new JiraApiError(
        `Jira request failed (${res.status}): ${body.slice(0, 300)}`,
        res.status,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Connection test — authenticated identity. */
  async testConnection(): Promise<JiraIdentity> {
    const me = await this.request<{
      displayName?: string;
      accountId?: string;
      emailAddress?: string;
    }>('/rest/api/3/myself');
    return {
      displayName: me.displayName ?? 'Unknown',
      accountId: me.accountId,
      emailAddress: me.emailAddress,
    };
  }

  /** Approximate issue count for a JQL. */
  async approximateCount(jql: string): Promise<number> {
    const data = await this.request<{ count?: number }>('/rest/api/3/search/approximate-count', {
      method: 'POST',
      body: JSON.stringify({ jql }),
    });
    return data.count ?? 0;
  }

  /**
   * Token-paginated JQL search. maxResults capped at 100.
   */
  async searchPage(input: {
    jql: string;
    maxResults?: number;
    nextPageToken?: string;
    fields?: string[];
  }): Promise<JiraSearchPage> {
    const maxResults = Math.min(Math.max(input.maxResults ?? 50, 1), 100);
    const data = await this.request<{
      issues?: Record<string, unknown>[];
      nextPageToken?: string;
      isLast?: boolean;
    }>('/rest/api/3/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql: input.jql,
        maxResults,
        fields: input.fields ?? DEFAULT_FIELDS,
        ...(input.nextPageToken ? { nextPageToken: input.nextPageToken } : {}),
      }),
    });

    const issues = data.issues ?? [];
    return {
      issues,
      nextPageToken: data.nextPageToken,
      isLast: data.isLast ?? !data.nextPageToken,
    };
  }

  /** Collect all issue keys for orphan cleanup (key-only fields). */
  async fetchAllKeys(jql: string, pageSize = 100): Promise<string[]> {
    const keys: string[] = [];
    let nextPageToken: string | undefined;
    for (let page = 0; page < 500; page++) {
      const result = await this.searchPage({
        jql,
        maxResults: pageSize,
        nextPageToken,
        fields: ['key'],
      });
      for (const issue of result.issues) {
        if (typeof issue.key === 'string') keys.push(issue.key);
      }
      if (result.isLast || !result.nextPageToken) break;
      nextPageToken = result.nextPageToken;
    }
    return keys;
  }

  /**
   * List projects visible to the authenticated user (paginated project search).
   * Used by Project Budget & Mapping “Fetch from Jira”.
   */
  async listProjects(): Promise<{ key: string; name: string }[]> {
    const projects: { key: string; name: string }[] = [];
    let startAt = 0;
    const maxResults = 50;

    for (let page = 0; page < 100; page++) {
      const data = await this.request<{
        values?: { key?: string; name?: string }[];
        isLast?: boolean;
        total?: number;
      }>(`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`);

      for (const p of data.values ?? []) {
        if (typeof p.key === 'string' && p.key.trim()) {
          projects.push({ key: p.key.trim(), name: (p.name ?? p.key).trim() || p.key });
        }
      }

      if (data.isLast || !data.values?.length) break;
      startAt += maxResults;
      if (typeof data.total === 'number' && startAt >= data.total) break;
    }

    return projects.sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Atlassian Teams for this connection. With an organization ID (the UUID
   * from admin.atlassian.com/o/{orgId}/teams) it uses the Teams Public API
   * via the site gateway — the only Teams surface Jira Cloud exposes. The
   * legacy `/rest/teams/1.0` path is kept for Data Center sites.
   */
  async listTeams(orgId?: string): Promise<JiraTeam[]> {
    if (orgId) return this.listCloudTeams(orgId);
    try {
      const data = await this.request<{ values?: unknown[]; teams?: unknown[] }>(
        '/rest/teams/1.0/team?startAt=0&maxResults=100',
      );
      const raw = data.values ?? data.teams ?? [];
      return raw
        .flatMap((value) => {
          const team = value as { id?: string | number; name?: string; displayName?: string };
          const id = team.id == null ? '' : String(team.id);
          const name = (team.name ?? team.displayName ?? '').trim();
          return id && name ? [{ id, name }] : [];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      if (err instanceof JiraApiError && (err.status === 404 || err.status === 410)) {
        throw new Error(
          'This Jira site only exposes Teams through the organization API — ' +
            'enter your Atlassian organization ID (the UUID in the ' +
            'admin.atlassian.com/o/…/teams URL) and try again.',
        );
      }
      throw err;
    }
  }

  /** Teams Public API: all teams in the organization, cursor-paginated. */
  private async listCloudTeams(orgId: string): Promise<JiraTeam[]> {
    const teams: JiraTeam[] = [];
    let cursor: string | undefined;
    for (;;) {
      const qs = new URLSearchParams({ size: '100' });
      if (cursor) qs.set('cursor', cursor);
      const data = await this.request<{
        entities?: Array<{ teamId?: string; displayName?: string }>;
        cursor?: string;
      }>(`/gateway/api/public/teams/v1/org/${encodeURIComponent(orgId)}/teams?${qs.toString()}`);
      const entities = data.entities ?? [];
      for (const team of entities) {
        // teamId may arrive as a plain UUID or an ARI ("ari:cloud:identity::team/<uuid>").
        const id = team.teamId?.split('/').pop()?.trim();
        const name = team.displayName?.trim();
        if (id && name) teams.push({ id, name });
      }
      if (!data.cursor || entities.length === 0) break;
      cursor = data.cursor;
    }
    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Members of a single team (Teams Public API with orgId, else Data Center). */
  async listTeamMembers(teamId: string, orgId?: string): Promise<JiraTeamMember[]> {
    if (orgId) return this.listCloudTeamMembers(orgId, teamId);
    const data = await this.request<{ values?: unknown[]; members?: unknown[] }>(
      `/rest/teams/1.0/team/${encodeURIComponent(teamId)}/member?startAt=0&maxResults=100`,
    );
    return (data.values ?? data.members ?? []).flatMap((value) => {
      const member = value as {
        displayName?: string;
        name?: string;
        accountId?: string;
        account_id?: string;
        user?: { displayName?: string; accountId?: string };
      };
      const name = (member.displayName ?? member.name ?? member.user?.displayName ?? '').trim();
      const accountId = member.accountId ?? member.account_id ?? member.user?.accountId ?? null;
      return name ? [{ name, accountId }] : [];
    });
  }

  /** Teams Public API members (account ids) resolved to display names. */
  private async listCloudTeamMembers(orgId: string, teamId: string): Promise<JiraTeamMember[]> {
    const accountIds: string[] = [];
    let after: string | undefined;
    for (;;) {
      const data = await this.request<{
        results?: Array<{ accountId?: string }>;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string };
      }>(
        `/gateway/api/public/teams/v1/org/${encodeURIComponent(orgId)}/teams/` +
          `${encodeURIComponent(teamId)}/members`,
        { method: 'POST', body: JSON.stringify({ first: 50, ...(after ? { after } : {}) }) },
      );
      const results = data.results ?? [];
      for (const member of results) {
        if (member.accountId) accountIds.push(member.accountId);
      }
      if (!data.pageInfo?.hasNextPage || !data.pageInfo.endCursor || results.length === 0) break;
      after = data.pageInfo.endCursor;
    }
    return this.resolveAccountNames(accountIds);
  }

  /** Bulk-resolve account ids to display names (apps/bots excluded). */
  private async resolveAccountNames(accountIds: string[]): Promise<JiraTeamMember[]> {
    const members: JiraTeamMember[] = [];
    for (let i = 0; i < accountIds.length; i += 50) {
      const chunk = accountIds.slice(i, i + 50);
      const qs = new URLSearchParams({ maxResults: '50' });
      for (const id of chunk) qs.append('accountId', id);
      const data = await this.request<{
        values?: Array<{ accountId?: string; displayName?: string; accountType?: string }>;
      }>(`/rest/api/3/user/bulk?${qs.toString()}`);
      for (const user of data.values ?? []) {
        const name = user.displayName?.trim();
        if (!name) continue;
        if (user.accountType && user.accountType !== 'atlassian') continue;
        members.push({ name, accountId: user.accountId ?? null });
      }
    }
    return members;
  }

  /**
   * Load select-list options for a custom field (Field Options API).
   * Returns enabled option values only.
   */
  async getFieldOptions(fieldId: string): Promise<{ id: string; value: string }[]> {
    const contexts = await this.request<{
      values?: { id?: string | number }[];
    }>(`/rest/api/3/field/${encodeURIComponent(fieldId)}/context`);

    const contextId = contexts.values?.[0]?.id;
    if (contextId == null) return [];

    const options: { id: string; value: string }[] = [];
    let startAt = 0;
    const maxResults = 100;

    for (let page = 0; page < 50; page++) {
      const data = await this.request<{
        values?: { id?: string | number; value?: string; disabled?: boolean }[];
        isLast?: boolean;
        total?: number;
      }>(
        `/rest/api/3/field/${encodeURIComponent(fieldId)}/context/${encodeURIComponent(String(contextId))}/option?startAt=${startAt}&maxResults=${maxResults}`,
      );

      for (const opt of data.values ?? []) {
        if (opt.disabled === true) continue;
        const value = typeof opt.value === 'string' ? opt.value.trim() : '';
        if (!value) continue;
        options.push({ id: String(opt.id ?? value), value });
      }

      if (data.isLast || !data.values?.length) break;
      startAt += maxResults;
      if (typeof data.total === 'number' && startAt >= data.total) break;
    }

    return options;
  }
}

export function assertJiraEnabled(settings: {
  enabled: boolean;
  url: string;
  username: string;
  apiToken: string;
}): void {
  if (!settings.enabled || !settings.url || !settings.username || !settings.apiToken) {
    throw new Error('Jira integration is disabled or incomplete');
  }
}
