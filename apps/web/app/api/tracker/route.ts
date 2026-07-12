import {
  applyTrackerFilters,
  extractFilterOptions,
  type TrackerTab,
} from '@momus/domain';
import { TrackerRepository, createServerClient, getJiraSettings } from '@momus/infra';
import { requireViewAnalytics } from '@/lib/auth';
import { trackerParamsFromUrl } from '@/lib/tracker-params';
import { jsonFail, jsonOk } from '@/lib/sync-params';

const TAB_KEYS: TrackerTab[] = ['all', 'missing_fields', 'no_linked_test'];

function scopeHint(params: ReturnType<typeof trackerParamsFromUrl>): string {
  if (params.year && params.year !== 'all') {
    return `Showing tracker data for year ${params.year}`;
  }
  if (params.project) {
    return `Showing tracker data for project ${params.project}`;
  }
  return 'Showing all bugs and defects in the tracker';
}

/** Defect Tracker list: filtered rows, tab counts, filter options. */
export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const params = trackerParamsFromUrl(new URL(request.url));
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 50;

    const repo = new TrackerRepository(createServerClient());
    const all = await repo.listForFilters();

    const opts = extractFilterOptions(all);
    const filter_options = {
      projects: opts.projects,
      years: opts.years,
    };

    const baseParams = { ...params, tab: undefined as TrackerTab | undefined };
    const tab_counts = Object.fromEntries(
      TAB_KEYS.map((tab) => [
        tab,
        applyTrackerFilters(all, { ...baseParams, tab }).length,
      ]),
    ) as Record<TrackerTab, number>;

    const filtered = applyTrackerFilters(all, params);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);

    let jiraBrowseBase = '';
    try {
      const jira = await getJiraSettings();
      jiraBrowseBase = jira.url ? `${jira.url.replace(/\/$/, '')}/browse` : '';
    } catch {
      jiraBrowseBase = '';
    }

    return jsonOk({
      rows,
      total,
      page,
      page_size: pageSize,
      tab_counts,
      filter_options,
      jira_browse_base: jiraBrowseBase,
      meta: { scope_hint: scopeHint(params) },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load tracker data', 500);
  }
}
