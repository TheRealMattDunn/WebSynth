import { useCallback, useState } from 'react';
import { getEngine } from '@/core/engines';
import { octaveToMidi } from '@/core/notes';
import { PageTabs } from '@/ui/chrome/PageTabs';
import { StartOverlay } from '@/ui/chrome/StartOverlay';
import { ThemeToggle } from '@/ui/chrome/ThemeToggle';
import { Fader } from '@/ui/controls/Fader';
import { useAudioEngine } from '@/ui/hooks/useAudio';
import { instrument, useInstrument } from '@/ui/hooks/useInstrument';
import { useIsPhone } from '@/ui/hooks/useMediaQuery';
import { Keys } from '@/ui/keyboard/Keys';
import { Pads } from '@/ui/keyboard/Pads';
import { useQwerty } from '@/ui/keyboard/useQwerty';
import { Scope } from '@/ui/scope/Scope';
import styles from '@/ui/chrome/Chrome.module.css';
import { BRAND } from '@/core/brand';

export function App() {
  const { engine, status, start } = useAudioEngine();
  const isPhone = useIsPhone();

  const engineId = useInstrument((s) => s.engineId);
  const pageIndex = useInstrument((s) => s.pageIndex);
  const values = useInstrument((s) => s.values);
  const octave = useInstrument((s) => s.octave);
  const audioError = useInstrument((s) => s.audioError);

  const definition = getEngine(engineId);
  const page = definition.pages[pageIndex] ?? definition.pages[0];
  const baseMidi = octaveToMidi(octave);

  // Which notes are sounding, for the key highlighting. Kept in React state
  // because it changes at human speed, unlike anything on the audio path.
  const [held, setHeld] = useState<ReadonlySet<number>>(() => new Set());

  const noteOn = useCallback(
    (midi: number) => {
      engine.noteOn(midi, 1);
      setHeld((prev) => new Set(prev).add(midi));
    },
    [engine],
  );

  const noteOff = useCallback(
    (midi: number) => {
      engine.noteOff(midi);
      setHeld((prev) => {
        const next = new Set(prev);
        next.delete(midi);
        return next;
      });
    },
    [engine],
  );

  const shiftOctave = useCallback((delta: number) => {
    instrument().shiftOctave(delta);
  }, []);

  useQwerty({ baseMidi, noteOn, noteOff, shiftOctave, onGesture: start });

  if (status !== 'running') {
    return (
      <StartOverlay onStart={start} error={audioError} starting={status === 'starting'} />
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{BRAND.name}</h1>
        <span className={styles.engineName}>{definition.name}</span>
        <span className={styles.spacer} />
        <div className={styles.scope}>
          <Scope />
        </div>
        <ThemeToggle />
      </header>

      <PageTabs
        pages={definition.pages}
        activeIndex={pageIndex}
        onSelect={(index) => {
          instrument().setPage(index);
        }}
      />

      <main className={styles.controls}>
        {page?.controls.map((spec) => (
          <Fader
            key={spec.id}
            spec={spec}
            value={values[spec.id] ?? spec.default}
            onChange={(value) => {
              instrument().setValue(spec.id, value);
            }}
            onGesture={start}
          />
        ))}
      </main>

      <div className={styles.octave}>
        <button
          type="button"
          className={styles.octaveButton}
          onClick={() => {
            shiftOctave(-1);
          }}
          aria-label="Octave down"
        >
          &minus;
        </button>
        <span>Oct {octave}</span>
        <button
          type="button"
          className={styles.octaveButton}
          onClick={() => {
            shiftOctave(1);
          }}
          aria-label="Octave up"
        >
          +
        </button>
        {!isPhone && (
          <span className={styles.hint}>Play with A&ndash;L, Z/X for octave</span>
        )}
      </div>

      <div className={styles.keyboardArea}>
        {isPhone ? (
          <Pads baseMidi={baseMidi} held={held} noteOn={noteOn} noteOff={noteOff} />
        ) : (
          <Keys baseMidi={baseMidi} held={held} noteOn={noteOn} noteOff={noteOff} />
        )}
      </div>
    </div>
  );
}
