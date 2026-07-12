import {
  applyTrackerFilters,
  countTrackerProjects,
  extractFilterOptions,
  TRACKER_MISSING_FIELD_KEYS,
  TRACKER_MISSING_FIELD_LABELS,
  type TrackerMissingFieldKey,
  type TrackerTab,
} from '@momus/domain';
import {
  TrackerRepository,
  createServerClient,
  getJiraSettings,
  getTrackerExcludedFields,
} from '@momus/infra';
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

function formatFreshness(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Defect Tracker list: filtered rows, tab counts, filter options. */
export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const params = trackerParamsFromUrl(new URL(request.url));
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 50;
    const excluded_fields = await getTrackerExcludedFields();
    const withExcluded = { ...params, excluded_fields };

    const repo = new TrackerRepository(createServerClient());
    const all = await repo.listForFilters();

    const opts = extractFilterOptions(all);
    const defaultYear = Number(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
      }).format(new Date()),
    );
    const yearsDesc = [...new Set([...opts.years, defaultYear])].sort((a, b) => b - a);

    const missing_field_options = TRACKER_MISSING_FIELD_KEYS.filter(
      (key) => !excluded_fields.includes(key),
    ).map((key) => ({
      value: key,
      label: TRACKER_MISSING_FIELD_LABELS[key as TrackerMissingFieldKey],
    }));

    const filter_options = {
      projects: opts.projects,
      years: yearsDesc,
      missing_fields: missing_field_options,
    };

    const baseParams = { ...withExcluded, tab: undefined as TrackerTab | undefined };
    const tab_counts = Object.fromEntries(
      TAB_KEYS.map((tab) => [
        tab,
        applyTrackerFilters(all, { ...baseParams, tab }).length,
      ]),
    ) as Record<TrackerTab, number>;

    const filtered = applyTrackerFilters(all, withExcluded);
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const rows = filtered.slice(start, start + pageSize);
    // Project chips always show Incomplete Fields counts (legacy parity).
    const project_counts = countTrackerProjects(all, {
      ...withExcluded,
      tab: 'missing_fields',
    });
    const nowIso = new Date().toISOString();

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
      project_counts,
      filter_options,
      excluded_fields,
      jira_browse_base: jiraBrowseBase,
      meta: {
        scope_hint: scopeHint(params),
        last_updated: nowIso,
        last_updated_label: formatFreshness(nowIso),
      },
    });
  } catch (err) {
    return jsonFail(err instanceof Error ? err.message : 'Failed to load tracker data', 500);
  }
}
