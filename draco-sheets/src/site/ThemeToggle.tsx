import { useEffect, useState } from 'react';
import { isDarkNow, toggleTheme } from '../gallery/galleryGlue';

/** Sun / moon button: gold light mode, purple dark mode. */
export default function ThemeToggle({ className = 'tt' }: { className?: string }) {
  const [dark, setDark] = useState(() => isDarkNow());
  useEffect(() => {
    const f = () => setDark(isDarkNow());
    window.addEventListener('draco-theme', f);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', f);
    return () => {
      window.removeEventListener('draco-theme', f);
      mq?.removeEventListener?.('change', f);
    };
  }, []);
  return (
    <button
      type="button"
      className={`${className} theme-toggle`}
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to the gold light theme' : 'Switch to the purple dark theme'}
      title={dark ? 'Light mode (gold)' : 'Dark mode (purple)'}
    >
      {dark ? '☀' : '☾'}
    </button>
  );
}
