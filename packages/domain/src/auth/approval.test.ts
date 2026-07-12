import { describe, expect, it } from 'vitest';
import { canAccessApp } from './approval';

describe('canAccessApp', () => {
  it('returns pending when approvalStatus is pending', () => {
    expect(
      canAccessApp({ approvalStatus: 'pending', isCandidate: false }),
    ).toBe('pending');
  });

  it('returns denied when approvalStatus is rejected', () => {
    expect(
      canAccessApp({ approvalStatus: 'rejected', isCandidate: false }),
    ).toBe('denied');
  });

  it('returns denied when isCandidate is true', () => {
    expect(
      canAccessApp({ approvalStatus: 'approved', isCandidate: true }),
    ).toBe('denied');
  });

  it('returns ok when approved and not a candidate', () => {
    expect(
      canAccessApp({ approvalStatus: 'approved', isCandidate: false }),
    ).toBe('ok');
  });

  it('pending takes precedence over isCandidate', () => {
    expect(
      canAccessApp({ approvalStatus: 'pending', isCandidate: true }),
    ).toBe('pending');
  });
});
