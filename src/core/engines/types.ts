import type { ControlPage } from '@/core/controls/types';

/** Engines planned for V1. Only `va` is implemented at M1. */
export type EngineId = 'va' | 'fm' | 'string';

export interface EngineDef {
  readonly id: EngineId;
  readonly name: string;
  /** One-line description shown when switching engines. */
  readonly blurb: string;
  /** Page 1 is always the engine's own timbre; the rest are shared. */
  readonly pages: readonly [ControlPage, ...ControlPage[]];
}
