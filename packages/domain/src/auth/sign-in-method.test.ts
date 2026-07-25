import { describe, expect, it } from 'vitest';
import { authSignInMethodLabel, classifyAuthSignInMethod } from './sign-in-method';

describe('classifyAuthSignInMethod', () => {
  it('detects Google SSO', () => {
    expect(classifyAuthSignInMethod(['google'])).toBe('google_sso');
    expect(classifyAuthSignInMethod(['Google'])).toBe('google_sso');
  });

  it('detects email/password', () => {
    expect(classifyAuthSignInMethod(['email'])).toBe('email_password');
  });

  it('detects linked Google + email', () => {
    expect(classifyAuthSignInMethod(['google', 'email'])).toBe('both');
  });

  it('returns unknown when empty or unrecognized', () => {
    expect(classifyAuthSignInMethod([])).toBe('unknown');
    expect(classifyAuthSignInMethod(['phone'])).toBe('unknown');
  });
});

describe('authSignInMethodLabel', () => {
  it('returns human labels', () => {
    expect(authSignInMethodLabel('google_sso')).toBe('Google SSO');
    expect(authSignInMethodLabel('email_password')).toBe('Email & password');
    expect(authSignInMethodLabel('both')).toBe('Google SSO + Email');
    expect(authSignInMethodLabel('unknown')).toBe('Unknown');
  });
});
