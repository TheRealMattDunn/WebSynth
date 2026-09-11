import type { EngineId } from '@/core/engines/types';

/** Parameter id -> real (not normalised) value. */
export type PatchValues = Readonly<Record<string, number>>;

export interface Patch {
  /**
   * Bumped whenever the shape changes incompatibly. Present from the first
   * commit so that saved patches from M1 can still be read after M5 adds
   * persistence — a migration path is far cheaper to keep than to retrofit.
   */
  readonly schemaVersion: 1;
  readonly engine: EngineId;
  readonly values: PatchValues;
}

export const PATCH_SCHEMA_VERSION = 1 as const;
