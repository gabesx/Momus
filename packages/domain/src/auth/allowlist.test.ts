import { describe, expect, it } from 'vitest';
import { emailDomain, isEmailAllowlisted, normalizeEmail } from './allowlist';

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Boss@X.com  ')).toBe('boss@x.com');
  });
});

describe('emailDomain', () => {
  it('extracts domain', () => {
    expect(emailDomain('a@AlloFresh.id')).toBe('allofresh.id');
  });

  it('returns null for invalid email', () => {
    expect(emailDomain('not-an-email')).toBe(null);
    expect(emailDomain('@missing.local')).toBe(null);
    expect(emailDomain('missing@')).toBe(null);
  });
});

describe('isEmailAllowlisted', () => {
  it('allows matching domain', () => {
    expect(isEmailAllowlisted('a@AlloFresh.id', ['allofresh.id'], [])).toBe(true);
  });

  it('allows exact email', () => {
    expect(isEmailAllowlisted('Boss@x.com', [], ['boss@x.com'])).toBe(true);
  });

  it('rejects others', () => {
    expect(isEmailAllowlisted('a@gmail.com', ['allofresh.id'], ['boss@x.com'])).toBe(false);
  });
});
