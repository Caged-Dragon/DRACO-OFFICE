import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { renderSparkline, type SparkOpts } from './spark';
import { renderShape, type ShapeData } from './shapes';
import { renderDiagram, type DiagramData } from './diagrams';
import { renderCamera, type CamData } from './camera';

interface Layout {
  width: number;
  height: number;
}
interface HostProps {
  hostFloatDomLayout$?: { subscribe: (f: (l: Layout) => void) => { unsubscribe: () => void }; getValue?: () => Layout };
}
function useSize(p: HostProps, dw: number, dh: number): Layout {
  const [size, setSize] = useState<Layout>(() => p.hostFloatDomLayout$?.getValue?.() ?? { width: dw, height: dh });
  useEffect(() => {
    const s = p.hostFloatDomLayout$?.subscribe((l) => {
      if (l && l.width > 0 && l.height > 0) setSize({ width: l.width, height: l.height });
    });
    return () => s?.unsubscribe();
  }, [p.hostFloatDomLayout$]);
  return size;
}
const Box = ({ html, cls, fit }: { html: string; cls: string; fit?: boolean }) => (
  <div
    className={cls}
    style={{ width: '100%', height: '100%', overflow: 'hidden', ...(fit ? {} : {}) }}
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

export function SparkView(p: HostProps & { data?: { values: Array<number | null>; opts: SparkOpts } }) {
  const s = useSize(p, 100, 24);
  if (!p.data) return null;
  return (
    <Box
      cls="draco-spark"
      html={renderSparkline(
        p.data.values,
        p.data.opts,
        Math.max(20, Math.round(s.width)),
        Math.max(12, Math.round(s.height)),
      )}
    />
  );
}
export function ShapeView(p: HostProps & { data?: ShapeData }) {
  const s = useSize(p, 160, 100);
  if (!p.data) return null;
  return (
    <Box
      cls="draco-shape"
      html={renderShape(p.data, Math.max(20, Math.round(s.width)), Math.max(14, Math.round(s.height)))}
    />
  );
}
export function DiagramView(p: HostProps & { data?: DiagramData }) {
  const s = useSize(p, 460, 300);
  if (!p.data) return null;
  return (
    <Box
      cls="draco-diagram"
      html={renderDiagram(p.data, Math.max(120, Math.round(s.width)), Math.max(90, Math.round(s.height)))}
    />
  );
}
export function CameraView(p: HostProps & { data?: CamData }) {
  const s = useSize(p, 300, 120);
  if (!p.data) return null;
  const r = renderCamera(p.data);
  return (
    <Box
      cls="draco-camera"
      html={r.svg.replace(
        /width="[\d.]+" height="[\d.]+"/,
        `width="${Math.round(s.width)}" height="${Math.round(s.height)}" preserveAspectRatio="none"`,
      )}
    />
  );
}

interface PivotBridge {
  menu?: (pid: string, field: string) => { items: Array<{ label: string; on: boolean }> } | null;
  transform?: (
    pid: string,
    kind: 'slicer' | 'timeline',
    field: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ) => unknown;
  slicerClick: (pivotId: string, field: string, label: string, multi: boolean) => void;
  timelineClick: (pivotId: string, from: number | null, to: number | null) => void;
}
const bridge = (): PivotBridge | undefined => (window as unknown as { dracoPivotUI?: PivotBridge }).dracoPivotUI;
const panel: CSSProperties = {
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  background: '#fff',
  border: '1px solid #c9ced6',
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'Segoe UI, Roboto, Arial, sans-serif',
  fontSize: 13,
  overflow: 'hidden',
};
const head: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 8px',
  background: '#eef2f7',
  fontWeight: 600,
  borderBottom: '1px solid #d8dde5',
};

