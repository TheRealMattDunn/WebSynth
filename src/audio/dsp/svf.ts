/**
 * Topology-preserving-transform state-variable filter (Zavalishin).
 *
 * Chosen over the classic Chamberlin SVF because it stays stable as the cutoff
 * approaches Nyquist, where Chamberlin blows up — which matters here because the
 * cutoff fader goes to 18 kHz and people will sweep it while holding a chord.
 *
 * Gives lowpass, bandpass and highpass from the same state for free; M1 only
 * uses the lowpass, but the others cost nothing to expose.
 */

/**
 * Denormal guard.
 *
 * When filter state decays toward zero it eventually enters denormal range,
 * where arithmetic falls off a hardware fast path and can run orders of
 * magnitude slower — on the audio thread that means crackling, in a silent
 * passage, for no visible reason. Flushing to zero well above that threshold
 * costs one comparison and removes the whole class of problem.
 */
const flush = (x: number): number => (x > -1e-20 && x < 1e-20 ? 0 : x);

/** Butterworth: maximally flat passband, -3 dB at the corner. */
const MIN_Q = Math.SQRT1_2;
/** Sharp peak, but still short of self-oscillation so it cannot run away. */
const MAX_Q = 15;

export class Svf {
  private ic1eq = 0;
  private ic2eq = 0;

  private g = 0;
  private k = 2;
  private a1 = 0;
  private a2 = 0;
  private a3 = 0;

  private readonly sampleRate: number;

  constructor(sampleRate: number) {
    this.sampleRate = sampleRate;
    this.set(1000, 0);
  }

  /**
   * @param cutoffHz  corner frequency
   * @param resonance 0..1, where 1 is just short of self-oscillation
   */
  set(cutoffHz: number, resonance: number): void {
    // Keep the prewarped tangent finite: tan() goes to infinity at Nyquist.
    const nyquist = this.sampleRate * 0.5;
    const fc = Math.min(Math.max(cutoffHz, 10), nyquist * 0.98);
    const res = Math.min(Math.max(resonance, 0), 1);

    this.g = Math.tan((Math.PI * fc) / this.sampleRate);

    // k is 1/Q. Resonance maps geometrically onto Q from Butterworth (0.707,
    // maximally flat — the response you expect when resonance is "off") up to a
    // sharp peak just short of self-oscillation. A linear Q sweep spends most of
    // the fader doing nothing audible; a geometric one feels even under the finger.
    const q = MIN_Q * Math.pow(MAX_Q / MIN_Q, res);
    this.k = 1 / q;

    this.a1 = 1 / (1 + this.g * (this.g + this.k));
    this.a2 = this.g * this.a1;
    this.a3 = this.g * this.a2;
  }

  reset(): void {
    this.ic1eq = 0;
    this.ic2eq = 0;
  }

  /** Lowpass output for one sample. */
  processLowpass(input: number): number {
    const v3 = input - this.ic2eq;
    const v1 = this.a1 * this.ic1eq + this.a2 * v3;
    const v2 = this.ic2eq + this.a2 * this.ic1eq + this.a3 * v3;
    this.ic1eq = flush(2 * v1 - this.ic1eq);
    this.ic2eq = flush(2 * v2 - this.ic2eq);
    return v2;
  }
}

/**
 * Soft saturation. `tanh` shape without the transcendental call — cheap enough
 * to run per sample per voice, and it keeps the filter from clipping harshly
 * when resonance and drive are both up.
 */
export function softClip(x: number): number {
  if (x < -3) return -1;
  if (x > 3) return 1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}
