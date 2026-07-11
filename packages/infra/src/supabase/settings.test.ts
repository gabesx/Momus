import { describe, expect, it } from 'vitest';
import {
  maskJiraToken,
  parseJiraConnectionBody,
  toPublicJiraConnection,
} from '../supabase/settings';

describe('parseJiraConnectionBody', () => {
  const stored = {
    url: 'https://example.atlassian.net',
    username: 'old@example.com',
    apiToken: 'secret-token',
    enabled: false,
  };

  it('accepts full payload and normalizes URL', () => {
    const parsed = parseJiraConnectionBody(
      {
        site_url: 'https://allofresh.atlassian.net/',
        email: 'qa@allofresh.com',
        api_token: 'new-token',
        enabled: true,
      },
      stored,
    );
    expect(parsed).toEqual({
      url: 'https://allofresh.atlassian.net',
      username: 'qa@allofresh.com',
      apiToken: 'new-token',
      enabled: true,
    });
  });

  it('keeps stored token when masked placeholder is sent', () => {
    const parsed = parseJiraConnectionBody(
      {
        site_url: 'https://allofresh.atlassian.net',
        email: 'qa@allofresh.com',
        api_token: '****************',
        enabled: true,
      },
      stored,
    );
    expect(parsed.apiToken).toBe('secret-token');
  });

  it('falls back to stored fields when omitted', () => {
    const parsed = parseJiraConnectionBody({ enabled: true }, stored);
    expect(parsed).toEqual({
      url: stored.url,
      username: stored.username,
      apiToken: stored.apiToken,
      enabled: true,
    });
  });

  it('rejects incomplete connection', () => {
    expect(() =>
      parseJiraConnectionBody(
        { site_url: '', email: '', api_token: '' },
        { url: '', username: '', apiToken: '', enabled: false },
      ),
    ).toThrow(/required/i);
  });
});

describe('toPublicJiraConnection', () => {
  it('masks the API token', () => {
    expect(
      toPublicJiraConnection({
        url: 'https://x.atlassian.net',
        username: 'a@b.c',
        apiToken: 'real-secret',
        enabled: true,
      }),
    ).toEqual({
      site_url: 'https://x.atlassian.net',
      email: 'a@b.c',
      api_token: maskJiraToken('real-secret'),
      enabled: true,
      configured: true,
    });
  });

  it('marks unconfigured when token missing', () => {
    expect(
      toPublicJiraConnection({
        url: 'https://x.atlassian.net',
        username: '',
        apiToken: '',
        enabled: false,
      }).configured,
    ).toBe(false);
  });
});
