/**
 * How many voices this device can realistically render.
 *
 * An AudioWorklet on a mid-range phone has a fraction of a laptop's headroom,
 * and the failure mode is crackling rather than a graceful slowdown. Polyphony
 * is therefore a property of the device, not a constant — but it is derived by
 * a pure function so it can be reasoned about and tested rather than guessed at
 * behind a user-agent sniff.
 */

export interface DeviceCapability {
  /** navigator.hardwareConcurrency, or 0 when unavailable. */
  readonly cores: number;
  /** True for touch-primary devices, which are usually thermally limited. */
  readonly coarsePointer: boolean;
}

export const MIN_VOICES = 4;
export const MAX_VOICES = 8;

export function recommendedVoices(device: DeviceCapability): number {
  const cores = Number.isFinite(device.cores) && device.cores > 0 ? device.cores : 2;

  const byCores = cores >= 8 ? 8 : cores >= 4 ? 6 : 4;
  // A touch device with plenty of cores is still usually a tablet or phone that
  // will throttle under sustained load, so cap it below the desktop ceiling.
  const ceiling = device.coarsePointer ? 6 : MAX_VOICES;

  return Math.max(MIN_VOICES, Math.min(ceiling, byCores));
}

/** Reads the current device. Separated so the logic above stays pure. */
export function detectDevice(): DeviceCapability {
  const coarsePointer =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  return {
    cores: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 0) : 0,
    coarsePointer,
  };
}
