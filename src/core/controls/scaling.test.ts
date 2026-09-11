import { describe, expect, it } from 'vitest';
import {
  asHertz,
  asMilliseconds,
  asOneOf,
  asPercent,
  clamp,
  fromNormalised,
  quantise,
  toNormalised,
} from './scaling';
import type { ControlSpec } from './types';

const spec = (over: Partial<ControlSpec>): ControlSpec => ({
  id: 'x',
  label: 'X',
  min: 0,
  max: 1,
  default: 0,
  curve: 'lin',
  format: String,
  ...over,
});

describe('fromNormalised', () => {
  it('maps a linear control across its full range', () => {
    const s = spec({ min: -12, max: 12 });
    expect(fromNormalised(s, 0)).toBe(-12);
    expect(fromNormalised(s, 1)).toBe(12);
    expect(fromNormalised(s, 0.5)).toBe(0);
  });

  it('maps an exponential control geometrically', () => {
    const s = spec({ min: 20, max: 20000, curve: 'exp' });
    expect(fromNormalised(s, 0)).toBeCloseTo(20);
    expect(fromNormalised(s, 1)).toBeCloseTo(20000);
    // Halfway along the fader is the geometric mean, not the arithmetic one —
    // that is the whole point of the curve.
    expect(fromNormalised(s, 0.5)).toBeCloseTo(Math.sqrt(20 * 20000));
    expect(fromNormalised(s, 0.5)).not.toBeCloseTo((20 + 20000) / 2);
  });

  it('gives an exponential control equal ratios for equal movement', () => {
    const s = spec({ min: 20, max: 20480, curve: 'exp' });
    const a = fromNormalised(s, 0.25);
    const b = fromNormalised(s, 0.5);
    const c = fromNormalised(s, 0.75);
    expect(b / a).toBeCloseTo(c / b, 6);
  });

  it('clamps travel outside 0..1', () => {
    const s = spec({ min: 5, max: 10 });
    expect(fromNormalised(s, -3)).toBe(5);
    expect(fromNormalised(s, 42)).toBe(10);
  });
});

describe('toNormalised', () => {
  it('inverts the linear curve', () => {
    const s = spec({ min: -50, max: 50 });
    for (const t of [0, 0.1, 0.5, 0.9, 1]) {
      expect(toNormalised(s, fromNormalised(s, t))).toBeCloseTo(t, 9);
    }
  });

  it('inverts the exponential curve', () => {
    const s = spec({ min: 0.001, max: 8, curve: 'exp' });
    for (const t of [0, 0.2, 0.5, 0.77, 1]) {
      expect(toNormalised(s, fromNormalised(s, t))).toBeCloseTo(t, 9);
    }
  });

  it('clamps values outside the parameter range', () => {
    const s = spec({ min: 2, max: 4 });
    expect(toNormalised(s, -100)).toBe(0);
    expect(toNormalised(s, 100)).toBe(1);
  });

  it('does not divide by zero on a degenerate range', () => {
    const s = spec({ min: 3, max: 3 });
    expect(toNormalised(s, 3)).toBe(0);
  });
});

describe('stepped controls', () => {
  const s = spec({ min: 0, max: 3, curve: 'stepped', steps: 4 });

  it('lands exactly on each step and round-trips', () => {
    for (const value of [0, 1, 2, 3]) {
      expect(quantise(s, value)).toBe(value);
      expect(fromNormalised(s, toNormalised(s, value))).toBe(value);
    }
  });

  it('covers every step across the fader travel', () => {
    const seen = new Set<number>();
    for (let t = 0; t <= 1.0001; t += 0.01) seen.add(fromNormalised(s, t));
    expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
  });

  it('snaps an in-between value to the nearest step', () => {
    expect(quantise(s, 1.4)).toBe(1);
    expect(quantise(s, 1.6)).toBe(2);
  });
});

describe('formatters', () => {
  it('formats percentages, frequencies, times, and names', () => {
    expect(asPercent(0.125)).toBe('13%');
    expect(asHertz(440)).toBe('440');
    expect(asHertz(1200)).toBe('1.20k');
    expect(asHertz(12000)).toBe('12.0k');
    expect(asMilliseconds(0.005)).toBe('5ms');
    expect(asMilliseconds(2.5)).toBe('2.50s');
    expect(asOneOf(['SAW', 'SQR'])(0)).toBe('SAW');
    expect(asOneOf(['SAW', 'SQR'])(1)).toBe('SQR');
  });

  it('clamps a name lookup rather than returning undefined', () => {
    expect(asOneOf(['SAW', 'SQR'])(99)).toBe('SQR');
    expect(asOneOf(['SAW', 'SQR'])(-5)).toBe('SAW');
  });
});

describe('clamp', () => {
  it('bounds on both sides and passes through the middle', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
});
