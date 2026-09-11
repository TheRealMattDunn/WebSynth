import { useEffect, useMemo, useState } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { instrumentStore } from './useInstrument';

/**
 * One engine for the lifetime of the page.
 *
 * Deliberately a module-level singleton rather than React state: an AudioContext
 * is a scarce hardware resource, and React's development double-render would
 * otherwise create two of them.
 */
export const engine = new AudioEngine();

let wired = false;

function wire(): void {
  if (wired) return;
  wired = true;

  engine.setListener({
    onStatus: (status, error) => {
      instrumentStore.getState().setAudioStatus(status, error);
    },
  });

  // Push every parameter change straight through to the audio thread. Subscribing
  // to the store here, rather than in a component, keeps the audio path
  // independent of whatever happens to be mounted.
  let previous = instrumentStore.getState().values;
  instrumentStore.subscribe((state) => {
    if (state.values === previous) return;
    for (const [id, value] of Object.entries(state.values)) {
      if (previous[id] !== value) engine.setParam(id, value);
    }
    previous = state.values;
  });
}

export function useAudioEngine() {
  const status = useInstrumentStatus();
  useEffect(wire, []);

  return useMemo(
    () => ({
      engine,
      status,
      /**
       * Must be called from inside a real user gesture. Returns void rather
       * than a promise: it is wired straight to event handlers, and handing
       * them a promise means failures vanish into an unhandled rejection.
       */
      start: () => {
        void engine.start().catch(() => undefined);
      },
    }),
    [status],
  );
}

function useInstrumentStatus() {
  const [status, setStatus] = useState(() => instrumentStore.getState().audioStatus);
  useEffect(
    () =>
      instrumentStore.subscribe((s) => {
        setStatus(s.audioStatus);
      }),
    [],
  );
  return status;
}
