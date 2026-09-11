import { getEngine } from '@/core/engines';
import type { EngineId } from '@/core/engines/types';
import { PATCH_SCHEMA_VERSION, type Patch, type PatchValues } from './types';

/** Every control on every page of an engine, flattened. */
export function allControls(engineId: EngineId) {
  return getEngine(engineId).pages.flatMap((page) => page.controls);
}

export function defaultValues(engineId: EngineId): PatchValues {
  const values: Record<string, number> = {};
  for (const control of allControls(engineId)) values[control.id] = control.default;
  return values;
}

export function defaultPatch(engineId: EngineId): Patch {
  return {
    schemaVersion: PATCH_SCHEMA_VERSION,
    engine: engineId,
    values: defaultValues(engineId),
  };
}
