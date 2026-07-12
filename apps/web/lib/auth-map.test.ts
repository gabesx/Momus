import { describe, expect, it } from 'vitest';
import { mapMomusUser } from './auth-map';

describe('mapMomusUser', () => {
  it('maps row + permissions to AuthUser', () => {
    const result = mapMomusUser(
      { id: 1, email: 'a@x.com', name: 'Ann', is_candidate: false },
      ['view_analytics', 'access_settings'],
    );
    expect(result).toEqual({
      ok: true,
      user: {
        id: 1,
        email: 'a@x.com',
        name: 'Ann',
        permissions: ['view_analytics', 'access_settings'],
      },
    });
  });

  it('rejects missing row', () => {
    expect(mapMomusUser(null, [])).toEqual({
      ok: false,
      reason: 'no_momus_user',
    });
  });

  it('rejects candidates', () => {
    expect(
      mapMomusUser(
        { id: 2, email: 'c@x.com', name: 'Cand', is_candidate: true },
        [],
      ),
    ).toEqual({ ok: false, reason: 'candidate' });
  });

  it('falls back name to email', () => {
    const result = mapMomusUser(
      { id: 3, email: 'b@x.com', name: null, is_candidate: false },
      [],
    );
    expect(result).toMatchObject({ ok: true, user: { name: 'b@x.com' } });
  });
});
