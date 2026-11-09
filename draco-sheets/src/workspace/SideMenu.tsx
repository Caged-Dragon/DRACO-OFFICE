import { toggleTheme } from '../gallery/galleryGlue';
import { useEffect, useRef } from 'react';
import { cloudEnabled } from '../core/supabase';
import { changeIndent } from '../core/indent';
import { goTo } from './navigate';
import { run as runCmd } from '../cmd/cmdGlue';
import type { TopBarProps } from './TopBar';

type Entry = { icon: string; label: string; run: () => void; mobileOnly?: boolean };

/** Left drawer opened by the hamburger: file actions, panels, tools and settings (kept out of the title bar). */
export default function SideMenu({
  t,
  flush,
  newWorkbook,
  setDialog,
  openReview,
  openTools,
  engine,
  cloud,
  moveToCloud,
  session,
  setMenu,
  setPalette,
}: TopBarProps) {
  const box = useRef<HTMLElement>(null);
  const close = () => setMenu(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('keydown', esc);
    box.current?.querySelector('button')?.focus();
    return () => document.removeEventListener('keydown', esc);
  }, [setMenu]);
  const sections: [string, Entry[]][] = [
    [
      'File',
      [
        { icon: '🗋', label: t('New workbook'), run: () => void newWorkbook() },
        { icon: '🗁', label: t('Open…'), run: () => setDialog('open') },
        { icon: '💾', label: t('Save now'), run: () => void flush() },
        ...(cloudEnabled && !cloud ? [{ icon: '☁', label: t('Sync to cloud'), run: () => void moveToCloud() }] : []),
        { icon: '⇅', label: t('Files'), run: () => setDialog('files') },
        { icon: '🖶', label: t('Print'), run: () => setDialog('print') },
        { icon: '⟲', label: t('Version history'), run: () => void runCmd('open.versions') },
      ],
    ],
    [
      'Workbook',
      [
        { icon: '🎨', label: t('Cell styles'), run: () => setDialog('styles') },
        { icon: 'ƒx', label: t('Formulas'), run: () => setDialog('formulas') },
        { icon: '🗂', label: t('Data tools'), run: () => setDialog('data') },
        { icon: '📊', label: t('Charts'), run: () => setDialog('charts') },
        { icon: '🧩', label: t('Objects'), run: () => setDialog('objects') },
        { icon: '🔀', label: t('PivotTable'), run: () => setDialog('pivot') },
        { icon: '🛢', label: t('Queries'), run: () => setDialog('query') },
      ],
    ],
    [
      'Collaborate',
      [
        { icon: '💬', label: t('Review (comments, changes)'), run: () => openReview('comments') },
        { icon: '⇪', label: t('Share & live session'), run: () => openReview('share') },
        { icon: '🔒', label: t('Protect'), run: () => openReview('protect') },
      ],
    ],
    [
      'More',
      [
        { icon: '⇥', label: t('Increase indent'), run: () => engine && void changeIndent(engine, 1), mobileOnly: true },
        {
          icon: '⇤',
          label: t('Decrease indent'),
          run: () => engine && void changeIndent(engine, -1),
          mobileOnly: true,
        },
        { icon: '🛠', label: t('Tools (macros, scripts…)'), run: () => openTools('macros') },
        { icon: '🖼', label: t('Templates & themes'), run: () => openTools('templates') },
        { icon: '⌕', label: t('Command search'), run: () => setPalette(true) },
        { icon: '⌂', label: t('Start screen'), run: () => void flush().then(() => goTo('/home')) },
        { icon: '⚙', label: t('Settings'), run: () => void flush().then(() => goTo('/settings')) },
        { icon: '◐', label: t('Switch theme (gold / purple)'), run: toggleTheme, mobileOnly: true },
        { icon: '👤', label: session ? t('Account') : t('Sign in'), run: () => setDialog('auth'), mobileOnly: true },
      ],
    ],
  ];
  return (
    <>
      <div className="drawer-backdrop" onClick={close} />
      <nav className="drawer" ref={box} role="dialog" aria-label={t('Menu')}>
        <div className="drawer-head">
          <strong>Draco Sheets</strong>
          <button className="icon" aria-label={t('Close menu')} onClick={close}>
            ✕
          </button>
        </div>
        {sections.map(([name, items]) => (
          <div className="drawer-sec" key={name}>
            <h3>{t(name)}</h3>
            {items.map((it) => (
              <button
                key={it.label}
                className={it.mobileOnly ? 'only-mobile' : undefined}
                onClick={() => {
                  close();
                  it.run();
                }}
              >
                <span aria-hidden>{it.icon}</span>
                {it.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}
