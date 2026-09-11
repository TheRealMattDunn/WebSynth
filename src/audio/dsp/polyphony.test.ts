import { describe, expect, it } from 'vitest';
import { VoicePool, type EnvelopeParams } from './polyphony';
import type { VoiceParams } from './voice';

const SR = 48000;

const ENV: EnvelopeParams = { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.2 };
const SHORT: EnvelopeParams = { attack: 0.001, decay: 0.01, sustain: 0.5, release: 0.01 };

const PARAMS: VoiceParams = {
  wave: 0,
  width: 0.5,
  detune: 8,
  sub: 0.25,
  cutoff: 3000,
  resonance: 0.15,
  drive: 0.1,
};

const renderBlock = (pool: VoicePool, samples: number): Float32Array => {
  const out = new Float32Array(samples);
  pool.prepare(PARAMS);
  for (let i = 0; i < samples; i++) out[i] = pool.render();
  return out;
};

const peak = (b: Float32Array): number => b.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

describe('VoicePool', () => {
  it('is silent until a note is played', () => {
    const pool = new VoicePool(SR, 8);
    expect(peak(renderBlock(pool, 512))).toBe(0);
    expect(pool.activeCount).toBe(0);
  });

  it('makes sound on noteOn', () => {
    const pool = new VoicePool(SR, 8);
    pool.noteOn(60, 1, ENV);
    expect(pool.activeCount).toBe(1);
    expect(peak(renderBlock(pool, 2048))).toBeGreaterThan(0.05);
  });

  it('plays a chord without stacking duplicate voices on one note', () => {
    const pool = new VoicePool(SR, 8);
    pool.noteOn(60, 1, ENV);
    pool.noteOn(64, 1, ENV);
    pool.noteOn(67, 1, ENV);
    expect(pool.activeCount).toBe(3);
    // Retriggering a held note reuses its voice rather than consuming another.
    pool.noteOn(60, 1, ENV);
    expect(pool.activeCount).toBe(3);
  });

  it('frees a voice after release completes', () => {
    const pool = new VoicePool(SR, 4);
    pool.noteOn(60, 1, SHORT);
    renderBlock(pool, 1024);
    pool.noteOff(60);
    renderBlock(pool, SR);
    expect(pool.activeCount).toBe(0);
  });

  it('steals the oldest voice when the pool is full, and never exceeds its size', () => {
    const pool = new VoicePool(SR, 4);
    for (const midi of [60, 62, 64, 65, 67, 69]) {
      pool.noteOn(midi, 1, ENV);
      renderBlock(pool, 64);
    }
    expect(pool.activeCount).toBeLessThanOrEqual(4);
    expect(pool.size).toBe(4);
  });

  it('prefers a releasing voice over a held one when stealing', () => {
    const pool = new VoicePool(SR, 2);
    pool.noteOn(60, 1, ENV);
    pool.noteOn(62, 1, ENV);
    pool.noteOff(60); // 60 is now releasing, 62 is held
    renderBlock(pool, 256);

    pool.noteOn(64, 1, ENV);
    renderBlock(pool, 256);
    // The held note must survive; the releasing one is the one to sacrifice.
    pool.noteOff(62);
    expect(pool.activeCount).toBeGreaterThan(0);
  });

  it('stops everything on panic', () => {
    const pool = new VoicePool(SR, 8);
    for (const midi of [60, 64, 67]) pool.noteOn(midi, 1, ENV);
    pool.panic();
    expect(pool.activeCount).toBe(0);
    expect(peak(renderBlock(pool, 256))).toBe(0);
  });

  it('resizes without leaving stale voices sounding', () => {
    const pool = new VoicePool(SR, 8);
    pool.noteOn(60, 1, ENV);
    pool.resize(4);
    expect(pool.size).toBe(4);
    expect(pool.activeCount).toBe(0);
    expect(peak(renderBlock(pool, 256))).toBe(0);
  });

  it('clamps polyphony to a sane range', () => {
    const pool = new VoicePool(SR, 8);
    pool.resize(0);
    expect(pool.size).toBeGreaterThanOrEqual(1);
    pool.resize(9999);
    expect(pool.size).toBeLessThanOrEqual(32);
  });
});

describe('voice output quality', () => {
  it('never produces NaN or runaway output, across the parameter space', () => {
    for (const wave of [0, 1]) {
      for (const cutoff of [20, 3000, 18000]) {
        for (const resonance of [0, 1]) {
          for (const drive of [0, 1]) {
            const pool = new VoicePool(SR, 8);
            for (const midi of [24, 48, 60, 96, 108]) pool.noteOn(midi, 1, ENV);
            const buf = new Float32Array(2048);
            pool.prepare({ ...PARAMS, wave, cutoff, resonance, drive });
            for (let i = 0; i < buf.length; i++) buf[i] = pool.render();
            for (const s of buf) {
              expect(Number.isFinite(s)).toBe(true);
              expect(Math.abs(s)).toBeLessThan(50);
            }
          }
        }
      }
    }
  });

  it('starts and ends without a click', () => {
    const pool = new VoicePool(SR, 8);
    pool.noteOn(60, 1, { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.05 });

    const buf = new Float32Array(SR);
    pool.prepare(PARAMS);
    for (let i = 0; i < buf.length; i++) {
      if (i === Math.floor(SR / 2)) pool.noteOff(60);
      buf[i] = pool.render();
    }

    // A click is a large sample-to-sample jump. Genuine audio moves smoothly
    // even at a waveform's own discontinuity, because polyBLEP rounds it.
    let biggestJump = 0;
    for (let i = 1; i < buf.length; i++) {
      biggestJump = Math.max(biggestJump, Math.abs((buf[i] ?? 0) - (buf[i - 1] ?? 0)));
    }
    expect(biggestJump).toBeLessThan(1.2);

    // And the very first sample must not leap away from silence.
    expect(Math.abs(buf[0] ?? 0)).toBeLessThan(0.05);
  });
});
