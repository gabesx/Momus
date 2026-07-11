import { describe, expect, it } from 'vitest';
import { extractFilterOptions } from './filter-options';

describe('extractFilterOptions', () => {
  it('returns sorted unique projects, statuses, issue_types, reporters, years', () => {
    const opts = extractFilterOptions([
      {
        project: 'B',
        status: 'Open',
        issue_type: 'Bug',
        reporter: 'bob',
        created_year: 2025,
      },
      {
        project: 'A',
        status: 'Done',
        issue_type: 'Defect',
        reporter: 'ann',
        created_year: 2024,
      },
      {
        project: 'A',
        status: 'Open',
        issue_type: 'Bug',
        reporter: null,
        created_year: 2025,
      },
    ]);
    expect(opts.projects).toEqual(['A', 'B']);
    expect(opts.statuses).toEqual(['Done', 'Open']);
    expect(opts.issue_types).toEqual(['Bug', 'Defect']);
    expect(opts.reporters).toEqual(['ann', 'bob']);
    expect(opts.years).toEqual([2024, 2025]);
  });
});
