import type { ReactNode } from 'react';

/** Result of a dialog action (shape shared by every data/collab/files glue module). */
export type FormOut = { ok: boolean; message: string; [k: string]: unknown };

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label>
    {label}
    {children}
  </label>
);

export const Check = ({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) => (
  <label className="inline">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

export const Result = ({ r }: { r: { ok: boolean; message: string } | null }) =>
  r ? (
    <p className={r.ok ? 'hint okmsg' : 'msg'} role={r.ok ? 'status' : 'alert'}>
      {r.ok ? '✔ ' : ''}
      {r.message}
    </p>
  ) : null;
