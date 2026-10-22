import { useState, type KeyboardEvent } from "react";

type TabId = "home" | "view";
const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "view", label: "View" },
];

interface Props {
  index: number;
  slideCount: number;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onRenameSlide: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPrevious: () => void;
  onNext: () => void;
  showSlidePane: boolean;
  showTextPanel: boolean;
  onToggleSlidePane: () => void;
  onToggleTextPanel: () => void;
}

export function Ribbon(p: Props) {
  const [tab, setTab] = useState<TabId>("home");

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    setTab(next.id);
    document.getElementById(`ribbon-tab-${next.id}`)?.focus();
  };

  return (
    <div className="ribbon">
      <div className="ribbon__tabs" role="tablist" aria-label="Ribbon" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`ribbon-tab-${t.id}`}
            role="tab"
            className={`ribbon__tab${tab === t.id ? " ribbon__tab--active" : ""}`}
            aria-selected={tab === t.id}
            aria-controls={`ribbon-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ribbon__panel" role="tabpanel" id={`ribbon-panel-${tab}`} aria-labelledby={`ribbon-tab-${tab}`}>
        {tab === "home" ? (
          <>
            <div className="rgroup" role="group" aria-label="Slides">
              <div className="rgroup__buttons">
                <button className="btn btn--primary" onClick={p.onAddSlide}>New slide</button>
                <button className="btn" onClick={p.onDuplicateSlide}>Duplicate slide</button>
                <button className="btn" onClick={p.onRenameSlide}>Rename slide</button>
                <button className="btn" disabled={p.slideCount <= 1} onClick={p.onDeleteSlide}>Delete slide</button>
              </div>
              <span className="rgroup__label">Slides</span>
            </div>
            <div className="rgroup" role="group" aria-label="Arrange">
              <div className="rgroup__buttons">
                <button className="btn" disabled={p.index === 0} onClick={p.onMoveUp}>Move up</button>
                <button className="btn" disabled={p.index === p.slideCount - 1} onClick={p.onMoveDown}>Move down</button>
              </div>
              <span className="rgroup__label">Arrange</span>
            </div>
            <div className="rgroup" role="group" aria-label="Navigate">
              <div className="rgroup__buttons">
                <button className="btn" disabled={p.index === 0} onClick={p.onPrevious}>Previous</button>
                <button className="btn" disabled={p.index === p.slideCount - 1} onClick={p.onNext}>Next</button>
              </div>
              <span className="rgroup__label">Navigate</span>
            </div>
          </>
        ) : (
          <div className="rgroup" role="group" aria-label="Show">
            <div className="rgroup__buttons">
              <button className="btn" aria-pressed={p.showSlidePane} onClick={p.onToggleSlidePane}>Slide pane</button>
              <button className="btn" aria-pressed={p.showTextPanel} onClick={p.onToggleTextPanel}>Text panel</button>
            </div>
            <span className="rgroup__label">Show</span>
          </div>
        )}
      </div>
    </div>
  );
}
