import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Client } from 'pg';
import { createLegacyMysql, createTargetPg } from './db.js';
import type { MigrationEnv } from './env.js';
import {
  MIGRATE_SETTINGS_KEYS,
  TOKEN_REENTRY_CHECKLIST,
  assertLegacyConfigShape,
  type LegacyBugBudgetPhpConfig,
} from './legacy-config.js';

export type MigrateSettingsOptions = {
  env: MigrationEnv;
  dryRun?: boolean;
  /** Absolute path to JSON fixture; defaults to package fixtures/legacy-bugbudget-config.json */
  configPath?: string;
  log?: (msg: string) => void;
};

export type MigrateSettingsResult = {
  dryRun: boolean;
  configKeysUpserted: string[];
  settingsKeysUpserted: string[];
  tokenCopied: false;
  checklist: readonly string[];
};

const DEFAULT_FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/legacy-bugbudget-config.json',
);

export async function loadLegacyPhpConfig(path = DEFAULT_FIXTURE): Promise<LegacyBugBudgetPhpConfig> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown;
  assertLegacyConfigShape(raw);
  return raw;
}

async function upsertConfig(
  client: Client,
  key: string,
  value: unknown,
  description: string,
): Promise<void> {
  await client.query(
    `INSERT INTO bug_budget_config (key, value, description)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       description = EXCLUDED.description,
       updated_at = now()`,
    [key, JSON.stringify(value), description],
  );
}

export async function migrateSettings(
  options: MigrateSettingsOptions,
): Promise<MigrateSettingsResult> {
  const log = options.log ?? console.log;
  const config = await loadLegacyPhpConfig(options.configPath);
  const configKeys = [
    'priority_multipliers',
    'severity_multipliers',
    'project_budgets',
    'project_mappings',
    'excluded_projects',
  ] as const;

  const mysqlConn = await createLegacyMysql(options.env);

  let settingsRows: Array<{ key: string; value: string | null }> = [];
  try {
    const [rows] = await mysqlConn.query(
      `SELECT \`key\`, \`value\` FROM settings WHERE \`key\` IN (?, ?, ?)`,
      [...MIGRATE_SETTINGS_KEYS],
    );
    settingsRows = rows as Array<{ key: string; value: string | null }>;
  } finally {
    await mysqlConn.end();
  }

  log(
    `Loaded PHP config fixture + ${settingsRows.length} non-secret settings keys (token never copied)`,
  );

  if (options.dryRun) {
    log('Dry-run: would upsert bug_budget_config + settings (no token)');
    for (const line of TOKEN_REENTRY_CHECKLIST) log(`  • ${line}`);
    return {
      dryRun: true,
      configKeysUpserted: [...configKeys],
      settingsKeysUpserted: settingsRows.map((r) => r.key),
      tokenCopied: false,
      checklist: TOKEN_REENTRY_CHECKLIST,
    };
  }

  const pgClient = createTargetPg(options.env);
  await pgClient.connect();
  try {
    await pgClient.query('BEGIN');
    await upsertConfig(
      pgClient,
      'priority_multipliers',
      config.priority_multipliers,
      'Migrated from legacy config/bugbudget.php (BB-MIG-03)',
    );
    await upsertConfig(
      pgClient,
      'severity_multipliers',
      config.severity_multipliers,
      'Migrated from legacy config/bugbudget.php (BB-MIG-03)',
    );
    await upsertConfig(
      pgClient,
      'project_budgets',
      config.project_budgets,
      'Migrated from legacy config/bugbudget-projects.php (BB-MIG-03; D-2 keys preserved)',
    );
    await upsertConfig(
      pgClient,
      'project_mappings',
      config.project_mappings,
      'Migrated from legacy config/bugbudget-projects.php (BB-MIG-03)',
    );
    await upsertConfig(
      pgClient,
      'excluded_projects',
      config.excluded_projects,
      'Migrated from legacy config/bugbudget-projects.php (BB-MIG-03)',
    );

    const settingsUpserted: string[] = [];
    for (const row of settingsRows) {
      if (!MIGRATE_SETTINGS_KEYS.includes(row.key as (typeof MIGRATE_SETTINGS_KEYS)[number])) {
        continue;
      }
      const type = row.key === 'jira_enabled' ? 'boolean' : 'string';
      await pgClient.query(
        `INSERT INTO settings (key, value, type, "group", description)
         VALUES ($1, $2, $3, 'jira', $4)
         ON CONFLICT (key) DO UPDATE SET
           value = EXCLUDED.value,
           type = EXCLUDED.type,
           updated_at = now()`,
        [
          row.key,
          row.value ?? '',
          type,
          `Migrated from legacy settings (BB-MIG-03; token excluded)`,
        ],
      );
      settingsUpserted.push(row.key);
      const preview =
        row.key === 'jira_username' && row.value
          ? `${row.value.slice(0, 3)}***`
          : row.key === 'jira_enabled'
            ? String(row.value)
            : row.value
              ? '(set)'
              : '(empty)';
      log(`settings.${row.key} = ${preview}`);
    }

    await pgClient.query('COMMIT');
    log('Settings migration committed');
    log('Manual token re-entry required:');
    for (const line of TOKEN_REENTRY_CHECKLIST) log(`  • ${line}`);

    return {
      dryRun: false,
      configKeysUpserted: [...configKeys],
      settingsKeysUpserted: settingsUpserted,
      tokenCopied: false,
      checklist: TOKEN_REENTRY_CHECKLIST,
    };
  } catch (err) {
    await pgClient.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await pgClient.end();
  }
}
