import { beforeEach, describe, expect, it } from 'vitest';
import { getEngine } from '@/core/engines';
import { createInstrumentStore, MAX_OCTAVE, MIN_OCTAVE } from './instrument';
import type { InstrumentStore } from './instrument';

let store: InstrumentStore;
beforeEach(() => {
  store = createInstrumentStore();
});

describe('setValue', () => {
  it('clamps to the control range rather than accepting anything', () => {
    store.getState().setValue('cutoff', 999999);
    expect(store.getState().values.cutoff).toBe(18000);
    store.getState().setValue('cutoff', -10);
    expect(store.getState().values.cutoff).toBe(20);
  });

  it('snaps a stepped control to a legal position', () => {
    store.getState().setValue('wave', 0.6);
    expect(store.getState().values.wave).toBe(1);
  });

  it('ignores unknown parameter ids instead of poisoning the patch', () => {
    const before = { ...store.getState().values };
    store.getState().setValue('not-a-real-param', 1);
    expect(store.getState().values).toEqual(before);
  });
});

describe('setPage', () => {
  it('wraps in both directions so the page button never dead-ends', () => {
    const pages = getEngine(store.getState().engineId).pages.length;
    store.getState().setPage(pages);
    expect(store.getState().pageIndex).toBe(0);
    store.getState().setPage(-1);
    expect(store.getState().pageIndex).toBe(pages - 1);
  });
});

describe('shiftOctave', () => {
  it('stays within range', () => {
    for (let i = 0; i < 50; i++) store.getState().shiftOctave(1);
    expect(store.getState().octave).toBe(MAX_OCTAVE);
    for (let i = 0; i < 50; i++) store.getState().shiftOctave(-1);
    expect(store.getState().octave).toBe(MIN_OCTAVE);
  });
});

describe('resetPatch', () => {
  it('restores every control to its default', () => {
    store.getState().setValue('cutoff', 100);
    store.getState().setValue('sustain', 0);
    store.getState().resetPatch();
    const controls = getEngine(store.getState().engineId).pages.flatMap(
      (p) => p.controls,
    );
    for (const c of controls) expect(store.getState().values[c.id]).toBe(c.default);
  });
});

describe('audio status', () => {
  it('records and clears the error alongside the status', () => {
    store.getState().setAudioStatus('error', 'no audio device');
    expect(store.getState().audioError).toBe('no audio device');
    store.getState().setAudioStatus('running');
    expect(store.getState().audioError).toBeNull();
  });
});
