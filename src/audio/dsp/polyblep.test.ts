import { describe, expect, it } from 'vitest';
import { advance, naiveSaw, polyBlep, polyBlepPulse, polyBlepSaw } from './polyblep';
import { bandEnergy, hann } from './spectrum';

const SR = 48000;

function render(
  osc: (phase: number, dt: number) => number,
  freq: number,
  n: number,
): Float32Array {
  const out = new Float32Array(n);
  const dt = freq / SR;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    out[i] = osc(phase, dt);
    phase = advance(phase, dt);
  }
  return out;
}

describe('polyBlep correction', () => {
  it('is zero away from a discontinuity', () => {
    expect(polyBlep(0.5, 0.01)).toBe(0);
  });

  it('is non-zero within one sample either side of the wrap', () => {
    expect(polyBlep(0.001, 0.01)).not.toBe(0);
    expect(polyBlep(0.999, 0.01)).not.toBe(0);
  });

  it('is inert at zero frequency rather than dividing by zero', () => {
    expect(polyBlep(0.5, 0)).toBe(0);
    expect(Number.isFinite(polyBlep(0, 0))).toBe(true);
  });
});

describe('oscillator output', () => {
  it.each([
    ['saw', polyBlepSaw],
    ['pulse', (p: number, dt: number) => polyBlepPulse(p, dt, 0.5)],
  ])('%s stays finite and bounded across the audible range', (_name, osc) => {
    for (const freq of [20, 110, 440, 2000, 8000, 15000]) {
      const buf = render(osc, freq, 2048);
      for (const s of buf) {
        expect(Number.isFinite(s)).toBe(true);
        // PolyBLEP overshoots slightly at the corners; anything beyond this is a bug.
        expect(Math.abs(s)).toBeLessThanOrEqual(1.6);
      }
    }
  });

  it('produces a saw whose measured period matches the requested frequency', () => {
    const freq = 440;
    const buf = render(polyBlepSaw, freq, SR); // one second
    // Schmitt trigger rather than a bare comparison: polyBLEP deliberately
    // smooths the edge over a couple of samples and overshoots a little, so a
    // naive prev/cur test both misses cycles and double-counts them.
    let cycles = 0;
    let armed = true;
    for (const s of buf) {
      if (armed && s > 0.5) {
        cycles++;
        armed = false;
      } else if (!armed && s < -0.5) {
        armed = true;
      }
    }
    expect(cycles).toBeGreaterThanOrEqual(freq - 2);
    expect(cycles).toBeLessThanOrEqual(freq + 2);
  });

  it('honours pulse width', () => {
    const wide = render((p, dt) => polyBlepPulse(p, dt, 0.9), 200, 4096);
    const narrow = render((p, dt) => polyBlepPulse(p, dt, 0.1), 200, 4096);
    const mean = (b: Float32Array) => b.reduce((a, x) => a + x, 0) / b.length;
    // A 90% duty cycle sits mostly at +1; a 10% one mostly at -1.
    expect(mean(wide)).toBeGreaterThan(0.5);
    expect(mean(narrow)).toBeLessThan(-0.5);
  });
});

describe('anti-aliasing', () => {
  /**
   * The regression test that justifies the whole polyblep module.
   *
   * A correctly band-limited saw at 7 kHz has no energy BELOW its fundamental.
   * A naive saw does: its harmonics above Nyquist fold back down and land at
   * 6 kHz, 1 kHz and so on — inharmonic tones that slide the wrong way as you
   * play up the keyboard, which is the characteristic sound of a cheap softsynth.
   */
  it('suppresses alias energy below the fundamental', () => {
    const FREQ = 7000;
    const N = 8192;

    const naive = hann(render((p) => naiveSaw(p), FREQ, N));
    const blep = hann(render(polyBlepSaw, FREQ, N));

    const naiveAliases = bandEnergy(naive, SR, 300, 6500);
    const blepAliases = bandEnergy(blep, SR, 300, 6500);

    // Both still carry the true fundamental and above; only the region below it
    // distinguishes them, and the improvement there should be large.
    expect(blepAliases).toBeLessThan(naiveAliases / 4);
  });

  it('keeps the fundamental intact while removing the aliases', () => {
    const FREQ = 7000;
    const N = 8192;
    const blep = hann(render(polyBlepSaw, FREQ, N));
    const fundamental = bandEnergy(blep, SR, 6800, 7200);
    const below = bandEnergy(blep, SR, 300, 6500);
    expect(fundamental).toBeGreaterThan(below * 2);
  });

  it('leaves a low note essentially unchanged, where there is nothing to fix', () => {
    const N = 8192;
    const naive = hann(render((p) => naiveSaw(p), 110, N));
    const blep = hann(render(polyBlepSaw, 110, N));
    const naiveEnergy = bandEnergy(naive, SR, 50, 4000);
    const blepEnergy = bandEnergy(blep, SR, 50, 4000);
    // Rounding the corner does remove a little genuine high-harmonic content, so
    // this is a relative check: the low note must survive, not be untouched.
    expect(blepEnergy / naiveEnergy).toBeGreaterThan(0.85);
    expect(blepEnergy / naiveEnergy).toBeLessThan(1.05);
  });
});
