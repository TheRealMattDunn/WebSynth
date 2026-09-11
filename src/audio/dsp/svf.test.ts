import { describe, expect, it } from 'vitest';
import { softClip, Svf } from './svf';

const SR = 48000;

/** Gain of the filter at one frequency, measured rather than derived. */
function gainAt(cutoff: number, resonance: number, freq: number): number {
  const filter = new Svf(SR);
  filter.set(cutoff, resonance);
  const n = SR; // a full second, so the filter settles before we measure
  let sumIn = 0;
  let sumOut = 0;
  for (let i = 0; i < n; i++) {
    const input = Math.sin((2 * Math.PI * freq * i) / SR);
    const output = filter.processLowpass(input);
    if (i > n / 2) {
      sumIn += input * input;
      sumOut += output * output;
    }
  }
  return Math.sqrt(sumOut / sumIn);
}

describe('Svf lowpass', () => {
  it('passes frequencies well below cutoff', () => {
    expect(gainAt(4000, 0, 100)).toBeCloseTo(1, 1);
  });

  it('attenuates frequencies well above cutoff', () => {
    expect(gainAt(500, 0, 8000)).toBeLessThan(0.05);
  });

  it('rolls off monotonically past the corner', () => {
    const g1 = gainAt(1000, 0, 2000);
    const g2 = gainAt(1000, 0, 4000);
    const g3 = gainAt(1000, 0, 8000);
    expect(g2).toBeLessThan(g1);
    expect(g3).toBeLessThan(g2);
  });

  it('sits near -3 dB at the corner frequency', () => {
    expect(gainAt(1000, 0, 1000)).toBeGreaterThan(0.5);
    expect(gainAt(1000, 0, 1000)).toBeLessThan(0.9);
  });

  it('peaks at the corner as resonance rises', () => {
    expect(gainAt(1000, 0.9, 1000)).toBeGreaterThan(gainAt(1000, 0, 1000) * 3);
  });

  it('stays stable at extreme settings instead of blowing up', () => {
    for (const cutoff of [1, 10, 20, 18000, 23999, 96000]) {
      for (const res of [0, 0.5, 1]) {
        const filter = new Svf(SR);
        filter.set(cutoff, res);
        let peak = 0;
        for (let i = 0; i < 4096; i++) {
          const out = filter.processLowpass(Math.random() * 2 - 1);
          expect(Number.isFinite(out)).toBe(true);
          peak = Math.max(peak, Math.abs(out));
        }
        expect(peak).toBeLessThan(100);
      }
    }
  });

  it('clears its state on reset', () => {
    const filter = new Svf(SR);
    filter.set(800, 0.8);
    for (let i = 0; i < 500; i++) filter.processLowpass(1);
    filter.reset();
    expect(filter.processLowpass(0)).toBe(0);
  });

  it('flushes decaying state to zero rather than drifting into denormals', () => {
    const filter = new Svf(SR);
    filter.set(2000, 0);
    for (let i = 0; i < 200; i++) filter.processLowpass(1);
    let out = 0;
    for (let i = 0; i < 20000; i++) out = filter.processLowpass(0);
    expect(out).toBe(0);
  });
});

describe('softClip', () => {
  it('is roughly linear for small signals', () => {
    expect(softClip(0)).toBe(0);
    expect(softClip(0.1)).toBeCloseTo(0.1, 2);
  });

  it('saturates rather than wrapping or exploding', () => {
    expect(softClip(100)).toBe(1);
    expect(softClip(-100)).toBe(-1);
    for (const x of [-50, -3, -1, 0, 1, 3, 50]) {
      expect(Math.abs(softClip(x))).toBeLessThanOrEqual(1);
    }
  });

  it('is monotonic and odd-symmetric', () => {
    let prev = -Infinity;
    for (let x = -5; x <= 5; x += 0.1) {
      const y = softClip(x);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
      expect(softClip(-x)).toBeCloseTo(-y, 9);
    }
  });
});
