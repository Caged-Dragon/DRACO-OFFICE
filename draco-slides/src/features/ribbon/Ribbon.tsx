import { useState, type KeyboardEvent, type MouseEvent } from "react";
import { NumberField } from "../../components/common/NumberField";
import { MAX_MARGIN, marginPatch, type BoxPatch } from "../../core/document-model/box";
import { GRID_SIZES, type Settings } from "../../services/settings/settingsStore";
import { MAX_OBJECT_SIZE, MIN_OBJECT_SIZE, MIN_VISIBLE, type Rect } from "../../core/geometry/rect";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_TEXT_COLOR,
  FONT_FAMILIES,
  formatPatch,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  nextFontSize,
} from "../../core/document-model/fonts";
import { levelRange, MAX_LIST_LEVEL } from "../../core/document-model/lists";
import {
  LINE_SPACING_PRESETS,
  MAX_INDENT_LEVEL,
  paragraphPatch,
} from "../../core/document-model/paragraph";
import type { Alignment, ParagraphFormat, TextFormat, TextObject } from "../../core/document-model/types";

type TabId = "home" | "insert" | "view";
const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "insert", label: "Insert" },
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
  hasSelection: boolean;
  /** How many objects are selected, and what the selection allows. */
  selectionCount: number;
  canGroup: boolean;
  canUngroup: boolean;
  allLocked: boolean;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleLock: () => void;
  onSelectAll: () => void;
  canEditText: boolean;
  onEditText: () => void;
  /** Formatting of the selected text object, or null when no text object is selected. */
  format: TextObject | null;
  onFormat: (patch: Partial<Record<keyof TextFormat, unknown>>) => void;
  onParagraph: (patch: Partial<Record<keyof ParagraphFormat, unknown>>) => void;
  onListLevel: (delta: 1 | -1) => void;
  onBox: (patch: BoxPatch) => void;
  /** Position and size of the selected object (any kind), or null. */
  position: Rect | null;
  slideSize: { width: number; height: number };
  onRect: (rect: Rect) => void;
  viewOptions: Pick<Settings, "showRulers" | "showGrid" | "gridSize" | "snapToGrid" | "snapToObjects">;
  onViewOptions: (patch: Partial<Pick<Settings, "showRulers" | "showGrid" | "gridSize" | "snapToGrid" | "snapToObjects">>) => void;
  onFit: (mode: "shrink" | "resize") => void;
  onAddTextBox: () => void;
  onDeleteObject: () => void;
  showSlidePane: boolean;
  showTextPanel: boolean;
  onToggleSlidePane: () => void;
  onToggleTextPanel: () => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitZoom: () => void;
  onActualSize: () => void;
}

/** Keeps keyboard focus where it is (for example in the text editor) when a toolbar button is pressed. */
const keepFocus = (e: MouseEvent) => e.preventDefault();

