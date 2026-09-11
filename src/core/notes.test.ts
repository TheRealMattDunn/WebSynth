import { describe, expect, it } from 'vitest';
import {
  centsToRatio,
  isBlackKey,
  midiToFrequency,
  noteName,
  octaveToMidi,
  pitchClass,
} from './notes';

describe('midiToFrequency', () => {
  it('anchors on A4 = 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 9);
  });

  it('doubles every octave', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 9);
    expect(midiToFrequency(57)).toBeCloseTo(220, 9);
  });

  it('matches known equal-tempered values', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 3); // middle C
    expect(midiToFrequency(21)).toBeCloseTo(27.5, 4); // bottom of a piano
  });

  it('honours an alternative concert pitch', () => {
    expect(midiToFrequency(69, 432)).toBeCloseTo(432, 9);
  });
});

describe('note naming', () => {
  it('uses scientific pitch notation', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(0)).toBe('C-1');
  });

  it('identifies black keys', () => {
    expect([0, 2, 4, 5, 7, 9, 11].every((n) => !isBlackKey(60 + n))).toBe(true);
    expect([1, 3, 6, 8, 10].every((n) => isBlackKey(60 + n))).toBe(true);
  });

  it('handles negative midi numbers without wrapping wrong', () => {
    expect(pitchClass(-1)).toBe(11);
  });
});

describe('helpers', () => {
  it('converts cents to a ratio', () => {
    expect(centsToRatio(0)).toBe(1);
    expect(centsToRatio(1200)).toBeCloseTo(2, 9);
    expect(centsToRatio(100)).toBeCloseTo(Math.pow(2, 1 / 12), 9);
  });

  it('maps octave numbers to their root note', () => {
    expect(octaveToMidi(4)).toBe(60);
    expect(noteName(octaveToMidi(3))).toBe('C3');
  });
});
