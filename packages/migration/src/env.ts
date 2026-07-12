export type MigrationEnv = {
  legacyHost: string;
  legacyPort: number;
  legacyDatabase: string;
  legacyUser: string;
  legacyPassword: string;
  targetDatabaseUrl: string;
  batchSize: number;
};

export function loadEnv(env: NodeJS.ProcessEnv = process.env): MigrationEnv {
  const legacyHost = env.LEGACY_MYSQL_HOST ?? '127.0.0.1';
  const legacyPort = Number(env.LEGACY_MYSQL_PORT ?? '3307');
  const legacyDatabase = env.LEGACY_MYSQL_DATABASE ?? 'qara';
  const legacyUser = env.LEGACY_MYSQL_USER ?? 'qara';
  const legacyPassword = env.LEGACY_MYSQL_PASSWORD ?? '';
  const targetDatabaseUrl =
    env.TARGET_DATABASE_URL ??
    env.DATABASE_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54422/postgres';
  const batchSize = Number(env.MIG_BATCH_SIZE ?? '200');

  if (!legacyPassword) {
    throw new Error('LEGACY_MYSQL_PASSWORD is required');
  }
  if (!Number.isFinite(legacyPort) || legacyPort <= 0) {
    throw new Error('LEGACY_MYSQL_PORT must be a positive number');
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error('MIG_BATCH_SIZE must be a positive number');
  }

  return {
    legacyHost,
    legacyPort,
    legacyDatabase,
    legacyUser,
    legacyPassword,
    targetDatabaseUrl,
    batchSize,
  };
}
