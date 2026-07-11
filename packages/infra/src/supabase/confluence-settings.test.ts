import { describe, expect, it } from 'vitest';
import { parseConfluenceBody, toPublicConfluenceSettings } from './settings';

describe('Confluence settings', () => {
  it('parses and normalizes body', () => {
    const parsed = parseConfluenceBody({
      url: 'https://example.atlassian.net/wiki/',
      email: 'a@b.c',
      space_keys: 'IAI, TE',
      default_space: 'IAI',
    });
    expect(parsed).toEqual({
      url: 'https://example.atlassian.net/wiki',
      email: 'a@b.c',
      spaceKeys: 'IAI, TE',
      defaultSpace: 'IAI',
    });
  });

  it('rejects empty payload', () => {
    expect(() => parseConfluenceBody({})).toThrow(/at least one/i);
  });

  it('exposes public shape', () => {
    expect(
      toPublicConfluenceSettings({
        url: 'https://x.atlassian.net/wiki',
        email: 'a@b.c',
        spaceKeys: 'IAI',
        defaultSpace: 'IAI',
      }),
    ).toEqual({
      url: 'https://x.atlassian.net/wiki',
      email: 'a@b.c',
      space_keys: 'IAI',
      default_space: 'IAI',
      configured: true,
    });
  });
});
