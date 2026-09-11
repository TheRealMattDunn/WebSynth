/**
 * Musical time, as pure arithmetic.
 *
 * Kept entirely free of AudioContext so it can be reasoned about and tested
 * directly. The clock that consumes this arrives with the sequencer in M4; the
 * maths lands now because getting timing wrong is the single most expensive
 * mistake to discover late, and it is cheap to pin down with tests today.
 */

export const DEFAULT_STEPS_PER_BEAT = 4; // sixteenth notes

export const secondsPerBeat = (bpm: number): number => 60 / Math.max(1, bpm);

export const secondsPerStep = (
  bpm: number,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
): number => secondsPerBeat(bpm) / Math.max(1, stepsPerBeat);

/**
 * Swing delay applied to every other step.
 *
 * `swing` runs 0..1, where 0 is dead straight and 1 is full triplet feel — the
 * odd step lands two-thirds of the way through the pair rather than halfway.
 * Even steps are never moved, so the downbeat stays put no matter the setting.
 */
export function swingOffset(
  stepIndex: number,
  bpm: number,
  swing: number,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
): number {
  if (stepIndex % 2 === 0) return 0;
  const amount = Math.min(Math.max(swing, 0), 1);
  return (secondsPerStep(bpm, stepsPerBeat) * amount) / 3;
}

/** Absolute time of a step, counting from `origin`. */
export function stepTime(
  origin: number,
  stepIndex: number,
  bpm: number,
  swing = 0,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
): number {
  return (
    origin +
    stepIndex * secondsPerStep(bpm, stepsPerBeat) +
    swingOffset(stepIndex, bpm, swing, stepsPerBeat)
  );
}

export interface ScheduledStep {
  /** Step number counting from the origin, before any loop wrapping. */
  readonly index: number;
  readonly time: number;
}

/**
 * Every step falling in `[from, to)`.
 *
 * This is the shape a lookahead scheduler needs: ask what happens in the next
 * slice of time, schedule it, come back later. Returning the steps rather than
 * firing callbacks keeps it pure and therefore testable.
 */
export function stepsInWindow(
  from: number,
  to: number,
  origin: number,
  bpm: number,
  swing = 0,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
): ScheduledStep[] {
  if (to <= from) return [];
  const step = secondsPerStep(bpm, stepsPerBeat);

  // Start a step early so a swung odd step pushed forward into this window is
  // not missed, and clamp at zero so we never schedule before the origin.
  const first = Math.max(0, Math.floor((from - origin) / step) - 1);
  const last = Math.ceil((to - origin) / step) + 1;

  const out: ScheduledStep[] = [];
  for (let index = first; index <= last; index++) {
    const time = stepTime(origin, index, bpm, swing, stepsPerBeat);
    if (time >= from && time < to) out.push({ index, time });
  }
  return out;
}

/** Wrap an absolute step number into a pattern of `length` steps. */
export const wrapStep = (index: number, length: number): number => {
  const n = Math.max(1, Math.round(length));
  return ((index % n) + n) % n;
};

/** Snap a time to the nearest step boundary — used when quantising a live take. */
export function quantiseTime(
  time: number,
  origin: number,
  bpm: number,
  stepsPerBeat = DEFAULT_STEPS_PER_BEAT,
): number {
  const step = secondsPerStep(bpm, stepsPerBeat);
  return origin + Math.round((time - origin) / step) * step;
}
