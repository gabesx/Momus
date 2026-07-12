import mysql from 'mysql2/promise';
import pg from 'pg';
import type { MigrationEnv } from './env.js';

/** DATE oid — return as 'YYYY-MM-DD' string (avoid JS Date TZ shift). */
pg.types.setTypeParser(pg.types.builtins.DATE, (val) => val);

export function createLegacyMysql(env: MigrationEnv) {
  return mysql.createConnection({
    host: env.legacyHost,
    port: env.legacyPort,
    user: env.legacyUser,
    password: env.legacyPassword,
    database: env.legacyDatabase,
    // Keep temporal values as strings so DATE/DATETIME are not shifted by JS TZ.
    dateStrings: true,
  });
}

export function createTargetPg(env: MigrationEnv) {
  return new pg.Client({ connectionString: env.targetDatabaseUrl });
}
