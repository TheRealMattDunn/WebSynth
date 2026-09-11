/**
 * The contract across the audio-thread boundary.
 *
 * Shared by AudioEngine (main thread) and the worklets, so a change to one side
 * fails to compile on the other rather than going quiet at runtime.
 */

/**
 * Note events carry an absolute AudioContext time rather than "now". The
 * processor converts that to a sample offset inside the render quantum, so a
 * note lands on the exact sample it was scheduled for instead of being rounded
 * to the nearest 128-sample block. That precision is the difference between a
 * sequencer that grooves and one that stumbles — and it is why the sequencer in
 * M4 can be built on top of this without revisiting it.
 */
export interface NoteOnMessage {
  readonly type: 'noteOn';
  readonly midi: number;
  /** 0..1 */
  readonly velocity: number;
  readonly time: number;
}

export interface NoteOffMessage {
  readonly type: 'noteOff';
  readonly midi: number;
  readonly time: number;
}

/** Panic. Used on blur, on context suspend, and when switching engines. */
export interface AllNotesOffMessage {
  readonly type: 'allNotesOff';
}

export interface SetPolyphonyMessage {
  readonly type: 'setPolyphony';
  readonly voices: number;
}

export type ToWorklet =
  NoteOnMessage | NoteOffMessage | AllNotesOffMessage | SetPolyphonyMessage;

/** Periodic report so the UI can show voice usage without polling the audio thread. */
export interface VoiceReport {
  readonly type: 'voices';
  readonly active: number;
  readonly max: number;
}

export type FromWorklet = VoiceReport;

/** Parameter ids the VA worklet exposes as AudioParams. Must match core/engines/va.ts. */
export const VA_PARAMS = [
  'wave',
  'width',
  'detune',
  'sub',
  'attack',
  'decay',
  'sustain',
  'release',
  'cutoff',
  'resonance',
  'drive',
  'level',
] as const;

export type VaParam = (typeof VA_PARAMS)[number];
