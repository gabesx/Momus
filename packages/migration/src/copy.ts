import type { Client } from 'pg';
import { createLegacyMysql, createTargetPg } from './db.js';
import { BUG_BUDGET_COLUMNS, JSON_COLUMNS } from './columns.js';
import type { MigrationEnv } from './env.js';
import { transformBugBudgetRow } from './transform.js';

export type CopyOptions = {
  env: MigrationEnv;
  dryRun?: boolean;
  truncateTarget?: boolean;
  skipSyncRuns?: boolean;
  skipCron?: boolean;
  log?: (msg: string) => void;
};

/** pg treats JS arrays as PG arrays; stringify so jsonb receives JSON text. */
function pgJsonParam(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

function placeholders(rowCount: number, colCount: number): string {
  const rows: string[] = [];
  for (let r = 0; r < rowCount; r++) {
    const start = r * colCount + 1;
    const cells = Array.from({ length: colCount }, (_, i) => `$${start + i}`);
    rows.push(`(${cells.join(', ')})`);
  }
  return rows.join(',\n');
}

async function resolveFallbackUserId(client: Client): Promise<number> {
  const auto = await client.query<{ id: number }>(
    `SELECT id FROM users WHERE email = 'automated@system' AND is_candidate = false LIMIT 1`,
  );
  if (auto.rows[0]) return auto.rows[0].id;

  const any = await client.query<{ id: number }>(
    `SELECT id FROM users WHERE is_candidate = false ORDER BY id ASC LIMIT 1`,
  );
  if (any.rows[0]) return any.rows[0].id;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO users (email, name, is_candidate)
     VALUES ('automated@system', 'Automated System', false)
     RETURNING id`,
  );
  return inserted.rows[0].id;
}

async function existingUserIds(client: Client): Promise<Set<number>> {
  const res = await client.query<{ id: string | number }>(`SELECT id FROM users`);
  return new Set(res.rows.map((r) => Number(r.id)));
}

export async function copyBugBudgetTables(options: CopyOptions): Promise<{
  bugBudgetCopied: number;
  syncRunsCopied: number;
  cronUpserted: boolean;
}> {
  const log = options.log ?? console.log;
  const { env } = options;

  const mysqlConn = await createLegacyMysql(env);
  const pgClient = createTargetPg(env);
  await pgClient.connect();

  let bugBudgetCopied = 0;
  let syncRunsCopied = 0;
  let cronUpserted = false;

  try {
    const [countRows] = await mysqlConn.query('SELECT COUNT(*) AS cnt FROM bug_budget');
    const total = Number((countRows as Array<{ cnt: number }>)[0]?.cnt ?? 0);
    log(`Legacy bug_budget rows: ${total}`);

    if (options.dryRun) {
      const [syncCount] = await mysqlConn.query('SELECT COUNT(*) AS cnt FROM bug_budget_sync_runs');
      log(
        `Dry-run: would copy ${total} bug_budget + ${Number((syncCount as Array<{ cnt: number }>)[0]?.cnt ?? 0)} sync_runs + cron bug_budget_sync`,
      );
      return { bugBudgetCopied: 0, syncRunsCopied: 0, cronUpserted: false };
    }

    if (!options.truncateTarget) {
      throw new Error('Refusing to copy without --truncate-target (prevents accidental merge)');
    }

    await pgClient.query('BEGIN');
    await pgClient.query('TRUNCATE TABLE bug_budget RESTART IDENTITY CASCADE');
    if (!options.skipSyncRuns) {
      await pgClient.query('TRUNCATE TABLE bug_budget_sync_runs RESTART IDENTITY CASCADE');
    }
    log('Truncated target bug_budget' + (options.skipSyncRuns ? '' : ' + bug_budget_sync_runs'));

    const cols = [...BUG_BUDGET_COLUMNS];
    const colList = cols.map((c) => `"${c}"`).join(', ');

    let lastId = 0;
    for (;;) {
      const [rows] = await mysqlConn.query(
        `SELECT * FROM bug_budget WHERE id > ? ORDER BY id ASC LIMIT ?`,
        [lastId, env.batchSize],
      );
      const batch = rows as Record<string, unknown>[];
      if (batch.length === 0) break;

      const transformed = batch.map((r) => transformBugBudgetRow(r));
      const values: unknown[] = [];
      for (const row of transformed) {
        for (const col of cols) {
          const v = row[col];
          values.push(JSON_COLUMNS.has(col) ? pgJsonParam(v) : v);
        }
      }

      const sql = `INSERT INTO bug_budget (${colList}) VALUES ${placeholders(transformed.length, cols.length)}`;
      await pgClient.query(sql, values);
      bugBudgetCopied += transformed.length;
      lastId = Number(transformed[transformed.length - 1].id);
      log(`Copied bug_budget ${bugBudgetCopied}/${total} (last id=${lastId})`);
    }

    await pgClient.query(
      `SELECT setval(pg_get_serial_sequence('bug_budget', 'id'), COALESCE((SELECT MAX(id) FROM bug_budget), 1))`,
    );

    if (!options.skipSyncRuns) {
      const userIds = await existingUserIds(pgClient);
      const fallbackUserId = await resolveFallbackUserId(pgClient);
      const [syncRows] = await mysqlConn.query(`SELECT * FROM bug_budget_sync_runs ORDER BY id ASC`);
      const syncBatch = syncRows as Record<string, unknown>[];

      for (const row of syncBatch) {
        let requestedBy = Number(row.requested_by);
        if (!userIds.has(requestedBy)) {
          log(`sync_run ${row.id}: requested_by=${requestedBy} missing → ${fallbackUserId}`);
          requestedBy = fallbackUserId;
        }
        await pgClient.query(
          `INSERT INTO bug_budget_sync_runs (
            id, requested_by, sync_type, jql, batch_size, max_total_issues, status,
            total_issues, processed, current_batch, percentage, result, error_message,
            started_at, completed_at, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17
          )`,
          [
            row.id,
            requestedBy,
            row.sync_type ?? 'custom',
            row.jql,
            row.batch_size ?? 50,
            row.max_total_issues ?? 0,
            row.status ?? 'queued',
            row.total_issues ?? 0,
            row.processed ?? 0,
            row.current_batch ?? 0,
            row.percentage ?? 0,
            row.result == null
              ? null
              : typeof row.result === 'string'
                ? row.result
                : JSON.stringify(row.result),
            row.error_message,
            row.started_at,
            row.completed_at,
            row.created_at,
            row.updated_at,
          ],
        );
        syncRunsCopied += 1;
      }
      await pgClient.query(
        `SELECT setval(pg_get_serial_sequence('bug_budget_sync_runs', 'id'), COALESCE((SELECT MAX(id) FROM bug_budget_sync_runs), 1))`,
      );
      log(`Copied sync_runs: ${syncRunsCopied}`);
    }

    if (!options.skipCron) {
      const [cronRows] = await mysqlConn.query(
        `SELECT * FROM cron_schedules WHERE name = 'bug_budget_sync' LIMIT 1`,
      );
      const cron = (cronRows as Record<string, unknown>[])[0];
      if (!cron) {
        log('No legacy cron_schedules row named bug_budget_sync — skipped');
      } else {
        const params =
          cron.command_params == null
            ? null
            : typeof cron.command_params === 'string'
              ? cron.command_params
              : JSON.stringify(cron.command_params);
        await pgClient.query(
          `INSERT INTO cron_schedules (
            name, command, schedule_type, interval_days, time, day_of_week, day_of_month,
            is_active, description, command_params, last_run_at, next_run_at,
            last_run_result, last_run_status, created_at, updated_at
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16
          )
          ON CONFLICT (name) DO UPDATE SET
            command = EXCLUDED.command,
            schedule_type = EXCLUDED.schedule_type,
            interval_days = EXCLUDED.interval_days,
            time = EXCLUDED.time,
            day_of_week = EXCLUDED.day_of_week,
            day_of_month = EXCLUDED.day_of_month,
            is_active = EXCLUDED.is_active,
            description = EXCLUDED.description,
            command_params = EXCLUDED.command_params,
            last_run_at = EXCLUDED.last_run_at,
            next_run_at = EXCLUDED.next_run_at,
            last_run_result = EXCLUDED.last_run_result,
            last_run_status = EXCLUDED.last_run_status,
            updated_at = EXCLUDED.updated_at`,
          [
            cron.name,
            cron.command,
            cron.schedule_type ?? 'daily',
            cron.interval_days ?? 1,
            cron.time ?? '00:00',
            cron.day_of_week,
            cron.day_of_month,
            cron.is_active == null ? true : Boolean(Number(cron.is_active)),
            cron.description,
            params,
            cron.last_run_at,
            cron.next_run_at,
            cron.last_run_result,
            cron.last_run_status,
            cron.created_at,
            cron.updated_at,
          ],
        );
        cronUpserted = true;
        log('Upserted cron_schedules.bug_budget_sync');
      }
    }

    await pgClient.query('COMMIT');
    log('Copy committed');
  } catch (err) {
    await pgClient.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await mysqlConn.end();
    await pgClient.end();
  }

  return { bugBudgetCopied, syncRunsCopied, cronUpserted };
}
