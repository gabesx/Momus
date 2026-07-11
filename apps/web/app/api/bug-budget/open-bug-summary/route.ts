import {
  BugBudgetQueryRepository,
  createServerClient,
  loadSummaryConfig,
} from '@momus/infra';
import { buildOpenBugSummary } from '@momus/domain';
import { requireViewAnalytics } from '@/lib/auth';
import { jsonFail, jsonOk } from '@/lib/sync-params';

function parseSummaryYear(yearParam: string | null): number | null | { error: string } {
  if (!yearParam || yearParam === 'all') return null;
  const year = Number(yearParam);
  if (!Number.isInteger(year) || year < 2020 || year > 2030) {
    return { error: 'year must be between 2020 and 2030' };
  }
  return year;
}

export async function GET(request: Request) {
  const auth = await requireViewAnalytics();
  if ('error' in auth) return auth.error;

  try {
    const yearParam = new URL(request.url).searchParams.get('year');
    const year = parseSummaryYear(yearParam);
    if (year && typeof year === 'object' && 'error' in year) {
      return jsonFail(year.error, 422);
    }

    const db = createServerClient();
    const repo = new BugBudgetQueryRepository(db);
    const config = await loadSummaryConfig(db);
    const [rows, dbProjects] = await Promise.all([
      repo.listSummaryInputs(year),
      repo.listDistinctProjects(),
    ]);
    const projects = buildOpenBugSummary(rows, dbProjects, config, year);

    return jsonOk({ projects, year: year ?? 'all' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build open bug summary';
    return jsonFail(message, 500);
  }
}
