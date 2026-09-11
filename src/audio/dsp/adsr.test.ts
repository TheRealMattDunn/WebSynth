import { describe, expect, it } from 'vitest';
import { Adsr, STAGE } from './adsr';

const SR = 48000;
const run = (env: Adsr, samples: number): number => {
  let last = 0;
  for (let i = 0; i < samples; i++) last = env.process();
  return last;
};

describe('Adsr', () => {
  it('is silent and inactive until gated', () => {
    const env = new Adsr(SR);
    expect(env.isActive).toBe(false);
    expect(run(env, 100)).toBe(0);
  });

  it('reaches full level in roughly the attack time', () => {
    const env = new Adsr(SR);
    env.setParams(0.1, 1, 1, 0.1);
    env.gateOn();
    expect(run(env, Math.floor(0.05 * SR))).toBeLessThan(0.9);
    expect(run(env, Math.floor(0.06 * SR))).toBeCloseTo(1, 2);
  });

  it('decays toward the sustain level and holds there', () => {
    const env = new Adsr(SR);
    env.setParams(0.001, 0.05, 0.4, 0.1);
    env.gateOn();
    run(env, Math.floor(0.5 * SR));
    expect(env.currentStage).toBe(STAGE.Sustain);
    expect(env.level).toBeCloseTo(0.4, 3);
    expect(run(env, SR)).toBeCloseTo(0.4, 3);
  });

  it('releases to silence and frees the voice', () => {
    const env = new Adsr(SR);
    env.setParams(0.001, 0.01, 0.8, 0.05);
    env.gateOn();
    run(env, Math.floor(0.1 * SR));
    env.gateOff();
    run(env, Math.floor(0.6 * SR));
    expect(env.level).toBe(0);
    expect(env.isActive).toBe(false);
  });

  it('retriggers from its current level, which is what stops fast notes clicking', () => {
    const env = new Adsr(SR);
    env.setParams(0.2, 1, 1, 0.2);
    env.gateOn();
    run(env, Math.floor(0.1 * SR));
    const beforeRetrigger = env.level;
    expect(beforeRetrigger).toBeGreaterThan(0.2);

    env.gateOn();
    // The very next sample must continue upward, not restart from zero.
    const next = env.process();
    expect(next).toBeGreaterThanOrEqual(beforeRetrigger);
  });

  it('moves in steps small enough to be inaudible as a click', () => {
    const env = new Adsr(SR);
    env.setParams(0.005, 0.1, 0.5, 0.1);
    env.gateOn();
    let prev = 0;
    let biggestJump = 0;
    for (let i = 0; i < SR; i++) {
      if (i === Math.floor(SR / 2)) env.gateOff();
      const v = env.process();
      biggestJump = Math.max(biggestJump, Math.abs(v - prev));
      prev = v;
    }
    // A 5 ms attack climbs ~0.004 per sample; anything near a full-scale jump
    // would be audible as a tick.
    expect(biggestJump).toBeLessThan(0.02);
  });

  it('never produces NaN, even with degenerate parameters', () => {
    const env = new Adsr(SR);
    env.setParams(0, 0, 0, 0);
    env.gateOn();
    for (let i = 0; i < 1000; i++) {
      const v = env.process();
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    env.gateOff();
    for (let i = 0; i < 1000; i++) expect(Number.isFinite(env.process())).toBe(true);
  });

  it('cuts immediately on reset, for voice stealing', () => {
    const env = new Adsr(SR);
    env.setParams(0.001, 1, 1, 5);
    env.gateOn();
    run(env, 1000);
    env.reset();
    expect(env.level).toBe(0);
    expect(env.isActive).toBe(false);
  });
});
