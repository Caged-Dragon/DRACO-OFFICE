import { useEffect, useState } from 'react';
import { t } from '../../i18n/i18nGlue';
import {
  cloudCtx,
  createCloudShare,
  listCloudShares,
  revokeCloudShare,
  cloudShareUrl,
  type ShareRole,
  type ShareRow,
} from '../../core/store';
import { type Role } from '../share';
import { Field, Out, Result } from './shared';

export function CloudShares({ title }: { title: string }) {
  const [role, setRole] = useState<ShareRole>('view');
  const [days, setDays] = useState(0);
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [r, setR] = useState<Out | null>(null);
  const id = cloudCtx.id;
  const load = () => {
    if (id)
      void listCloudShares(id)
        .then(setRows)
        .catch(() => setRows([]));
  };
  useEffect(load, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id)
    return (
      <>
        <h3>Cloud share link (checked on the server)</h3>
        <p className="hint">
          Save this workbook to the cloud while signed in (Save to cloud), then come back here to create a link whose
          view / comment / edit role the server enforces and you can revoke.
        </p>
      </>
    );
  const live = (x: ShareRow) => !x.revoked && (!x.expires_at || new Date(x.expires_at) > new Date());
  return (
    <>
      <h3>Cloud share link (checked on the server)</h3>
      <p className="hint">
        Unlike a copy link, this opens the live workbook "{title}". The role is enforced by the database, so it can't be
        widened by editing the page, and you can switch the link off at any time.
      </p>
      <div className="row">
        <Field label="Role">
          <select aria-label="Cloud link role" value={role} onChange={(e) => setRole(e.target.value as ShareRole)}>
            <option value="view">View only</option>
            <option value="comment">Comment only</option>
            <option value="edit">Can edit</option>
          </select>
        </Field>
        <Field label="Expires after (days, 0 = never)">
          <input
            type="number"
            min={0}
            aria-label="Expiry days"
            value={days}
            onChange={(e) => setDays(Math.max(0, +e.target.value))}
          />
        </Field>
        <button
          onClick={async () => {
            try {
              const x = await createCloudShare(id, role, days || undefined);
              setR({ ok: true, message: 'Link created. Copy it below.' });
              void navigator.clipboard?.writeText(cloudShareUrl(location.origin, x.token)).catch(() => undefined);
              load();
            } catch (e) {
              setR({
                ok: false,
                message:
                  (e as Error).message ||
                  'Could not create the link — are you signed in and is the workbook saved to the cloud?',
              });
            }
          }}
        >
          Create cloud link
        </button>
      </div>
      <ul className="thread-list">
        {rows.map((x) => (
          <li className="thread" key={x.id}>
            <span className="mono">…{x.token.slice(-6)}</span> · {x.role}
            {x.expires_at ? ` · expires ${new Date(x.expires_at).toLocaleDateString()}` : ''} ·{' '}
            {live(x) ? 'active' : 'off'}
            {live(x) && (
              <>
                {' '}
                <button onClick={() => void navigator.clipboard?.writeText(cloudShareUrl(location.origin, x.token))}>
                  Copy link
                </button>{' '}
                <button
                  onClick={async () => {
                    await revokeCloudShare(x.id).catch(() => undefined);
                    load();
                  }}
                >
                  Switch off
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
      <Result r={r} />
    </>
  );
}
