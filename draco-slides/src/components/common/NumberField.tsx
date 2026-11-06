interface Props {
  /** Accessible name. */
  label: string;
  /** Short visible caption, for example "T" for the top margin. */
  short: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Round entries to this many decimals before clamping (default: keep what was typed). */
  decimals?: number;
  disabled?: boolean;
  onCommit: (value: number) => void;
}

/**
 * Number box that applies its value when it loses focus or Enter is pressed. Out-of-range values are clamped and
 * the field shows the clamped value; text that is not a number restores the current value.
 */
export function NumberField({ label, short, value, min, max, step = 1, decimals, disabled, onCommit }: Props) {
  return (
    <label className="numfield">
      <span className="numfield__short" aria-hidden="true">
        {short}
      </span>
      <input
        key={value}
        className="numfield__input"
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        defaultValue={value}
        onBlur={(e) => {
          const text = e.target.value.trim();
          const n = Number(text);
          if (text === "" || !Number.isFinite(n)) {
            e.target.value = String(value);
            return;
          }
          const rounded = decimals === undefined ? n : Math.round(n * 10 ** decimals) / 10 ** decimals;
          const clamped = Math.min(max, Math.max(min, rounded));
          e.target.value = String(clamped);
          if (clamped !== value) onCommit(clamped);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}
