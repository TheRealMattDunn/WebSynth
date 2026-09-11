import type { ControlSpec } from './types';

/** Clamp to an inclusive range. */
export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const stepCount = (spec: ControlSpec): number => Math.max(2, Math.round(spec.steps ?? 2));

/**
 * Fader travel (0..1) -> real parameter value.
 *
 * `exp` is geometric: equal fader movement gives an equal ratio, which is how
 * pitch and time are actually perceived. A linear cutoff fader spends most of its
 * travel in a range you cannot hear changing.
 */
export function fromNormalised(spec: ControlSpec, t: number): number {
  const n = clamp(t, 0, 1);
  switch (spec.curve) {
    case 'lin':
      return spec.min + n * (spec.max - spec.min);
    case 'exp':
      return spec.min * Math.pow(spec.max / spec.min, n);
    case 'stepped': {
      const steps = stepCount(spec);
      const index = Math.min(steps - 1, Math.floor(n * steps));
      return spec.min + (index * (spec.max - spec.min)) / (steps - 1);
    }
  }
}

/** Real parameter value -> fader travel (0..1). Inverse of `fromNormalised`. */
export function toNormalised(spec: ControlSpec, value: number): number {
  const v = clamp(value, spec.min, spec.max);
  switch (spec.curve) {
    case 'lin':
      return spec.max === spec.min ? 0 : (v - spec.min) / (spec.max - spec.min);
    case 'exp':
      return Math.log(v / spec.min) / Math.log(spec.max / spec.min);
    case 'stepped': {
      const steps = stepCount(spec);
      const index = Math.round(((v - spec.min) / (spec.max - spec.min)) * (steps - 1));
      // Land mid-band so a round-trip through fromNormalised returns the same step.
      return (index + 0.5) / steps;
    }
  }
}

/** Snap a value to the nearest legal position. Identity for continuous curves. */
export const quantise = (spec: ControlSpec, value: number): number =>
  spec.curve === 'stepped'
    ? fromNormalised(spec, toNormalised(spec, value))
    : clamp(value, spec.min, spec.max);

// ---- Formatters -------------------------------------------------------------
// Shared so every readout in the instrument renders the same way.

export const asPercent = (v: number): string => `${Math.round(v * 100)}%`;

export const asHertz = (v: number): string =>
  v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 1 : 2)}k` : `${Math.round(v)}`;

export const asMilliseconds = (seconds: number): string =>
  seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${seconds.toFixed(2)}s`;

export const asCents = (v: number): string => `${Math.round(v)}¢`;

export const asOneOf =
  (names: readonly string[]) =>
  (v: number): string =>
    names[clamp(Math.round(v), 0, names.length - 1)] ?? '';