export function Ribbon(p: Props) {
  const [tab, setTab] = useState<TabId>("home");
  const f = p.format;
  const alignButtons: { value: Alignment; label: string; text: string }[] = [
    { value: "left", label: "Align left", text: "Left" },
    { value: "center", label: "Center", text: "Center" },
    { value: "right", label: "Align right", text: "Right" },
    { value: "justify", label: "Justify", text: "Justify" },
  ];
  const spacingOptions: number[] = [...LINE_SPACING_PRESETS];
  if (f && !spacingOptions.includes(f.lineSpacing)) spacingOptions.push(f.lineSpacing);
  spacingOptions.sort((a, b) => a - b);
  const levels = f ? levelRange(f.text) : { min: 0, max: 0 };
  const inList = !!f && f.list !== "none";
  const toggles = [
    { key: "bold", label: "Bold", glyph: <b>B</b> },
    { key: "italic", label: "Italic", glyph: <i>I</i> },
    { key: "underline", label: "Underline", glyph: <u>U</u> },
    { key: "strike", label: "Strikethrough", glyph: <s>S</s> },
  ] as const;

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

      {/* Both panels always exist so every tab's aria-controls points at a real element. */}
      <div
        className="ribbon__panel"
        role="tabpanel"
        id="ribbon-panel-home"
        aria-labelledby="ribbon-tab-home"
        hidden={tab !== "home"}
      >
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
        <div className="rgroup" role="group" aria-label="Object">
          <div className="rgroup__buttons">
            <button className="btn" disabled={!p.canEditText} onClick={p.onEditText}>Edit text</button>
            <button className="btn" disabled={!p.hasSelection} onClick={p.onDeleteObject}>Delete object</button>
          </div>
          <span className="rgroup__label">Object</span>
        </div>
        <div className="rgroup" role="group" aria-label="Group and lock">
          <div className="rgroup__buttons">
            <button className="btn" onClick={p.onSelectAll}>Select all</button>
            <button className="btn" disabled={!p.canGroup} onClick={p.onGroup}>Group</button>
            <button className="btn" disabled={!p.canUngroup} onClick={p.onUngroup}>Ungroup</button>
            <button className="btn" aria-pressed={p.allLocked} disabled={p.selectionCount === 0} onClick={p.onToggleLock}>Lock</button>
          </div>
          <span className="rgroup__label">Group and lock</span>
        </div>
        <div className="rgroup" role="group" aria-label="Font">
          <div className="rgroup__buttons">
            <select
              aria-label="Font family"
              disabled={!f}
              value={f?.fontFamily ?? DEFAULT_FONT_FAMILY}
              onChange={(e) => p.onFormat({ fontFamily: e.target.value })}
            >
              {FONT_FAMILIES.map((ff) => (
                <option key={ff.name} value={ff.name}>
                  {ff.name}
                </option>
              ))}
            </select>
            <input
              key={f?.fontSize ?? "none"}
              className="fontsize"
              type="number"
              aria-label="Font size"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              disabled={!f}
              defaultValue={f?.fontSize ?? 24}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (f && e.target.value.trim() !== "" && Number.isFinite(value)) {
                  if (value !== f.fontSize) p.onFormat({ fontSize: value });
                } else if (f) {
                  e.target.value = String(f.fontSize); // not a number: show the real size again
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <button
              className="btn"
              aria-label="Increase font size"
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onFormat({ fontSize: nextFontSize(f.fontSize, 1) })}
            >
              A+
            </button>
            <button
              className="btn"
              aria-label="Decrease font size"
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onFormat({ fontSize: nextFontSize(f.fontSize, -1) })}
            >
              A−
            </button>
            {toggles.map((t) => (
              <button
                key={t.key}
                className="btn btn--glyph"
                aria-label={t.label}
                aria-pressed={f ? f[t.key] : false}
                disabled={!f}
                onMouseDown={keepFocus}
                onClick={() => f && p.onFormat(formatPatch(t.key, !f[t.key]))}
              >
                {t.glyph}
              </button>
            ))}
            <input
              className="colorpick"
              type="color"
              aria-label="Text color"
              disabled={!f}
              value={f?.color ?? DEFAULT_TEXT_COLOR}
              onChange={(e) => p.onFormat({ color: e.target.value })}
            />
          </div>
          <span className="rgroup__label">Font</span>
        </div>
        <div className="rgroup" role="group" aria-label="Paragraph">
          <div className="rgroup__buttons">
            {alignButtons.map((a) => (
              <button
                key={a.value}
                className="btn"
                aria-label={a.label}
                aria-pressed={f ? f.align === a.value : false}
                disabled={!f}
                onMouseDown={keepFocus}
                onClick={() => f && p.onParagraph(paragraphPatch("align", a.value))}
              >
                {a.text}
              </button>
            ))}
            <button
              className="btn"
              aria-label="Decrease indent"
              disabled={!f || f.indent <= 0}
              onMouseDown={keepFocus}
              onClick={() => f && p.onParagraph(paragraphPatch("indent", f.indent - 1))}
            >
              Indent −
            </button>
            <button
              className="btn"
              aria-label="Increase indent"
              disabled={!f || f.indent >= MAX_INDENT_LEVEL}
              onMouseDown={keepFocus}
              onClick={() => f && p.onParagraph(paragraphPatch("indent", f.indent + 1))}
            >
              Indent +
            </button>
            <select
              aria-label="Line spacing"
              disabled={!f}
              value={f?.lineSpacing ?? 1.2}
              onChange={(e) => p.onParagraph(paragraphPatch("lineSpacing", Number(e.target.value)))}
            >
              {spacingOptions.map((v) => (
                <option key={v} value={v}>
                  {Number.isInteger(v) ? v.toFixed(1) : String(v)}
                </option>
              ))}
            </select>
            <button
              className="btn"
              aria-label="Left-to-right"
              aria-pressed={f ? f.direction === "ltr" : false}
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onParagraph(paragraphPatch("direction", "ltr"))}
            >
              LTR
            </button>
            <button
              className="btn"
              aria-label="Right-to-left"
              aria-pressed={f ? f.direction === "rtl" : false}
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onParagraph(paragraphPatch("direction", "rtl"))}
            >
              RTL
            </button>
          </div>
          <span className="rgroup__label">Paragraph</span>
        </div>
        <div className="rgroup" role="group" aria-label="List">
          <div className="rgroup__buttons">
            <button
              className="btn"
              aria-label="Bullets"
              aria-pressed={f ? f.list === "bullet" : false}
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onParagraph(paragraphPatch("list", f.list === "bullet" ? "none" : "bullet"))}
            >
              Bullets
            </button>
            <button
              className="btn"
              aria-label="Numbering"
              aria-pressed={f ? f.list === "number" : false}
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onParagraph(paragraphPatch("list", f.list === "number" ? "none" : "number"))}
            >
              Numbering
            </button>
            <button
              className="btn"
              aria-label="Decrease list level"
              disabled={!inList || levels.max === 0}
              onMouseDown={keepFocus}
              onClick={() => p.onListLevel(-1)}
            >
              Level −
            </button>
            <button
              className="btn"
              aria-label="Increase list level"
              disabled={!inList || levels.min >= MAX_LIST_LEVEL}
              onMouseDown={keepFocus}
              onClick={() => p.onListLevel(1)}
            >
              Level +
            </button>
          </div>
          <span className="rgroup__label">List</span>
        </div>
        <div className="rgroup" role="group" aria-label="Text box">
          <div className="rgroup__buttons">
            {(["top", "middle", "bottom"] as const).map((v) => (
              <button
                key={v}
                className="btn"
                aria-label={`Align ${v}`}
                aria-pressed={f ? f.verticalAlign === v : false}
                disabled={!f}
                onMouseDown={keepFocus}
                onClick={() => p.onBox({ verticalAlign: v })}
              >
                {v === "top" ? "Top" : v === "middle" ? "Middle" : "Bottom"}
              </button>
            ))}
            {(
              [
                ["top", "T"],
                ["right", "R"],
                ["bottom", "B"],
                ["left", "L"],
              ] as const
            ).map(([side, short]) => (
              <NumberField
                key={side}
                label={`Margin ${side}`}
                short={short}
                value={f?.margins[side] ?? 0}
                min={0}
                max={MAX_MARGIN}
                step={1}
                disabled={!f}
                onCommit={(v) => p.onBox(marginPatch(side, v))}
              />
            ))}
            <button
              className="btn"
              aria-label="Clip overflow"
              aria-pressed={f ? f.overflow === "hidden" : false}
              disabled={!f}
              onMouseDown={keepFocus}
              onClick={() => f && p.onBox({ overflow: f.overflow === "hidden" ? "visible" : "hidden" })}
            >
              Clip
            </button>
            <button className="btn" aria-label="Shrink text to fit" disabled={!f} onMouseDown={keepFocus} onClick={() => p.onFit("shrink")}>
              Shrink to fit
            </button>
            <button className="btn" aria-label="Resize box to fit text" disabled={!f} onMouseDown={keepFocus} onClick={() => p.onFit("resize")}>
              Fit box
            </button>
          </div>
          <span className="rgroup__label">Text box</span>
        </div>
        <div className="rgroup" role="group" aria-label="Position">
          <div className="rgroup__buttons">
            <NumberField
              label="X position"
              short="X"
              value={p.position?.x ?? 0}
              min={p.position ? MIN_VISIBLE - p.position.width : 0}
              max={p.slideSize.width - MIN_VISIBLE}
              decimals={2}
              disabled={!p.position}
              onCommit={(v) => p.position && p.onRect({ ...p.position, x: v })}
            />
            <NumberField
              label="Y position"
              short="Y"
              value={p.position?.y ?? 0}
              min={p.position ? MIN_VISIBLE - p.position.height : 0}
              max={p.slideSize.height - MIN_VISIBLE}
              decimals={2}
              disabled={!p.position}
              onCommit={(v) => p.position && p.onRect({ ...p.position, y: v })}
            />
            <NumberField
              label="Width"
              short="W"
              value={p.position?.width ?? 0}
              min={MIN_OBJECT_SIZE}
              max={MAX_OBJECT_SIZE}
              decimals={2}
              disabled={!p.position}
              onCommit={(v) => p.position && p.onRect({ ...p.position, width: v })}
            />
            <NumberField
              label="Height"
              short="H"
              value={p.position?.height ?? 0}
              min={MIN_OBJECT_SIZE}
              max={MAX_OBJECT_SIZE}
              decimals={2}
              disabled={!p.position}
              onCommit={(v) => p.position && p.onRect({ ...p.position, height: v })}
            />
          </div>
          <span className="rgroup__label">Position</span>
        </div>
      </div>

      <div
        className="ribbon__panel"
        role="tabpanel"
        id="ribbon-panel-insert"
        aria-labelledby="ribbon-tab-insert"
        hidden={tab !== "insert"}
      >
        <div className="rgroup" role="group" aria-label="Text">
          <div className="rgroup__buttons">
            <button className="btn btn--primary" onClick={p.onAddTextBox}>Text box</button>
          </div>
          <span className="rgroup__label">Text</span>
        </div>
      </div>

      <div
        className="ribbon__panel"
        role="tabpanel"
        id="ribbon-panel-view"
        aria-labelledby="ribbon-tab-view"
        hidden={tab !== "view"}
      >
        <div className="rgroup" role="group" aria-label="Show">
          <div className="rgroup__buttons">
            <button className="btn" aria-pressed={p.showSlidePane} onClick={p.onToggleSlidePane}>Slide pane</button>
            <button className="btn" aria-pressed={p.showTextPanel} onClick={p.onToggleTextPanel}>Text panel</button>
          </div>
          <span className="rgroup__label">Show</span>
        </div>
        <div className="rgroup" role="group" aria-label="Zoom">
          <div className="rgroup__buttons">
            <button className="btn" onClick={p.onZoomOut}>Zoom out</button>
            <span className="rgroup__value" aria-live="polite">{p.zoomPercent}%</span>
            <button className="btn" onClick={p.onZoomIn}>Zoom in</button>
            <button className="btn" onClick={p.onFitZoom}>Fit to window</button>
            <button className="btn" onClick={p.onActualSize}>Actual size</button>
          </div>
          <span className="rgroup__label">Zoom</span>
        </div>
        <div className="rgroup" role="group" aria-label="Guides">
          <div className="rgroup__buttons">
            <button className="btn" aria-pressed={p.viewOptions.showRulers} onClick={() => p.onViewOptions({ showRulers: !p.viewOptions.showRulers })}>
              Rulers
            </button>
            <button className="btn" aria-pressed={p.viewOptions.showGrid} onClick={() => p.onViewOptions({ showGrid: !p.viewOptions.showGrid })}>
              Gridlines
            </button>
            <button className="btn" aria-pressed={p.viewOptions.snapToGrid} onClick={() => p.onViewOptions({ snapToGrid: !p.viewOptions.snapToGrid })}>
              Snap to grid
            </button>
            <button className="btn" aria-pressed={p.viewOptions.snapToObjects} onClick={() => p.onViewOptions({ snapToObjects: !p.viewOptions.snapToObjects })}>
              Snap to objects
            </button>
            <select aria-label="Grid size" value={p.viewOptions.gridSize} onChange={(e) => p.onViewOptions({ gridSize: Number(e.target.value) })}>
              {GRID_SIZES.map((g) => (
                <option key={g} value={g}>
                  {g} px
                </option>
              ))}
            </select>
          </div>
          <span className="rgroup__label">Guides</span>
        </div>
      </div>
    </div>
  );
}
