import { useStore } from 'zustand';
import { createInstrumentStore, type InstrumentState } from '@/core/store/instrument';

/**
 * The React binding for the framework-free store in core/.
 *
 * The store itself is `zustand/vanilla` so that core/ can be tested and reasoned
 * about without React in the picture; this file is the only place the two meet.
 */
export const instrumentStore = createInstrumentStore();

export function useInstrument<T>(selector: (state: InstrumentState) => T): T {
  return useStore(instrumentStore, selector);
}

export const instrument = () => instrumentStore.getState();
