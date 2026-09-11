import { useEffect } from 'react';

/**
 * Computer keyboard as an instrument.
 *
 * The layout every DAW uses: the home row is the white keys and the row above
 * holds the black keys where they physically sit on a piano, so it reads as a
 * keyboard rather than a list of bindings. z and x shift octave.
 */
const LAYOUT: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

export interface QwertyOptions {
  baseMidi: number;
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
  shiftOctave: (delta: number) => void;
  onGesture?: () => void;
}

export function useQwerty({
  baseMidi,
  noteOn,
  noteOff,
  shiftOctave,
  onGesture,
}: QwertyOptions): void {
  useEffect(() => {
    // Which midi note each physical key started, so an octave shift mid-hold
    // still releases the note that was actually sounded.
    const sounding = new Map<string, number>();

    const isTyping = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target))
        return;

      if (event.code === 'KeyZ' || event.code === 'KeyX') {
        if (event.repeat) return;
        event.preventDefault();
        shiftOctave(event.code === 'KeyZ' ? -1 : 1);
        return;
      }

      const offset = LAYOUT[event.code];
      if (offset === undefined) return;
      event.preventDefault();
      // Holding a key repeats keydown; retriggering on every repeat would
      // machine-gun the note.
      if (event.repeat || sounding.has(event.code)) return;

      onGesture?.();
      const midi = baseMidi + offset;
      sounding.set(event.code, midi);
      noteOn(midi);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      const midi = sounding.get(event.code);
      if (midi === undefined) return;
      sounding.delete(event.code);
      noteOff(midi);
    };

    // Focus can leave mid-keypress, and the keyup then never arrives.
    const releaseAll = () => {
      for (const midi of sounding.values()) noteOff(midi);
      sounding.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [baseMidi, noteOn, noteOff, shiftOctave, onGesture]);
}

/** Exported for the on-screen hint and for tests. */
export const QWERTY_LAYOUT = LAYOUT;
