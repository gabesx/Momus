import { describe, expect, it } from 'vitest';
import { trackerParamsFromUrl, trackerParamsToQuery } from './tracker-params';

describe('tracker people/sort params', () => {
  it('round-trips reporter creator owner sort direction', () => {
    const qs = trackerParamsToQuery({
      tab: 'all',
      year: '2026',
      reporter: 'Ann',
      creator: 'Bob',
      owner: 'Unassigned',
      sort: 'jira_key',
      direction: 'desc',
      page: 1,
      page_size: 50,
    });
    const parsed = trackerParamsFromUrl(new URL(`http://x.local${qs}`));
    expect(parsed.reporter).toBe('Ann');
    expect(parsed.creator).toBe('Bob');
    expect(parsed.owner).toBe('Unassigned');
    expect(parsed.sort).toBe('jira_key');
    expect(parsed.direction).toBe('desc');
  });

  it('drops invalid direction and unknown sort', () => {
    const parsed = trackerParamsFromUrl(
      new URL('http://x.local/tracker?year=2026&sort=not_a_col&direction=sideways'),
    );
    expect(parsed.sort).toBeUndefined();
    expect(parsed.direction).toBeUndefined();
  });
});
