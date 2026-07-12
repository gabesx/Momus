import { describe, expect, it } from 'vitest';
import { mapMomusUser } from './auth-map';

describe('mapMomusUser', () => {
  it('maps row + permissions to AuthUser', () => {
    const result = mapMomusUser(
      {
        id: 1,
        email: 'a@x.com',
        name: 'Ann',
        is_candidate: false,
        approval_status: 'approved',
      },
      ['view_analytics', 'access_settings'],
    );
    expect(result).toEqual({
      ok: true,
      user: {
        id: 1,
        email: 'a@x.com',
        name: 'Ann',
        permissions: ['view_analytics', 'access_settings'],
        approvalStatus: 'approved',
      },
    });
  });

  it('rejects missing row', () => {
    expect(mapMomusUser(null, [])).toEqual({
      ok: false,
      reason: 'no_momus_user',
    });
  });

  it('maps candidates with approvalStatus', () => {
    expect(
      mapMomusUser(
        {
          id: 2,
          email: 'c@x.com',
          name: 'Cand',
          is_candidate: true,
          approval_status: 'approved',
        },
        [],
      ),
    ).toEqual({
      ok: true,
      user: {
        id: 2,
        email: 'c@x.com',
        name: 'Cand',
        permissions: [],
        approvalStatus: 'approved',
      },
    });
  });

  it('maps pending users', () => {
    const result = mapMomusUser(
      {
        id: 4,
        email: 'p@x.com',
        name: 'Pat',
        is_candidate: false,
        approval_status: 'pending',
      },
      [],
    );
    expect(result).toMatchObject({
      ok: true,
      user: { approvalStatus: 'pending' },
    });
  });

  it('falls back name to email', () => {
    const result = mapMomusUser(
      {
        id: 3,
        email: 'b@x.com',
        name: null,
        is_candidate: false,
        approval_status: 'approved',
      },
      [],
    );
    expect(result).toMatchObject({ ok: true, user: { name: 'b@x.com' } });
  });
});
