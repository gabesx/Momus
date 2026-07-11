export type FilterOptions = {
  projects: string[];
  statuses: string[];
  issue_types: string[];
  reporters: string[];
  years: number[];
};

export type FilterOptionRow = {
  project?: string | null;
  status?: string | null;
  issue_type?: string | null;
  reporter?: string | null;
  created_year?: number | null;
};

function uniqSortedStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v && v.trim())))].sort((a, b) =>
    a.localeCompare(b),
  );
}

/** Distinct filter dropdown values from the full (unfiltered) row set. */
export function extractFilterOptions(rows: FilterOptionRow[]): FilterOptions {
  return {
    projects: uniqSortedStrings(rows.map((r) => r.project)),
    statuses: uniqSortedStrings(rows.map((r) => r.status)),
    issue_types: uniqSortedStrings(rows.map((r) => r.issue_type)),
    reporters: uniqSortedStrings(rows.map((r) => r.reporter)),
    years: [
      ...new Set(
        rows
          .map((r) => r.created_year)
          .filter((y): y is number => typeof y === 'number' && Number.isFinite(y)),
      ),
    ].sort((a, b) => a - b),
  };
}
