import {
  BugBudgetQueryRepository,
  createServerClient,
  loadSummaryConfig,
} from '@momus/infra';
import {
  applyFilters,
  buildBugBudgetCsv,
  csvExportFilename,
  parseBugBudgetFilters,
  type BugBudgetFilterParams,
} from '@momus/domain';
import { requireViewAnalytics } from '@/lib/auth';
import { jsonFail } from '@/lib/sync-params';
import { bugBudgetParamsFromUrl } from '@/lib/bug-budget-params';

/** Streaming CSV export — D-1 fixed (aligned headers + computed cost). */
export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const url = new URL(request.url);
    const params: BugBudgetFilterParams = {
      ...bugBudgetParamsFromUrl(url),
      sort: url.searchParams.get('sort') ?? 'created_date',
      direction: (url.searchParams.get('direction') as 'asc' | 'desc') ?? 'desc',
      page: 1,
      per_page: 100,
    };

    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);
    const config = await loadSummaryConfig(db);
    const all = await repo.listAllForFilters();
    const parsed = parseBugBudgetFilters(params);
    const filtered = applyFilters(all, parsed).sort((a, b) => {
      const av = a.created_date ?? '';
      const bv = b.created_date ?? '';
      return av < bv ? 1 : av > bv ? -1 : 0;
    });

    const csv = buildBugBudgetCsv(filtered, config.multipliers);
    const filename = csvExportFilename();

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to export CSV';
    return jsonFail(message, 500);
  }
}
