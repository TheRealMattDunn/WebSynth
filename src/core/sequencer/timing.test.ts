import { describe, expect, it } from 'vitest';
import {
  quantiseTime,
  secondsPerBeat,
  secondsPerStep,
  stepsInWindow,
  stepTime,
  swingOffset,
  wrapStep,
} from './timing';

describe('tempo', () => {
  it('converts bpm to seconds', () => {
    expect(secondsPerBeat(120)).toBe(0.5);
    expect(secondsPerBeat(60)).toBe(1);
    expect(secondsPerStep(120, 4)).toBe(0.125); // sixteenths at 120
  });

  it('refuses to divide by zero on a nonsense tempo', () => {
    expect(Number.isFinite(secondsPerBeat(0))).toBe(true);
    expect(Number.isFinite(secondsPerStep(0, 0))).toBe(true);
  });
});

describe('swing', () => {
  it('never moves the downbeat', () => {
    for (const swing of [0, 0.5, 1]) {
      expect(swingOffset(0, 120, swing)).toBe(0);
      expect(swingOffset(2, 120, swing)).toBe(0);
      expect(swingOffset(4, 120, swing)).toBe(0);
    }
  });

  it('is straight at zero', () => {
    expect(swingOffset(1, 120, 0)).toBe(0);
  });

  it('delays odd steps progressively', () => {
    const half = swingOffset(1, 120, 0.5);
    const full = swingOffset(1, 120, 1);
    expect(half).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(half);
  });

  it('reaches a triplet feel at maximum', () => {
    const bpm = 120;
    const step = secondsPerStep(bpm, 4);
    // The odd step should land two-thirds of the way through the pair.
    const t = stepTime(0, 1, bpm, 1);
    expect(t / (2 * step)).toBeCloseTo(2 / 3, 6);
  });

  it('clamps a swing value outside 0..1', () => {
    expect(swingOffset(1, 120, -5)).toBe(0);
    expect(swingOffset(1, 120, 99)).toBe(swingOffset(1, 120, 1));
  });
});

describe('stepsInWindow', () => {
  it('returns steps in order, once each', () => {
    const steps = stepsInWindow(0, 1, 0, 120, 0);
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.time).toBeGreaterThan(steps[i - 1]!.time);
    }
  });

  it('respects a half-open window so adjacent windows never double-schedule', () => {
    const a = stepsInWindow(0, 0.5, 0, 120, 0);
    const b = stepsInWindow(0.5, 1, 0, 120, 0);
    const all = [...a, ...b].map((s) => s.index);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('loses no steps when a window is walked in small slices', () => {
    const collected: number[] = [];
    const slice = 0.05;
    for (let t = 0; t < 2; t += slice) {
      for (const s of stepsInWindow(t, t + slice, 0, 137, 0.7)) collected.push(s.index);
    }
    expect(new Set(collected).size).toBe(collected.length);
    // 137 bpm, sixteenths, two seconds -> ~18 steps.
    expect(collected.length).toBeGreaterThan(16);
    expect(collected).toEqual([...collected].sort((a, b) => a - b));
  });

  it('still catches a swung step pushed forward across a window edge', () => {
    const bpm = 120;
    const step = secondsPerStep(bpm, 4);
    const swung = stepTime(0, 1, bpm, 1);
    expect(swung).toBeGreaterThan(step); // genuinely pushed past the straight position
    const window = stepsInWindow(step + 0.0001, step + 0.1, 0, bpm, 1);
    expect(window.map((s) => s.index)).toContain(1);
  });

  it('returns nothing for an empty or reversed window', () => {
    expect(stepsInWindow(1, 1, 0, 120)).toEqual([]);
    expect(stepsInWindow(2, 1, 0, 120)).toEqual([]);
  });

  it('never schedules before the origin', () => {
    for (const s of stepsInWindow(-5, 1, 0, 120)) {
      expect(s.index).toBeGreaterThanOrEqual(0);
      expect(s.time).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('wrapStep', () => {
  it('wraps forwards and backwards', () => {
    expect(wrapStep(0, 16)).toBe(0);
    expect(wrapStep(16, 16)).toBe(0);
    expect(wrapStep(17, 16)).toBe(1);
    expect(wrapStep(-1, 16)).toBe(15);
  });

  it('survives a zero length instead of returning NaN', () => {
    expect(Number.isFinite(wrapStep(5, 0))).toBe(true);
  });
});

describe('quantiseTime', () => {
  it('snaps to the nearest step in both directions', () => {
    const bpm = 120; // sixteenth = 0.125s
    expect(quantiseTime(0.13, 0, bpm)).toBeCloseTo(0.125, 9);
    expect(quantiseTime(0.12, 0, bpm)).toBeCloseTo(0.125, 9);
    expect(quantiseTime(0.06, 0, bpm)).toBeCloseTo(0.0, 9);
    expect(quantiseTime(0.07, 0, bpm)).toBeCloseTo(0.125, 9);
  });

  it('leaves an already-quantised time alone', () => {
    expect(quantiseTime(0.5, 0, 120)).toBeCloseTo(0.5, 9);
  });
});
