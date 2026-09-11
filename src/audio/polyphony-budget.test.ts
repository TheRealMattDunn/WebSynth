import { describe, expect, it } from 'vitest';
import { MAX_VOICES, MIN_VOICES, recommendedVoices } from './polyphony-budget';

describe('recommendedVoices', () => {
  it('gives a desktop the full allowance', () => {
    expect(recommendedVoices({ cores: 12, coarsePointer: false })).toBe(MAX_VOICES);
  });

  it('caps a touch device below the desktop ceiling even when it has many cores', () => {
    expect(recommendedVoices({ cores: 12, coarsePointer: true })).toBeLessThan(
      MAX_VOICES,
    );
  });

  it('scales down with core count', () => {
    const many = recommendedVoices({ cores: 8, coarsePointer: false });
    const few = recommendedVoices({ cores: 2, coarsePointer: false });
    expect(few).toBeLessThan(many);
  });

  it('never drops below a playable minimum', () => {
    expect(recommendedVoices({ cores: 1, coarsePointer: true })).toBe(MIN_VOICES);
  });

  it('copes with hardwareConcurrency being unavailable or nonsense', () => {
    for (const cores of [0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
      const voices = recommendedVoices({ cores, coarsePointer: false });
      expect(voices).toBeGreaterThanOrEqual(MIN_VOICES);
      expect(voices).toBeLessThanOrEqual(MAX_VOICES);
    }
  });

  it('always returns a whole number of voices in range', () => {
    for (let cores = 0; cores <= 32; cores++) {
      for (const coarsePointer of [true, false]) {
        const v = recommendedVoices({ cores, coarsePointer });
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(MIN_VOICES);
        expect(v).toBeLessThanOrEqual(MAX_VOICES);
      }
    }
  });
});
