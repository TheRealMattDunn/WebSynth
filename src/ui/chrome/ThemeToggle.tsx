import { useEffect } from 'react';
import type { ThemePreference } from '@/core/store/instrument';
import { instrument, useInstrument } from '@/ui/hooks/useInstrument';
import styles from './Chrome.module.css';

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemePreference, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export function ThemeToggle() {
  const theme = useInstrument((s) => s.theme);

  useEffect(() => {
    // 'system' removes the attribute entirely, letting prefers-color-scheme decide.
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? 'system';
    instrument().setTheme(next);
  };

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={cycle}
      aria-label={`Theme: ${LABEL[theme]}. Activate to change.`}
    >
      {LABEL[theme]}
    </button>
  );
}
