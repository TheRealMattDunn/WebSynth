/**
 * The Four-Control Law.
 *
 * Every screen in TYPE-4 exposes exactly four continuous parameters. Not three,
 * not five. It is the constraint the whole instrument is designed around, so it
 * lives in the type system where the compiler can hold us to it rather than in a
 * style guide where it would quietly rot.
 *
 * See docs/adr/0003-four-control-law.md.
 */

/**
 * How a fader's 0..1 travel maps onto the parameter's real range.
 *
 * - `lin`     even throughout. Levels, mix amounts, sustain.
 * - `exp`     geometric, so each equal movement is an equal *ratio*. This is how
 *             hearing works, so it is right for frequency and time. Requires min > 0.
 * - `stepped` quantised to `steps` discrete positions. Waveform choice, ratios.
 */
export type ControlCurve = 'lin' | 'exp' | 'stepped';

export interface ControlSpec {
  /** Stable identifier. Matches the AudioParam name in the worklet. */
  readonly id: string;
  /** Shown under the fader. Keep to 6 characters or it wraps. */
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly curve: ControlCurve;
  /** Number of positions when curve is 'stepped'. Ignored otherwise. */
  readonly steps?: number;
  /** Rendered above the fader, e.g. "440 Hz", "12.5 %", "SAW". */
  readonly format: (value: number) => string;
}

/**
 * Exactly four controls. A fifth is a compile error, not a code review comment.
 */
export type ControlQuad = readonly [ControlSpec, ControlSpec, ControlSpec, ControlSpec];

export interface ControlPage {
  readonly id: string;
  readonly label: string;
  readonly controls: ControlQuad;
}

/** Helper that infers a tuple and fails the build if the count is not four. */
export const quad = (
  a: ControlSpec,
  b: ControlSpec,
  c: ControlSpec,
  d: ControlSpec,
): ControlQuad => [a, b, c, d] as const;
