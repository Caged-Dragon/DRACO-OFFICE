import { type ShapeData } from '../shapes';
import { Check, Field } from './shared';

export function ShapeForm({ d, setD }: { d: ShapeData; setD: (d: ShapeData) => void }) {
  const set = (p: Partial<ShapeData>) => setD({ ...d, ...p });
  return (
    <div className="stack">
      {d.kind !== 'icon' && d.kind !== 'line' && (
        <Field label="Text">
          <textarea rows={2} value={d.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      )}
      <div className="grid2">
        {d.kind !== 'text' && d.kind !== 'line' && (
          <Field label="Fill">
            <input type="color" value={d.fill ?? '#4472C4'} onChange={(e) => set({ fill: e.target.value })} />
          </Field>
        )}
        {d.kind !== 'text' && (
          <Field label="Outline">
            <input type="color" value={d.stroke ?? '#2F528F'} onChange={(e) => set({ stroke: e.target.value })} />
          </Field>
        )}
        {d.kind !== 'icon' && d.kind !== 'line' && (
          <Field label="Text color">
            <input
              type="color"
              value={d.color ?? (d.kind === 'text' ? '#222222' : '#ffffff')}
              onChange={(e) => set({ color: e.target.value })}
            />
          </Field>
        )}
        {d.kind !== 'icon' && d.kind !== 'line' && (
          <Field label="Font size">
            <input
              type="number"
              min={8}
              max={72}
              value={d.size ?? 14}
              onChange={(e) => set({ size: Math.min(72, Math.max(8, +e.target.value || 14)) })}
            />
          </Field>
        )}
        <Field label="Outline width">
          <input
            type="number"
            min={0}
            max={12}
            value={d.strokeWidth ?? (d.kind === 'text' ? 0 : 2)}
            onChange={(e) => set({ strokeWidth: Math.max(0, +e.target.value || 0) })}
          />
        </Field>
        {d.kind !== 'icon' && d.kind !== 'line' && (
          <Field label="Align">
            <select value={d.align ?? 'center'} onChange={(e) => set({ align: e.target.value as ShapeData['align'] })}>
              <option>left</option>
              <option>center</option>
              <option>right</option>
            </select>
          </Field>
        )}
      </div>
      <div className="checks">
        <Check label="Bold" checked={!!d.bold} onChange={(v) => set({ bold: v })} />
        <Check label="Italic" checked={!!d.italic} onChange={(v) => set({ italic: v })} />
        <Check label="Dashed outline" checked={!!d.dashed} onChange={(v) => set({ dashed: v })} />
        <Check label="Shadow" checked={!!d.shadow} onChange={(v) => set({ shadow: v })} />
      </div>
    </div>
  );
}
