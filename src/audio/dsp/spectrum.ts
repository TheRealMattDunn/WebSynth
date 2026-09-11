/**
 * Minimal real-input DFT over a frequency band.
 *
 * Test-support only, and deliberately naive — it exists so the anti-aliasing
 * test can make a measurement rather than a claim. A band of a few hundred bins
 * over a few thousand samples is milliseconds, which is cheaper than taking on
 * an FFT dependency for one assertion.
 */
export function bandMagnitudes(
  samples: Float32Array,
  sampleRate: number,
  lowHz: number,
  highHz: number,
): { hz: number; magnitude: number }[] {
  const n = samples.length;
  const binHz = sampleRate / n;
  const first = Math.max(1, Math.ceil(lowHz / binHz));
  const last = Math.min(Math.floor(n / 2) - 1, Math.floor(highHz / binHz));

  const out: { hz: number; magnitude: number }[] = [];
  for (let k = first; k <= last; k++) {
    let re = 0;
    let im = 0;
    const w = (-2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) {
      const s = samples[i] ?? 0;
      re += s * Math.cos(w * i);
      im += s * Math.sin(w * i);
    }
    out.push({ hz: k * binHz, magnitude: (2 * Math.hypot(re, im)) / n });
  }
  return out;
}

/** Total magnitude in a band. */
export const bandEnergy = (
  samples: Float32Array,
  sampleRate: number,
  lowHz: number,
  highHz: number,
): number =>
  bandMagnitudes(samples, sampleRate, lowHz, highHz).reduce((a, b) => a + b.magnitude, 0);

/** A Hann window reduces spectral leakage that would otherwise swamp the measurement. */
export function hann(samples: Float32Array): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (samples.length - 1)));
    out[i] = (samples[i] ?? 0) * w;
  }
  return out;
}
