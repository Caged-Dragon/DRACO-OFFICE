import Dialog from './Dialog';
import { CELL_STYLES, type CellStyle } from './cellStyles';
import type { Engine } from './engine';

const GROUPS = ['Good, Bad and Neutral', 'Data and Model', 'Titles and Headings', 'Themed Cell Styles', 'Number Format'] as const;

export function applyCellStyle(engine: Engine, st: CellStyle): boolean {
  const api = engine.api;
  const range = api.getActiveWorkbook()?.getActiveSheet().getActiveRange();
  if (!range) return false;
  const E = api.Enum;
  range.setFontColor(st.fg ?? null as never).setBackground(st.bg ?? null as never);
  range.setFontWeight(st.bold ? 'bold' : 'normal').setFontStyle(st.italic ? 'italic' : 'normal');
  if (st.size) range.setFontSize(st.size);
  if (st.family) range.setFontFamily(st.family);
  if (st.numfmt) range.setNumberFormat(st.numfmt);
  const c = st.borderColor ?? '#000000';
  switch (st.border) {
    case 'bottom': range.setBorder(E.BorderType.BOTTOM, E.BorderStyleTypes.THIN, c); break;
    case 'bottom-thick': range.setBorder(E.BorderType.BOTTOM, E.BorderStyleTypes.THICK, c); break;
    case 'bottom-double': range.setBorder(E.BorderType.BOTTOM, E.BorderStyleTypes.DOUBLE, c); break;
    case 'top-bottom': range.setBorder(E.BorderType.TOP, E.BorderStyleTypes.THIN, c); range.setBorder(E.BorderType.BOTTOM, E.BorderStyleTypes.THIN, c); break;
    case 'top-bottom-double': range.setBorder(E.BorderType.TOP, E.BorderStyleTypes.THIN, c); range.setBorder(E.BorderType.BOTTOM, E.BorderStyleTypes.DOUBLE, c); break;
    case 'box': range.setBorder(E.BorderType.OUTSIDE, E.BorderStyleTypes.THIN, c); break;
    case 'box-double': range.setBorder(E.BorderType.OUTSIDE, E.BorderStyleTypes.DOUBLE, c); break;
    case 'box-medium-orange': range.setBorder(E.BorderType.OUTSIDE, E.BorderStyleTypes.MEDIUM, '#FF8001'); break;
    default: break;
  }
  return true;
}

export default function CellStylesDialog({ engine, onClose }: { engine: Engine | null; onClose: () => void }) {
  return (
    <Dialog title="Cell styles" onClose={onClose} wide>
      <p className="hint">Select cells first, then pick a style.</p>
      {GROUPS.map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          <div className="swatches">
            {CELL_STYLES.filter((s) => s.group === g).map((s) => (
              <button
                key={s.name}
                className="swatch"
                style={{
                  color: s.fg, background: s.bg, fontWeight: s.bold ? 700 : 400, fontStyle: s.italic ? 'italic' : 'normal',
                  fontSize: Math.min(s.size ?? 13, 16), fontFamily: s.family,
                  borderBottom: s.border?.startsWith('bottom') || s.border?.startsWith('top') ? `3px ${s.border.includes('double') ? 'double' : 'solid'} ${s.borderColor}` : undefined,
                  outline: s.border?.startsWith('box') ? `1px solid ${s.borderColor}` : undefined,
                }}
                onClick={() => { if (engine && applyCellStyle(engine, s)) onClose(); }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </Dialog>
  );
}
