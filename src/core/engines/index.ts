import { VA_ENGINE } from './va';
import type { EngineDef, EngineId } from './types';

/** Engines available right now. FM and String arrive at M2. */
export const ENGINES: readonly EngineDef[] = [VA_ENGINE];

export const DEFAULT_ENGINE_ID: EngineId = 'va';

export function getEngine(id: EngineId): EngineDef {
  const engine = ENGINES.find((e) => e.id === id);
  if (!engine) throw new Error(`Unknown engine: ${id}`);
  return engine;
}

export type { EngineDef, EngineId } from './types';
export { ENVELOPE_PAGE, FILTER_PAGE } from './pages';
