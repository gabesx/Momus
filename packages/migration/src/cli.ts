#!/usr/bin/env node
import { copyBugBudgetTables } from './copy.js';
import { loadEnv } from './env.js';
import { reconcileBugBudget } from './reconcile.js';

function parseArgs(argv: string[]) {
  const cmd = argv[2];
  const flags = new Set(argv.slice(3).filter((a) => a !== '--'));
  return {
    cmd,
    dryRun: flags.has('--dry-run'),
    truncateTarget: flags.has('--truncate-target'),
    skipSyncRuns: flags.has('--skip-sync-runs'),
    skipCron: flags.has('--skip-cron'),
  };
}

async function main() {
  const { cmd, dryRun, truncateTarget, skipSyncRuns, skipCron } = parseArgs(process.argv);
  if (cmd !== 'copy' && cmd !== 'reconcile') {
    console.error(`Usage:
  pnpm --filter @momus/migration copy -- --truncate-target [--dry-run] [--skip-sync-runs] [--skip-cron]
  pnpm --filter @momus/migration reconcile

Env: LEGACY_MYSQL_HOST (default 127.0.0.1), LEGACY_MYSQL_PORT (3307),
     LEGACY_MYSQL_DATABASE (qara), LEGACY_MYSQL_USER (qara), LEGACY_MYSQL_PASSWORD (required),
     TARGET_DATABASE_URL (default local Momus Supabase on 54422)`);
    process.exit(1);
  }

  const env = loadEnv();

  if (cmd === 'copy') {
    const result = await copyBugBudgetTables({
      env,
      dryRun,
      truncateTarget,
      skipSyncRuns,
      skipCron,
    });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const report = await reconcileBugBudget({ env });
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
