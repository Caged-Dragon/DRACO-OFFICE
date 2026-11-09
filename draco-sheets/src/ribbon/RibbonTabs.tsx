import { TABS, type RibbonTab } from './types';
/** The tab strip: File … Help, plus the collapse toggle. Clicking the open tab collapses the ribbon. */
export function RibbonTabs({
  tab,
  open,
  onPick,
  onToggle,
}: {
  tab: RibbonTab;
  open: boolean;
  onPick: (t: RibbonTab) => void;
  onToggle: () => void;
}) {
  return (
    <div className="rb-tabs" role="tablist">
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={t !== 'File' && tab === t}
          aria-haspopup={t === 'File' ? 'dialog' : undefined}
          className={t === 'File' ? 'file' : tab === t ? 'on' : ''}
          onClick={() => (tab === t && open ? onToggle() : onPick(t))}
        >
          {t}
        </button>
      ))}
      <span className="rb-sp" />
      <button
        type="button"
        className="rb-fold"
        aria-label={open ? 'Collapse the ribbon' : 'Expand the ribbon'}
        title={open ? 'Collapse the ribbon' : 'Expand the ribbon'}
        onClick={onToggle}
      >
        {open ? '⌃' : '⌄'}
      </button>
    </div>
  );
}
