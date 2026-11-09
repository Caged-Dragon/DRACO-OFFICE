import { useEffect } from 'react';
import type { Engine } from '../../core/engine';
import { isDarkNow } from '../../gallery/galleryGlue';

/** Keeps the spreadsheet engine's dark mode in step with the app theme and the OS setting. */
export function useThemeSync(engine: { current: Engine | null }, ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const sync = () => {
      try {
        (engine.current?.api as unknown as { toggleDarkMode(d: boolean): void }).toggleDarkMode(isDarkNow());
      } catch {
        /* engine not ready */
      }
    };
    sync();
    window.addEventListener('draco-theme', sync);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener('draco-theme', sync);
      mq?.removeEventListener?.('change', sync);
    };
  }, [engine, ready]);
}
