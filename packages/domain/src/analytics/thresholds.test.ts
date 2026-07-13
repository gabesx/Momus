import { describe, expect, it } from 'vitest';
import { criticalMajorPctTone, longOverduePctTone } from './thresholds';

describe('risk KPI tones', () => {
  it('criticalMajorPctTone uses 25% danger / 70% of threshold warning', () => {
    expect(criticalMajorPctTone(25)).toBe('danger');
    expect(criticalMajorPctTone(17.5)).toBe('warning'); // 0.7 * 25
    expect(criticalMajorPctTone(10)).toBe('ok');
  });

  it('longOverduePctTone uses 20% danger', () => {
    expect(longOverduePctTone(20)).toBe('danger');
    expect(longOverduePctTone(14)).toBe('warning');
    expect(longOverduePctTone(5)).toBe('ok');
  });
});
