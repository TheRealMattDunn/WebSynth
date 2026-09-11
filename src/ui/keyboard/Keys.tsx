import { isBlackKey, noteName, pitchClass } from '@/core/notes';
import styles from './Keyboard.module.css';
import { useNoteTargets } from './useNoteTargets';

interface KeysProps {
  baseMidi: number;
  /** Number of semitones to show. 24 is two octaves. */
  span?: number;
  held: ReadonlySet<number>;
  noteOn: (midi: number) => void;
  noteOff: (midi: number) => void;
}

/** Where a black key sits relative to the white key it follows, as a fraction. */
const BLACK_OFFSET: Record<number, number> = {
  1: 0.65,
  3: 0.75,
  6: 0.6,
  8: 0.7,
  10: 0.8,
};

/**
 * Piano keys, tablet width and up.
 *
 * Below 600px this is replaced by `Pads` — two octaves of piano at phone width
 * gives roughly sixteen pixels per key, which is not an instrument.
 */
export function Keys({ baseMidi, span = 24, held, noteOn, noteOff }: KeysProps) {
  const notes = Array.from({ length: span }, (_, i) => baseMidi + i);
  const whites = notes.filter((m) => !isBlackKey(m));
  const handlers = useNoteTargets(noteOn, noteOff);
  const whiteWidth = 100 / whites.length;

  return (
    <div
      className={`${styles.keyboard} t4-interactive`}
      role="group"
      aria-label="Keyboard"
      {...handlers}
    >
      {whites.map((midi) => (
        <div
          key={midi}
          className={styles.white}
          data-midi={midi}
          data-held={held.has(midi)}
          aria-label={noteName(midi)}
        >
          {pitchClass(midi) === 0 && (
            <span className={styles.keyName}>{noteName(midi)}</span>
          )}
        </div>
      ))}

      {notes.filter(isBlackKey).map((midi) => {
        // Position each black key against the white key below it.
        const whitesBelow = notes.filter((m) => m < midi && !isBlackKey(m)).length;
        const offset = BLACK_OFFSET[pitchClass(midi)] ?? 0.7;
        const left = (whitesBelow - 1 + offset) * whiteWidth;
        return (
          <div
            key={midi}
            className={styles.black}
            data-midi={midi}
            data-held={held.has(midi)}
            aria-label={noteName(midi)}
            style={{ left: `${left}%`, width: `${whiteWidth * 0.58}%` }}
          />
        );
      })}
    </div>
  );
}
