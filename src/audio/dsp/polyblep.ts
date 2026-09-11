/**
 * PolyBLEP anti-aliasing.
 *
 * A naive digital saw is `2 * phase - 1` and takes four lines. It also sounds
 * like a fax machine anywhere above the fifth octave, because its instantaneous
 * jump from +1 to -1 contains infinite harmonics, and everything above Nyquist
 * folds back down as inharmonic tones that track the wrong way as you play up
 * the keyboard.
 *
 * PolyBLEP (polynomial band-limited step) rounds off that jump over roughly two
 * samples using a cheap polynomial, which removes most of the folded energy for
 * a handful of operations per sample. It is the difference between an instrument
 * and a toy, and it is measurably true: see polyblep.test.ts, which plays a high
 * note and asserts there is no energy below the fundamental.
 */

/**
 * Correction to subtract at a discontinuity.
 *
 * @param t  phase, 0..1
 * @param dt phase increment per sample (frequency / sampleRate)
 */
export function polyBlep(t: number, dt: number): number {
  if (dt <= 0) return 0;
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Band-limited sawtooth, falling edge at phase 0. Output -1..1. */
export function polyBlepSaw(phase: number, dt: number): number {
  return 2 * phase - 1 - polyBlep(phase, dt);
}

/**
 * Band-limited pulse with variable width. Output -1..1.
 * Two discontinuities per cycle, so two corrections.
 */
export function polyBlepPulse(phase: number, dt: number, width: number): number {
  const w = width < 0.01 ? 0.01 : width > 0.99 ? 0.99 : width;
  let value = phase < w ? 1 : -1;
  value += polyBlep(phase, dt);
  value -= polyBlep(phase - w < 0 ? phase - w + 1 : phase - w, dt);
  return value;
}

/** Naive sawtooth. Kept because the anti-aliasing test needs something to beat. */
export const naiveSaw = (phase: number): number => 2 * phase - 1;

/** Advance a phase accumulator, wrapping to 0..1. */
export const advance = (phase: number, dt: number): number => {
  const next = phase + dt;
  return next >= 1 ? next - Math.floor(next) : next;
};
