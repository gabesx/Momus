import { computeParityChecksum } from './checksum.js';
import { PRD_BASELINE_BY_YEAR, PRD_BASELINE_TOTAL } from './columns.js';
import { createLegacyMysql, createTargetPg } from './db.js';
import type { MigrationEnv } from './env.js';
import { toBool, toIsoTimestamp } from './transform.js';

export type ReconcileOptions = {
  env: MigrationEnv;
  log?: (msg: string) => void;
};

export type ReconcileReport = {
  ok: boolean;
  legacyTotal: number;
  targetTotal: number;
  legacyByYear: Record<number, number>;
  targetByYear: Record<number, number>;
  prdBaselineTotal: number;
  prdBaselineByYear: Record<number, number>;
  legacyChecksum: string;
  targetChecksum: string;
  mismatches: string[];
};

export async function reconcileBugBudget(options: ReconcileOptions): Promise<ReconcileReport> {
  const log = options.log ?? console.log;
  const { env } = options;
  const mismatches: string[] = [];

  const mysqlConn = await createLegacyMysql(env);
  const pgClient = createTargetPg(env);
  await pgClient.connect();

  try {
    const [legacyTotalRows] = await mysqlConn.query('SELECT COUNT(*) AS cnt FROM bug_budget');
    const legacyTotal = Number((legacyTotalRows as Array<{ cnt: number }>)[0].cnt);

    const targetTotalRes = await pgClient.query<{ cnt: string }>(
      'SELECT COUNT(*)::int AS cnt FROM bug_budget',
    );
    const targetTotal = Number(targetTotalRes.rows[0].cnt);

    const [legacyYearRaw] = await mysqlConn.query(
      `SELECT created_year, COUNT(*) AS c FROM bug_budget GROUP BY created_year ORDER BY created_year`,
    );
    const legacyByYear: Record<number, number> = {};
    for (const r of legacyYearRaw as { created_year: number; c: number }[]) {
      legacyByYear[Number(r.created_year)] = Number(r.c);
    }

    const targetYearRes = await pgClient.query<{ created_year: number; c: string }>(
      `SELECT created_year, COUNT(*)::int AS c FROM bug_budget GROUP BY created_year ORDER BY created_year`,
    );
    const targetByYear: Record<number, number> = {};
    for (const r of targetYearRes.rows) {
      targetByYear[Number(r.created_year)] = Number(r.c);
    }

    const [legacyChecksumRows] = await mysqlConn.query(
      `SELECT jira_key, updated_date, is_open FROM bug_budget`,
    );
    const legacyChecksum = computeParityChecksum(
      (legacyChecksumRows as { jira_key: string; updated_date: unknown; is_open: unknown }[]).map(
        (r) => ({
          jira_key: r.jira_key,
          updated_date: toIsoTimestamp(r.updated_date) ?? r.updated_date,
          is_open: toBool(r.is_open, false),
        }),
      ),
    );

    const targetChecksumRes = await pgClient.query<{
      jira_key: string;
      updated_date: Date | null;
      is_open: boolean;
    }>(`SELECT jira_key, updated_date, is_open FROM bug_budget`);
    const targetChecksum = computeParityChecksum(
      targetChecksumRes.rows.map((r) => ({
        jira_key: r.jira_key,
        updated_date: r.updated_date ? r.updated_date.toISOString() : '',
        is_open: r.is_open,
      })),
    );

    if (legacyTotal !== targetTotal) {
      mismatches.push(`COUNT(*) legacy=${legacyTotal} target=${targetTotal}`);
    }
    if (legacyTotal !== PRD_BASELINE_TOTAL) {
      mismatches.push(
        `COUNT(*) legacy=${legacyTotal} differs from PRD §11.1 baseline=${PRD_BASELINE_TOTAL} (informational if data grew)`,
      );
    }
    for (const year of new Set([
      ...Object.keys(legacyByYear).map(Number),
      ...Object.keys(targetByYear).map(Number),
    ])) {
      if ((legacyByYear[year] ?? 0) !== (targetByYear[year] ?? 0)) {
        mismatches.push(
          `year ${year}: legacy=${legacyByYear[year] ?? 0} target=${targetByYear[year] ?? 0}`,
        );
      }
    }
    if (legacyChecksum !== targetChecksum) {
      mismatches.push(`checksum mismatch legacy=${legacyChecksum} target=${targetChecksum}`);
    }

    // Hard failures: count, per-year live, checksum. PRD baseline drift is warning-only if live matches.
    const hard = mismatches.filter((m) => !m.includes('PRD §11.1'));
    const ok = hard.length === 0;

    log(JSON.stringify({
      ok,
      legacyTotal,
      targetTotal,
      legacyByYear,
      targetByYear,
      prdBaselineTotal: PRD_BASELINE_TOTAL,
      prdBaselineByYear: PRD_BASELINE_BY_YEAR,
      legacyChecksum,
      targetChecksum,
      mismatches,
    }, null, 2));

    return {
      ok,
      legacyTotal,
      targetTotal,
      legacyByYear,
      targetByYear,
      prdBaselineTotal: PRD_BASELINE_TOTAL,
      prdBaselineByYear: PRD_BASELINE_BY_YEAR,
      legacyChecksum,
      targetChecksum,
      mismatches,
    };
  } finally {
    await mysqlConn.end();
    await pgClient.end();
  }
}
