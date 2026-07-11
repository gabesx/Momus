/** BB-SYNC-07 — decide whether to run sync inline after the HTTP response. */
export function shouldRunInlineSync(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.SYNC_INLINE_AFTER_RESPONSE === 'true') return true;
  if (env.SYNC_INLINE_AFTER_RESPONSE === 'false') return false;
  return env.NODE_ENV !== 'production' && !env.INNGEST_EVENT_KEY;
}
