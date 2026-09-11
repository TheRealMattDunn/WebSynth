import { BRAND } from '@/core/brand';
import styles from './Chrome.module.css';

interface StartOverlayProps {
  onStart: () => void;
  error: string | null;
  starting: boolean;
}

/**
 * Every browser requires a genuine user gesture before audio may start, and
 * Safari is strictest about what counts. Rather than failing silently on the
 * first keypress, the instrument asks for that gesture up front and uses the
 * moment to say what it is.
 */
export function StartOverlay({ onStart, error, starting }: StartOverlayProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.overlayInner}>
        <h1 className={styles.overlayTitle}>{BRAND.name}</h1>
        <p className={styles.overlayTagline}>{BRAND.tagline}</p>
        <button
          type="button"
          className={styles.startButton}
          onClick={onStart}
          onPointerDown={onStart}
          disabled={starting}
        >
          {starting ? 'Starting' : 'Begin'}
        </button>
        {error !== null && <p className={styles.error}>Audio failed to start: {error}</p>}
      </div>
    </div>
  );
}
