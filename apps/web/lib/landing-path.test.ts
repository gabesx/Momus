import { describe, expect, it } from 'vitest';
import { ALL_USER_PERMISSIONS } from '@momus/shared';
import { LANDING_ROUTES, landingPathFor } from './landing-path';

describe('landingPathFor', () => {
  it('sends analytics users to the dashboard', () => {
    expect(landingPathFor(['view_analytics', 'view_leaderboard'])).toBe('/');
  });

  it('falls back to the first page the user can actually open', () => {
    expect(landingPathFor(['view_leaderboard'])).toBe('/leaderboard');
    expect(landingPathFor(['manage_users'])).toBe('/settings/users');
    expect(landingPathFor(['view_executive_reports'])).toBe('/reports/executive');
  });

  it('sends a user with no permissions to /no-access', () => {
    expect(landingPathFor([])).toBe('/no-access');
  });

  it('ignores permissions it does not know', () => {
    expect(landingPathFor(['something_else'])).toBe('/no-access');
  });

  /**
   * The redirect-loop guard: whatever we send a user to must itself be a page
   * they hold the permission for, otherwise its own gate bounces them again.
   */
  it('never returns a page the user cannot open', () => {
    for (const permission of ALL_USER_PERMISSIONS) {
      const target = landingPathFor([permission]);
      const route = LANDING_ROUTES.find((r) => r.path === target);
      expect(route, `no landing route for ${permission}`).toBeDefined();
      expect([permission]).toContain(route?.permission);
    }
  });

  it('covers every permission, so no one is stranded on /no-access', () => {
    for (const permission of ALL_USER_PERMISSIONS) {
      expect(landingPathFor([permission])).not.toBe('/no-access');
    }
  });
});
