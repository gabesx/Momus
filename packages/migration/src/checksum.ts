import { createHash } from 'node:crypto';
import { checksumLine } from './transform.js';

export type ChecksumRow = {
  jira_key: string;
  updated_date: unknown;
  is_open: unknown;
};

export function computeParityChecksum(rows: ChecksumRow[]): string {
  const lines = rows
    .map((r) => checksumLine(r.jira_key, r.updated_date, r.is_open))
    .sort((a, b) => a.localeCompare(b));
  return createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
}