const multiSel = new Set<string>();
/** Drag (header) or resize (corner) with a ghost outline; the float is rebuilt once on release (v75). */
function startGesture(
  ev: PointerEvent,
  panelEl: HTMLElement | null,
  mode: 'move' | 'size',
  apply: (dx: number, dy: number) => void,
) {
  if (!panelEl || ev.button !== 0) return;
  ev.preventDefault();
  ev.stopPropagation();
  const r = panelEl.getBoundingClientRect();
  const x0 = ev.clientX,
    y0 = ev.clientY;
  const ghost = document.createElement('div');
  ghost.className = 'draco-ghost';
  ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border:2px dashed #2F6FBA;background:rgba(47,111,186,.08);z-index:9999;pointer-events:none;box-sizing:border-box`;
  document.body.appendChild(ghost);
  const move = (e: PointerEvent) => {
    const dx = e.clientX - x0,
      dy = e.clientY - y0;
    if (mode === 'move') {
      ghost.style.left = r.left + dx + 'px';
      ghost.style.top = r.top + dy + 'px';
    } else {
      ghost.style.width = Math.max(60, r.width + dx) + 'px';
      ghost.style.height = Math.max(40, r.height + dy) + 'px';
    }
  };
  const up = (e: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    ghost.remove();
    const dx = e.clientX - x0,
      dy = e.clientY - y0;
    if (Math.abs(dx) + Math.abs(dy) > 2) apply(dx, dy);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
const grip: CSSProperties = {
  position: 'absolute',
  right: 0,
  bottom: 0,
  width: 16,
  height: 16,
  cursor: 'nwse-resize',
  background:
    'linear-gradient(135deg, transparent 50%, #8a94a3 50%, #8a94a3 60%, transparent 60%, transparent 72%, #8a94a3 72%, #8a94a3 82%, transparent 82%)',
  touchAction: 'none',
};
/** Keep pointer events inside the widget so the sheet's object-selection layer doesn't swallow button clicks. */
function useShield(kind: 'slicer' | 'timeline', pivotId?: string, field?: string) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef({ pivotId, field });
  id.current = { pivotId, field };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const names = ['mousedown', 'touchstart', 'dblclick'];
    names.forEach((n) => el.addEventListener(n, stop));
    const down = (e: PointerEvent) => {
      e.stopPropagation();
      const t = e.target as HTMLElement;
      const { pivotId: pid, field: f } = id.current;
      if (!pid || !f) return;
      const call = (dx: number, dy: number, dw: number, dh: number) =>
        bridge()?.transform?.(pid, kind, f, dx, dy, dw, dh);
      if (t.closest('[data-grip]')) startGesture(e, el, 'size', (dx, dy) => call(0, 0, dx, dy));
      else if (t.closest('[data-drag]') && !t.closest('button'))
        startGesture(e, el, 'move', (dx, dy) => call(dx, dy, 0, 0));
    };
    el.addEventListener('pointerdown', down);
    return () => {
      names.forEach((n) => el.removeEventListener(n, stop));
      el.removeEventListener('pointerdown', down);
    };
  }, [kind]);
  return ref;
}
export function SlicerView(p: {
  data?: { pivotId: string; field: string; title: string; items: Array<{ label: string; on: boolean }> };
}) {
  const d = p.data;
  const shield = useShield('slicer', d?.pivotId, d?.field);
  const [, bump] = useState(0);
  if (!d) return null;
  const mk = d.pivotId + '|' + d.field;
  const multi = multiSel.has(mk);
  const setMulti = (v: boolean) => {
    if (v) multiSel.add(mk);
    else multiSel.delete(mk);
    bump((n) => n + 1);
  };
  const anyOff = d.items.some((i) => !i.on);
  return (
    <div
      ref={shield}
      className="draco-slicer"
      style={{ ...panel, position: 'relative' }}
      role="group"
      aria-label={`Slicer ${d.title}`}
    >
      <div style={{ ...head, cursor: 'move', touchAction: 'none' }} data-drag="slicer">
        <span>{d.title}</span>
        <span>
          <button
            type="button"
            title="Multi-select"
            aria-label="Multi-select"
            aria-pressed={multi}
            onClick={() => setMulti(!multi)}
            style={{
              border: 0,
              background: multi ? '#D6E6F8' : 'transparent',
              cursor: 'pointer',
              fontSize: 14,
              borderRadius: 4,
            }}
          >
            ☑
          </button>
          <button
            type="button"
            title="Clear filter"
            aria-label="Clear filter"
            disabled={!anyOff}
            onClick={() => bridge()?.slicerClick(d.pivotId, d.field, '*', false)}
            style={{
              border: 0,
              background: 'transparent',
              cursor: anyOff ? 'pointer' : 'default',
              opacity: anyOff ? 1 : 0.35,
              fontSize: 14,
            }}
          >
            ✕
          </button>
        </span>
      </div>
      <div style={{ overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {d.items.map((i) => (
          <button
            key={i.label}
            type="button"
            aria-pressed={i.on}
            onClick={(ev) =>
              bridge()?.slicerClick(d.pivotId, d.field, i.label, multi || ev.ctrlKey || ev.metaKey || ev.shiftKey)
            }
            style={{
              textAlign: 'left',
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid ' + (i.on ? '#2F6FBA' : '#d0d5dc'),
              background: i.on ? '#D6E6F8' : '#f4f5f7',
              color: i.on ? '#1d2b3a' : '#9aa1ab',
              cursor: 'pointer',
            }}
          >
            {i.label}
          </button>
        ))}
      </div>
      <div data-grip="1" title="Drag to resize" aria-hidden="true" style={grip} />
    </div>
  );
}
export function TimelineView(p: {
  data?: {
    pivotId: string;
    field: string;
    title: string;
    months: Array<{ label: string; from: number; to: number }>;
    from: number | null;
    to: number | null;
  };
}) {
  const d = p.data;
  const shield = useShield('timeline', d?.pivotId, d?.field);
  const [anchor, setAnchor] = useState<number | null>(null);
  if (!d) return null;
  const sel = (m: { from: number; to: number }) => d.from !== null && d.to !== null && m.from >= d.from && m.to <= d.to;
  return (
    <div
      ref={shield}
      className="draco-timeline"
      style={{ ...panel, position: 'relative' }}
      role="group"
      aria-label={`Timeline ${d.title}`}
    >
      <div style={{ ...head, cursor: 'move', touchAction: 'none' }} data-drag="timeline">
        <span>{d.title}</span>
        <button
          type="button"
          title="Clear filter"
          aria-label="Clear filter"
          disabled={d.from === null}
          onClick={() => {
            setAnchor(null);
            bridge()?.timelineClick(d.pivotId, null, null);
          }}
          style={{
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            opacity: d.from === null ? 0.35 : 1,
            fontSize: 14,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ overflowX: 'auto', padding: 8, display: 'flex', gap: 4 }}>
        {d.months.map((m, i) => (
          <button
            key={m.label}
            type="button"
            aria-pressed={sel(m)}
            onClick={(ev) => {
              if (ev.shiftKey && anchor !== null) {
                const a = d.months[Math.min(anchor, i)],
                  b = d.months[Math.max(anchor, i)];
                bridge()?.timelineClick(d.pivotId, a.from, b.to);
              } else {
                setAnchor(i);
                bridge()?.timelineClick(d.pivotId, m.from, m.to);
              }
            }}
            style={{
              whiteSpace: 'nowrap',
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid ' + (sel(m) ? '#2F6FBA' : '#d0d5dc'),
              background: sel(m) ? '#D6E6F8' : '#f4f5f7',
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div data-grip="1" title="Drag to resize" aria-hidden="true" style={grip} />
    </div>
  );
}

/** ▾ button on a pivot header: lists the field's items with check boxes (v77). */
export function PivotBtnView(p: { data?: { pivotId: string; field: string } }) {
  const d = p.data;
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState<{ x: number; y: number; items: Array<{ label: string; on: boolean }> } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    const n = ['pointerdown', 'mousedown', 'touchstart', 'dblclick'];
    n.forEach((x) => el.addEventListener(x, stop));
    return () => n.forEach((x) => el.removeEventListener(x, stop));
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!(e.target as HTMLElement).closest?.('.draco-fieldmenu') && e.target !== ref.current) setOpen(null);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', esc, true);
    };
  }, [open]);
  if (!d) return null;
  const show = () => {
    const m = bridge()?.menu?.(d.pivotId, d.field);
    const r = ref.current?.getBoundingClientRect();
    if (m && r) setOpen({ x: r.left, y: r.bottom + 2, items: m.items });
  };
  const toggle = (label: string) => {
    bridge()?.slicerClick(d.pivotId, d.field, label, true);
    const m = bridge()?.menu?.(d.pivotId, d.field);
    setOpen((o) => (o && m ? { ...o, items: m.items } : o));
  };
  const anyOff = open?.items.some((i) => !i.on);
  return (
    <>
      <button
        ref={ref}
        type="button"
        className="draco-fieldbtn"
        aria-label={`Filter ${d.field}`}
        aria-haspopup="true"
        aria-expanded={!!open}
        onClick={() => (open ? setOpen(null) : show())}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 0,
          minWidth: 0,
          padding: 0,
          border: '1px solid #b8c0cc',
          borderRadius: 3,
          background: '#fff',
          fontSize: 10,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ▾
      </button>
      {open &&
        createPortal(
          <div
            className="draco-fieldmenu"
            role="menu"
            aria-label={`${d.field} items`}
            style={{
              position: 'fixed',
              left: open.x,
              top: open.y,
              zIndex: 9999,
              minWidth: 160,
              maxHeight: 280,
              overflowY: 'auto',
              background: '#fff',
              color: '#1c2321',
              border: '1px solid #c9ced6',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,.25)',
              padding: 6,
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, padding: '2px 4px' }}>{d.field}</div>
            <button
              type="button"
              style={{
                minHeight: 0,
                border: 0,
                background: 'transparent',
                color: '#2F6FBA',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
              disabled={!anyOff}
              onClick={() => {
                bridge()?.slicerClick(d.pivotId, d.field, '*', false);
                const m = bridge()?.menu?.(d.pivotId, d.field);
                if (m) setOpen({ ...open, items: m.items });
              }}
            >
              Select all
            </button>
            {open.items.map((i) => (
              <label
                key={i.label}
                role="menuitemcheckbox"
                aria-checked={i.on}
                style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '2px 4px', cursor: 'pointer' }}
              >
                <input type="checkbox" checked={i.on} onChange={() => toggle(i.label)} />
                {i.label}
              </label>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
