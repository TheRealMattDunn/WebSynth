import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { engine } from '@/ui/hooks/useAudio';
import { instrumentStore } from '@/ui/hooks/useInstrument';
import { App } from './app/App';
import '@/ui/theme/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// A handle on the instrument from the console, for poking at the audio graph
// while developing. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).type4 = {
    engine,
    store: instrumentStore,
  };
}
