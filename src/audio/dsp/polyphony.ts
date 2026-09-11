import { Voice, type VoiceParams } from './voice';

export interface EnvelopeParams {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

/**
 * A fixed pool of voices with stealing.
 *
 * The pool is allocated once and never grows: allocating in the audio thread
 * risks a garbage collection pause, and a GC pause is an audible dropout.
 * Changing polyphony rebuilds the pool deliberately, off the hot path.
 */
export class VoicePool {
  private voices: Voice[];
  private readonly sampleRate: number;
  private counter = 0;

  constructor(sampleRate: number, size: number) {
    this.sampleRate = sampleRate;
    this.voices = Array.from({ length: Math.max(1, size) }, () => new Voice(sampleRate));
  }

  get size(): number {
    return this.voices.length;
  }

  get activeCount(): number {
    let n = 0;
    for (const v of this.voices) if (v.isActive) n++;
    return n;
  }

  resize(size: number): void {
    const next = Math.max(1, Math.min(32, Math.round(size)));
    if (next === this.voices.length) return;
    this.voices = Array.from({ length: next }, () => new Voice(this.sampleRate));
  }

  /**
   * Pick a voice for a new note, in order of preference:
   *   1. the same note already sounding (retrigger it rather than stack it)
   *   2. any idle voice
   *   3. the quietest releasing voice — least likely to be missed
   *   4. the oldest voice
   */
  private allocate(midi: number): Voice {
    let idle: Voice | undefined;
    let quietestReleasing: Voice | undefined;
    let oldest: Voice | undefined;

    for (const v of this.voices) {
      if (v.midi === midi && v.isActive) return v;
      if (!v.isActive) {
        idle ??= v;
        continue;
      }
      if (v.isReleasing && (!quietestReleasing || v.level < quietestReleasing.level)) {
        quietestReleasing = v;
      }
      if (!oldest || v.age < oldest.age) oldest = v;
    }

    const chosen = idle ?? quietestReleasing ?? oldest ?? this.voices[0];
    if (!chosen) throw new Error('VoicePool is empty');
    if (chosen !== idle) chosen.kill();
    return chosen;
  }

  noteOn(midi: number, velocity: number, env: EnvelopeParams): void {
    const voice = this.allocate(midi);
    voice.setEnvelope(env.attack, env.decay, env.sustain, env.release);
    voice.noteOn(midi, velocity, this.counter++);
  }

  noteOff(midi: number): void {
    for (const v of this.voices) {
      if (v.midi === midi && v.isActive) v.noteOff();
    }
  }

  allNotesOff(): void {
    for (const v of this.voices) v.noteOff();
  }

  panic(): void {
    for (const v of this.voices) v.kill();
  }

  /** Push current envelope settings into every sounding voice. */
  updateEnvelopes(env: EnvelopeParams): void {
    for (const v of this.voices) {
      if (v.isActive) v.setEnvelope(env.attack, env.decay, env.sustain, env.release);
    }
  }

  prepare(params: VoiceParams): void {
    for (const v of this.voices) v.prepare(params);
  }

  /** Sum of every active voice for one sample. Call `prepare` first. */
  render(): number {
    let sum = 0;
    for (const v of this.voices) sum += v.render();
    return sum;
  }
}
