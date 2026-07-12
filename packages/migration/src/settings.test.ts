import { describe, expect, it } from 'vitest';
import {
  TOKEN_REENTRY_CHECKLIST,
  assertLegacyConfigShape,
  collapsePhpAssocNumberPairs,
} from './legacy-config.js';
import { loadLegacyPhpConfig } from './settings.js';

describe('collapsePhpAssocNumberPairs', () => {
  it('keeps last write for duplicate keys (PHP semantics / D-2)', () => {
    expect(
      collapsePhpAssocNumberPairs([
        ['Commercial', 50],
        ['operation', 100],
        ['Commercial', 100],
        ['Operation', 100],
      ]),
    ).toEqual({
      Commercial: 100,
      operation: 100,
      Operation: 100,
    });
  });
});

describe('legacy config fixture', () => {
  it('loads package fixture with expected multipliers', async () => {
    const cfg = await loadLegacyPhpConfig();
    assertLegacyConfigShape(cfg);
    expect(cfg.priority_multipliers.highest).toBe(2);
    expect(cfg.severity_multipliers.critical).toBe(75);
    expect(cfg.project_budgets['Product Catalgue']).toBe(100);
    expect(cfg.excluded_projects).toContain('XTEAM');
  });
});

describe('token checklist', () => {
  it('reminds operators not to copy the API token', () => {
    expect(TOKEN_REENTRY_CHECKLIST.some((l) => /token/i.test(l))).toBe(true);
    expect(TOKEN_REENTRY_CHECKLIST.some((l) => /Vault|encrypted/i.test(l))).toBe(true);
  });
});
