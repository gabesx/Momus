import { createHash } from 'node:crypto';
import {
  buildBugBudgetCsv,
  buildOpenBugSummary,
  buildOpenDefectSummary,
  type CsvExportRow,
  type SummaryConfig,
  type SummaryIssueInput,
  type SummaryProject,
} from '@momus/domain';
import type { Client } from 'pg';
import { computeParityChecksum } from './checksum.js';
import { createLegacyMysql, createTargetPg } from './db.js';
import type { MigrationEnv } from './env.js';
import { toBool, toDateOnly, toIsoTimestamp } from './transform.js';

export type DiffOptions = {
  env: MigrationEnv;
  year?: number;
  log?: (msg: string) => void;
};

export type DiffReport = {
  ok: boolean;
  mismatches: string[];
  counts: { legacy: number; target: number };
  checksum: { legacy: string; target: string; match: boolean };
  summaries: Record<string, { legacy: string; target: string; match: boolean }>;
  csv: { legacy: string; target: string; match: boolean };
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function fingerprintSummary(projects: SummaryProject[]): string {
  return createHash('sha256').update(stableStringify(projects), 'utf8').digest('hex');
}

function fingerprintCsv(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function loadConfigFromPg(client: Client): Promise<SummaryConfig> {
  const res = await client.query<{ key: string; value: unknown }>(
    `SELECT key, value FROM bug_budget_config
     WHERE key IN ('priority_multipliers','severity_multipliers','project_budgets','project_mappings')`,
  );
  const map = new Map(res.rows.map((r) => [r.key, r.value]));
  return {
    multipliers: {
      priority: (map.get('priority_multipliers') as Record<string, number>) ?? {},
      severity: (map.get('severity_multipliers') as Record<string, number>) ?? {},
    },
    projectBudgets: (map.get('project_budgets') as Record<string, number>) ?? {},
    projectMappings: (map.get('project_mappings') as Record<string, string>) ?? {},
    defaultBudget: 100,
  };
}

function mapSummaryRow(r: Record<string, unknown>): SummaryIssueInput {
  return {
    jira_key: String(r.jira_key),
    project: String(r.project),
    summary: (r.summary as string | null) ?? null,
    priority: (r.priority as string | null) ?? null,
    severity_issue: (r.severity_issue as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    reporter: (r.reporter as string | null) ?? null,
    created_date: r.created_date
      ? toIsoTimestamp(r.created_date) ?? String(r.created_date)
      : null,
    defect_age_days: r.defect_age_days == null ? null : Number(r.defect_age_days),
    is_open: toBool(r.is_open, false),
    final_issue_type: (r.final_issue_type as string | null) ?? null,
    created_year: r.created_year == null ? null : Number(r.created_year),
    epic_name: (r.epic_name as string | null) ?? null,
    parent: (r.parent as string | null) ?? null,
  };
}

function mapCsvRow(r: Record<string, unknown>): CsvExportRow {
  const labels = r.labels;
  let labelArr: string[] | null = null;
  if (Array.isArray(labels)) labelArr = labels.map(String);
  else if (typeof labels === 'string' && labels.trim()) {
    try {
      const parsed = JSON.parse(labels) as unknown;
      labelArr = Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      labelArr = null;
    }
  }
  return {
    jira_key: String(r.jira_key),
    project: String(r.project),
    summary: (r.summary as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    issue_type: (r.issue_type as string | null) ?? null,
    priority: (r.priority as string | null) ?? null,
    assignee_final: (r.assignee_final as string | null) ?? null,
    reporter: (r.reporter as string | null) ?? null,
    created_date: r.created_date
      ? toIsoTimestamp(r.created_date) ?? String(r.created_date)
      : null,
    due_date: toDateOnly(r.due_date),
    end_date: toDateOnly(r.end_date),
    actual_end: r.actual_end ? toIsoTimestamp(r.actual_end) : null,
    resolved_date: r.resolved_date ? toIsoTimestamp(r.resolved_date) : null,
    quarter: (r.quarter as string | null) ?? null,
    labels: labelArr,
    sprint: (r.sprint as string | null) ?? null,
    story_points: r.story_points == null ? null : Number(r.story_points),
    defect_age_days: r.defect_age_days == null ? null : Number(r.defect_age_days),
    severity_issue: (r.severity_issue as string | null) ?? null,
  };
}

const SELECT_DIFF = `
  jira_key, project, summary, priority, severity_issue, status, reporter,
  created_date, defect_age_days, is_open, final_issue_type, created_year,
  epic_name, parent, issue_type, assignee_final, due_date, end_date,
  actual_end, resolved_date, quarter, labels, sprint, story_points, updated_date
`;

export async function runParallelDiff(options: DiffOptions): Promise<DiffReport> {
  const log = options.log ?? console.log;
  const year = options.year ?? new Date().getFullYear();
  const mismatches: string[] = [];

  const mysqlConn = await createLegacyMysql(options.env);
  const pgClient = createTargetPg(options.env);
  await pgClient.connect();

  try {
    const [legacyRowsRaw] = await mysqlConn.query(`SELECT ${SELECT_DIFF} FROM bug_budget`);
    const legacyRows = legacyRowsRaw as Record<string, unknown>[];
    const targetRes = await pgClient.query(`SELECT ${SELECT_DIFF} FROM bug_budget`);
    const targetRows = targetRes.rows as Record<string, unknown>[];

    const legacyTotal = legacyRows.length;
    const targetTotal = targetRows.length;
    if (legacyTotal !== targetTotal) {
      mismatches.push(`COUNT(*) legacy=${legacyTotal} target=${targetTotal}`);
    }

    const legacyChecksum = computeParityChecksum(
      legacyRows.map((r) => ({
        jira_key: String(r.jira_key),
        updated_date: toIsoTimestamp(r.updated_date) ?? r.updated_date,
        is_open: toBool(r.is_open, false),
      })),
    );
    const targetChecksum = computeParityChecksum(
      targetRows.map((r) => ({
        jira_key: String(r.jira_key),
        updated_date: toIsoTimestamp(r.updated_date) ?? r.updated_date ?? '',
        is_open: toBool(r.is_open, false),
      })),
    );
    const checksumMatch = legacyChecksum === targetChecksum;
    if (!checksumMatch) mismatches.push('parity checksum mismatch');

    const config = await loadConfigFromPg(pgClient);
    const legacySummaryInputs = legacyRows.map(mapSummaryRow);
    const targetSummaryInputs = targetRows.map(mapSummaryRow);
    const legacyProjects = [
      ...new Set(legacySummaryInputs.map((r) => r.project).filter(Boolean)),
    ].sort();
    const targetProjects = [
      ...new Set(targetSummaryInputs.map((r) => r.project).filter(Boolean)),
    ].sort();

    const summarySpecs: Array<{ name: string; legacy: SummaryProject[]; target: SummaryProject[] }> =
      [
        {
          name: `open_bug_${year}`,
          legacy: buildOpenBugSummary(legacySummaryInputs, legacyProjects, config, year),
          target: buildOpenBugSummary(targetSummaryInputs, targetProjects, config, year),
        },
        {
          name: 'open_bug_all_years',
          legacy: buildOpenBugSummary(legacySummaryInputs, legacyProjects, config, null),
          target: buildOpenBugSummary(targetSummaryInputs, targetProjects, config, null),
        },
        {
          name: `open_defect_${year}`,
          legacy: buildOpenDefectSummary(legacySummaryInputs, config, year),
          target: buildOpenDefectSummary(targetSummaryInputs, config, year),
        },
        {
          name: 'open_defect_all_years',
          legacy: buildOpenDefectSummary(legacySummaryInputs, config, null),
          target: buildOpenDefectSummary(targetSummaryInputs, config, null),
        },
      ];

    const summaries: DiffReport['summaries'] = {};
    for (const spec of summarySpecs) {
      const lh = fingerprintSummary(spec.legacy);
      const th = fingerprintSummary(spec.target);
      const match = lh === th;
      summaries[spec.name] = { legacy: lh, target: th, match };
      if (!match) mismatches.push(`summary ${spec.name} fingerprint mismatch`);
    }

    const sortCsv = (rows: CsvExportRow[]) =>
      [...rows].sort((a, b) => {
        const av = a.created_date ?? '';
        const bv = b.created_date ?? '';
        return av < bv ? 1 : av > bv ? -1 : a.jira_key.localeCompare(b.jira_key);
      });

    const legacyCsv = fingerprintCsv(
      buildBugBudgetCsv(sortCsv(legacyRows.map(mapCsvRow)), config.multipliers),
    );
    const targetCsv = fingerprintCsv(
      buildBugBudgetCsv(sortCsv(targetRows.map(mapCsvRow)), config.multipliers),
    );
    const csvMatch = legacyCsv === targetCsv;
    if (!csvMatch) mismatches.push('CSV export hash mismatch');

    const report: DiffReport = {
      ok: mismatches.length === 0,
      mismatches,
      counts: { legacy: legacyTotal, target: targetTotal },
      checksum: { legacy: legacyChecksum, target: targetChecksum, match: checksumMatch },
      summaries,
      csv: { legacy: legacyCsv, target: targetCsv, match: csvMatch },
    };
    log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    await mysqlConn.end();
    await pgClient.end();
  }
}
