export type JiraProjectRef = {
  key: string;
  name: string;
};

/** Union Jira project list with DB-discovered keys; Jira name wins on key clash. */
export function mergeProjectSources(
  fromJira: JiraProjectRef[],
  fromDb: string[],
): JiraProjectRef[] {
  const byKey = new Map<string, JiraProjectRef>();

  for (const p of fromJira) {
    const key = p.key.trim();
    if (!key) continue;
    byKey.set(key.toUpperCase(), { key, name: (p.name || key).trim() || key });
  }

  for (const raw of fromDb) {
    const key = raw.trim();
    if (!key) continue;
    const id = key.toUpperCase();
    if (!byKey.has(id)) {
      byKey.set(id, { key, name: key });
    }
  }

  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}
