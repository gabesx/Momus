import {
  BugBudgetQueryRepository,
  createServerClient,
  loadSummaryConfig,
} from '@momus/infra';
import { buildOpenDefectSummary } from '@momus/domain';
import { requireViewAnalytics } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const yearParam = new URL(request.url).searchParams.get('year');
    const year =
      yearParam && yearParam !== 'all' ? Number(yearParam) : new Date().getFullYear();
    if (!Number.isInteger(year) || year < 2020 || year > 2030) {
      return jsonFail('year must be between 2020 and 2030', 422);
    }

    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);
    const config = await loadSummaryConfig(db);
    const rows = await repo.listSummaryInputs(year);
    const projects = buildOpenDefectSummary(rows, config, year);

    return jsonOk({ projects, year });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build open defect summary';
    return jsonFail(message, 500);
  }
}
