#!/usr/bin/env node
import { copyBugBudgetTables } from './copy.js';
import { runParallelDiff } from './diff.js';
import { loadEnv } from './env.js';
import { reconcileBugBudget } from './reconcile.js';
import { migrateSettings } from './settings.js';

function parseArgs(argv: string[]) {
  const cmd = argv[2];
  const rest = argv.slice(3).filter((a) => a !== '--');
  const flags = new Set(rest.filter((a) => a.startsWith('--') && !a.includes('=')));
  const yearFlag = rest.find((a) => a.startsWith('--year='));
  return {
    cmd,
    dryRun: flags.has('--dry-run'),
    truncateTarget: flags.has('--truncate-target'),
    skipSyncRuns: flags.has('--skip-sync-runs'),
    skipCron: flags.has('--skip-cron'),
    year: yearFlag ? Number(yearFlag.slice('--year='.length)) : undefined,
  };
}

async function main() {
  const { cmd, dryRun, truncateTarget, skipSyncRuns, skipCron, year } = parseArgs(process.argv);
  const usage = `Usage:
  pnpm --filter @momus/migration copy -- --truncate-target [--dry-run] [--skip-sync-runs] [--skip-cron]
  pnpm --filter @momus/migration reconcile
  pnpm --filter @momus/migration settings -- [--dry-run]
  pnpm --filter @momus/migration diff -- [--year=2026]

Env: LEGACY_MYSQL_* (password required), TARGET_DATABASE_URL
Note: settings never copies jira_api_token — re-enter manually.`;

  if (!cmd || !['copy', 'reconcile', 'settings', 'diff'].includes(cmd)) {
    console.error(usage);
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

  if (cmd === 'reconcile') {
    const report = await reconcileBugBudget({ env });
    if (!report.ok) process.exitCode = 1;
    return;
  }

  if (cmd === 'settings') {
    const result = await migrateSettings({ env, dryRun });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const report = await runParallelDiff({ env, year });
  if (!report.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
