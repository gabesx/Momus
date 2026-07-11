import { describe, expect, it } from 'vitest';
import { calculateCost } from './cost';
import {
  DEFAULT_PRIORITY_MULTIPLIERS,
  DEFAULT_SEVERITY_MULTIPLIERS,
} from '../constants/defaults';

describe('BB-CALC-01: calculateCost', () => {
  const multipliers = {
    priority: DEFAULT_PRIORITY_MULTIPLIERS,
    severity: DEFAULT_SEVERITY_MULTIPLIERS,
  };

  it('returns 150 for Highest + Critical', () => {
    expect(calculateCost('Highest', 'Critical', multipliers)).toBe(150);
  });

  it('returns 1.25 for Medium + Minor', () => {
    expect(calculateCost('Medium', 'Minor', multipliers)).toBe(1.25);
  });

  it('falls back to multiplier 1 for null/unknown priority or severity', () => {
    expect(calculateCost(null, 'Critical', multipliers)).toBe(75);
    expect(calculateCost('Highest', null, multipliers)).toBe(2);
    expect(calculateCost('Nope', 'Critical', multipliers)).toBe(75);
    expect(calculateCost(null, null, multipliers)).toBe(1);
  });

  it('is case-insensitive on priority and severity keys', () => {
    expect(calculateCost('highest', 'critical', multipliers)).toBe(150);
  });
});
