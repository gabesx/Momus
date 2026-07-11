import {
  BUG_ISSUE_TYPES,
  DEFAULT_EXCLUDED_PROJECTS,
} from '../constants/defaults';

export type ScopeSettings = {
  issueTypes?: readonly string[];
  excludedProjects?: readonly string[];
  /** OQ-1 recommendation: rolling current calendar year. */
  year?: number;
};

/** BB-SCOPE-01: build default JQL from structured settings (DEV-2). */
export function buildDefaultJql(settings: ScopeSettings = {}): string {
  const year = settings.year ?? new Date().getFullYear();
  const types = settings.issueTypes ?? BUG_ISSUE_TYPES;
  const excluded = settings.excludedProjects ?? DEFAULT_EXCLUDED_PROJECTS;

  const typeList = types
    .map((t) => (t.includes(' ') ? `"${t}"` : t))
    .join(', ');

  const parts = [`issuetype IN (${typeList})`];
  if (excluded.length > 0) {
    parts.push(`AND project NOT IN (${excluded.join(', ')})`);
  }
  parts.push(`AND created >= "${year}-01-01" AND created <= "${year}-12-31"`);
  return parts.join('\n');
}

/** BB-SCOPE-02: parse issue types + excluded projects from a JQL string (legacy quirk). */
export function parseScopeFromJql(jql: string): {
  issueTypes: string[];
  excludedProjects: string[];
} {
  const typeMatch = /issuetype\s+IN\s*\(([^)]+)\)/i.exec(jql);
  const projectMatch = /project\s+NOT\s+IN\s*\(([^)]+)\)/i.exec(jql);

  const parseList = (raw: string | undefined, fallback: readonly string[]) => {
    if (!raw) return [...fallback];
    return raw
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  };

  return {
    issueTypes: parseList(typeMatch?.[1], BUG_ISSUE_TYPES),
    excludedProjects: parseList(projectMatch?.[1], DEFAULT_EXCLUDED_PROJECTS),
  };
}

export type RangeSyncType = 'quarterly' | 'monthly' | 'yearly' | 'custom';

/** BB-SCOPE-03: generated range JQLs. */
export function buildRangeJql(input: {
  syncType: RangeSyncType;
  year: number;
  quarter?: 1 | 2 | 3 | 4;
  month?: number;
  jql?: string;
  issueTypes?: readonly string[];
  excludedProjects?: readonly string[];
}): string {
  if (input.syncType === 'custom') {
    return input.jql ?? buildDefaultJql({
      year: input.year,
      issueTypes: input.issueTypes,
      excludedProjects: input.excludedProjects,
    });
  }

  const types = input.issueTypes ?? BUG_ISSUE_TYPES;
  const excluded = input.excludedProjects ?? DEFAULT_EXCLUDED_PROJECTS;
  const typeList = types.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(', ');

  let from: string;
  let to: string;
  if (input.syncType === 'yearly') {
    from = `${input.year}-01-01`;
    to = `${input.year}-12-31`;
  } else if (input.syncType === 'quarterly') {
    const q = input.quarter ?? 1;
    const startMonth = (q - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const endDay = new Date(input.year, endMonth, 0).getDate();
    from = `${input.year}-${String(startMonth).padStart(2, '0')}-01`;
    to = `${input.year}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  } else {
    const month = input.month ?? 1;
    const endDay = new Date(input.year, month, 0).getDate();
    from = `${input.year}-${String(month).padStart(2, '0')}-01`;
    to = `${input.year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  }

  const parts = [`issuetype IN (${typeList})`];
  if (excluded.length > 0) {
    parts.push(`AND project NOT IN (${excluded.join(', ')})`);
  }
  parts.push(`AND created >= "${from}" AND created <= "${to}"`);
  return parts.join(' ');
}

/** True if JQL contains a date filter (orphan cleanup skip). */
export function jqlHasDateFilter(jql: string): boolean {
  return /\b(created|updated|resolved|lastViewed)\s*(>=|<=|>|<|=)/i.test(jql);
}
