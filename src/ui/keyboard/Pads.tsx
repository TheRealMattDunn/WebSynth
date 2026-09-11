import { isBlackKey, noteName } from '@/core/notes';
import styles from './Keyboard.module.css';
import { useNoteTargets } from './useNoteTargets';

interface PadsProps {
  baseMidi: number;
  held: ReadonlySet<number>;
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
}

/**
 * A 4x3 chromatic pad grid — one octave, twelve pads.
 *
 * This is the phone answer to the 24-key problem. It is not a compromise so
 * much as the better touch interface at that size: pads are big enough to hit
 * accurately, and the same component earns its keep again in M3 when the drum
 * machine needs exactly this control.
 *
 * Laid out low-to-high from the bottom row up, so pitch rises as your hand does.
 */
export function Pads({ baseMidi, held, noteOn, noteOff }: PadsProps) {
  const handlers = useNoteTargets(noteOn, noteOff);
  const rows = [2, 1, 0].map((row) =>
    Array.from({ length: 4 }, (_, column) => baseMidi + row * 4 + column),
  );

  return (
    <div
      className={`${styles.pads} t4-interactive`}
      role="group"
      aria-label="Pads"
      {...handlers}
    >
      {rows.flat().map((midi) => (
        <div
          key={midi}
          className={styles.pad}
          data-midi={midi}
          data-held={held.has(midi)}
          data-accidental={isBlackKey(midi)}
          aria-label={noteName(midi)}
        >
          {noteName(midi)}
        </div>
      ))}
    </div>
  );
}
