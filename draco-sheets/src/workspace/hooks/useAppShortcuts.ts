import { useEffect } from 'react';

/** Ctrl/Cmd+S saves, Ctrl/Cmd+P opens print, and the workbook is saved when the tab is hidden. */
export function useAppShortcuts(flush: () => Promise<void>, openPrint: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void flush();
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        openPrint();
      }
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush, openPrint]);
}
