/** Note maths. Shared by the keyboard UI and the audio engine. */

export const A4_MIDI = 69;
export const A4_HZ = 440;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Semitone offsets within an octave that are black keys. */
const BLACK = new Set([1, 3, 6, 8, 10]);

export const midiToFrequency = (midi: number, a4 = A4_HZ): number =>
  a4 * Math.pow(2, (midi - A4_MIDI) / 12);

export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

export const isBlackKey = (midi: number): boolean => BLACK.has(pitchClass(midi));

/** Scientific pitch notation, e.g. 60 -> "C4". */
export const noteName = (midi: number): string =>
  `${NAMES[pitchClass(midi)] ?? '?'}${Math.floor(midi / 12) - 1}`;

/** Cents -> frequency ratio. */
export const centsToRatio = (cents: number): number => Math.pow(2, cents / 1200);

/** Lowest note of an octave number, e.g. octave 4 -> 60 (C4). */
export const octaveToMidi = (octave: number): number => (octave + 1) * 12;
