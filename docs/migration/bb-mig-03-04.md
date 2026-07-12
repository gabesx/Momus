# BB-MIG-03 / BB-MIG-04 — Settings + parallel-run diffs

## MIG-03 — Settings

Copies multipliers / budgets / mappings / exclusions into `bug_budget_config`, and non-secret Jira keys (`jira_url`, `jira_username`, `jira_enabled`) into `settings`.

**Never copies `jira_api_token`.** Re-enter in Momus Settings (Vault).

```bash
export LEGACY_MYSQL_PASSWORD=…
pnpm mig:settings -- --dry-run
pnpm mig:settings
```

At cutover only (legacy): `DROP TABLE bug_budget_settings;` (D-4).

Fixture source: `packages/migration/fixtures/legacy-bugbudget-config.json` (from `config/bugbudget*.php`, PHP last-wins for D-2 dup keys).

## MIG-04 — Parallel-run diff

After both systems sync the same JQL, compare MySQL ↔ Momus:

- row count + parity checksum
- Open Bug / Open Defect summary fingerprints (current year + all years)
- CSV export body hash (unfiltered, `created_date` desc)

```bash
pnpm mig:diff -- --year=2026
```

Exit code `1` if any hard mismatch. Run daily during the 1–2 week parallel window.

Temporal values are read as strings from MySQL (`dateStrings: true`) and Postgres `DATE` as `YYYY-MM-DD` to avoid JS timezone day-shifts. Re-run `mig:copy -- --truncate-target` after pulling this change if an older copy was loaded.
