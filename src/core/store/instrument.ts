import { createStore } from 'zustand/vanilla';
import { quantise } from '@/core/controls/scaling';
import { DEFAULT_ENGINE_ID, getEngine } from '@/core/engines';
import type { EngineId } from '@/core/engines/types';
import { defaultValues } from '@/core/patch';

/**
 * Framework-free store. `zustand/vanilla` keeps core/ honest — React binds to
 * this in ui/hooks/useInstrument.ts, but nothing here knows React exists.
 */

export type AudioStatus = 'idle' | 'starting' | 'running' | 'error';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface InstrumentState {
  engineId: EngineId;
  /** Which control page the four faders are currently showing. */
  pageIndex: number;
  values: Record<string, number>;
  /** Octave of the leftmost key. */
  octave: number;
  audioStatus: AudioStatus;
  audioError: string | null;
  theme: ThemePreference;

  setValue: (id: string, value: number) => void;
  setPage: (index: number) => void;
  setEngine: (id: EngineId) => void;
  shiftOctave: (delta: number) => void;
  setAudioStatus: (status: AudioStatus, error?: string) => void;
  setTheme: (theme: ThemePreference) => void;
  resetPatch: () => void;
}

export const MIN_OCTAVE = 0;
export const MAX_OCTAVE = 8;

const controlsById = (engineId: EngineId) =>
  new Map(
    getEngine(engineId)
      .pages.flatMap((p) => p.controls)
      .map((c) => [c.id, c]),
  );

export const createInstrumentStore = () =>
  createStore<InstrumentState>()((set, get) => ({
    engineId: DEFAULT_ENGINE_ID,
    pageIndex: 0,
    values: defaultValues(DEFAULT_ENGINE_ID),
    octave: 3,
    audioStatus: 'idle',
    audioError: null,
    theme: 'system',

    setValue: (id, value) => {
      const spec = controlsById(get().engineId).get(id);
      if (!spec) return;
      set((s) => ({ values: { ...s.values, [id]: quantise(spec, value) } }));
    },

    setPage: (index) => {
      const pages = getEngine(get().engineId).pages.length;
      set({ pageIndex: ((index % pages) + pages) % pages });
    },

    setEngine: (id) => set({ engineId: id, pageIndex: 0, values: defaultValues(id) }),

    shiftOctave: (delta) =>
      set((s) => ({
        octave: Math.min(MAX_OCTAVE, Math.max(MIN_OCTAVE, s.octave + delta)),
      })),

    setAudioStatus: (status, error) =>
      set({ audioStatus: status, audioError: error ?? null }),

    setTheme: (theme) => set({ theme }),

    resetPatch: () => set((s) => ({ values: defaultValues(s.engineId) })),
  }));

export type InstrumentStore = ReturnType<typeof createInstrumentStore>;
