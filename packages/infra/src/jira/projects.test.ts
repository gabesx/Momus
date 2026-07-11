import { describe, expect, it } from 'vitest';
import { mergeProjectSources, type JiraProjectRef } from './projects';

describe('mergeProjectSources', () => {
  it('merges Jira + DB keys and prefers Jira display names', () => {
    const jira: JiraProjectRef[] = [
      { key: 'AO', name: 'Allo Ops' },
      { key: 'FIN', name: 'Finance' },
    ];
    expect(mergeProjectSources(jira, ['AO', 'XTEAM', ''])).toEqual([
      { key: 'AO', name: 'Allo Ops' },
      { key: 'FIN', name: 'Finance' },
      { key: 'XTEAM', name: 'XTEAM' },
    ]);
  });

  it('dedupes case-insensitively by key', () => {
    expect(
      mergeProjectSources([{ key: 'ao', name: 'Ops' }], ['AO']),
    ).toEqual([{ key: 'ao', name: 'Ops' }]);
  });
});
