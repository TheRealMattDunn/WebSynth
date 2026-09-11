import { useCallback, useEffect, useRef } from 'react';

/**
 * Shared pointer handling for anything you play: piano keys and pads alike.
 *
 * Tracks each pointer independently by `pointerId`, which is what makes chords
 * work on a touchscreen — a synth that can only sound one note at a time under
 * a finger is broken, and that is exactly what happens if you bind
 * pointerdown/pointerup per key and forget the id.
 *
 * Pointers are resolved against `document.elementFromPoint` rather than event
 * targets so that sliding a finger across the keyboard glisses from note to
 * note, instead of holding the first key you happened to land on.
 */

export interface NoteTargetHandlers {
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
}

const midiAtPoint = (x: number, y: number): number | null => {
  const element = document.elementFromPoint(x, y);
  const attribute = element?.closest<HTMLElement>('[data-midi]')?.dataset.midi;
  if (attribute === undefined) return null;
  const midi = Number.parseInt(attribute, 10);
  return Number.isFinite(midi) ? midi : null;
};

export function useNoteTargets(
  noteOn: (midi: number) => void,
  noteOff: (midi: number) => void,
): NoteTargetHandlers {
  /** Which note each active pointer is currently holding. */
  const held = useRef(new Map<number, number>());

  const release = useCallback(
    (pointerId: number) => {
      const midi = held.current.get(pointerId);
      if (midi === undefined) return;
      held.current.delete(pointerId);
      noteOff(midi);
    },
    [noteOff],
  );

  const move = useCallback(
    (pointerId: number, midi: number | null) => {
      const current = held.current.get(pointerId);
      if (current === midi) return;
      if (current !== undefined) noteOff(current);
      if (midi === null) {
        held.current.delete(pointerId);
        return;
      }
      held.current.set(pointerId, midi);
      noteOn(midi);
    },
    [noteOff, noteOn],
  );

  // A pointer released outside the window never fires pointerup on the element,
  // which would leave a note sounding forever.
  useEffect(() => {
    const heldNotes = held.current;
    const releaseAll = () => {
      for (const midi of heldNotes.values()) noteOff(midi);
      heldNotes.clear();
    };
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  }, [noteOff]);

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event.pointerId, midiAtPoint(event.clientX, event.clientY));
    },
    onPointerMove: (event) => {
      if (!held.current.has(event.pointerId)) return;
      move(event.pointerId, midiAtPoint(event.clientX, event.clientY));
    },
    onPointerUp: (event) => {
      release(event.pointerId);
    },
    onPointerCancel: (event) => {
      release(event.pointerId);
    },
  };
}
