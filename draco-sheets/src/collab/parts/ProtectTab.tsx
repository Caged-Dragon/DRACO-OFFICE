import { useState } from 'react';
import { t } from '../../i18n/i18nGlue';
import * as G from '../collabGlue';
import { defaultAllow, type Allow } from '../protect';
import { Check, Field, Out, Result } from './shared';

export function ProtectTab() {
  const sp = G.getProtection();
  const wp = G.getWbProtection();
  const [pw, setPw] = useState('');
  const [allow, setAllow] = useState<Allow>(defaultAllow());
  const [un, setUn] = useState('');
  const [r, setR] = useState<Out | null>(null);
  const [wpw, setWpw] = useState('');
  const set = (k: keyof Allow) => (v: boolean) => setAllow({ ...allow, [k]: v });
  return (
    <div>
      <h3>Protect this sheet {sp.enabled ? '— protected' : ''}</h3>
      {!sp.enabled ? (
        <>
          <Field label="Password (optional)">
            <input
              aria-label="Sheet password"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <p className="hint">Everyone can do this on a protected sheet:</p>
          <div className="grid2">
            <Check label="Select locked cells" checked={allow.selectLocked} onChange={set('selectLocked')} />
            <Check label="Select unlocked cells" checked={allow.selectUnlocked} onChange={set('selectUnlocked')} />
            <Check label="Format cells" checked={allow.formatCells} onChange={set('formatCells')} />
            <Check label="Insert rows" checked={allow.insertRows} onChange={set('insertRows')} />
            <Check label="Insert columns" checked={allow.insertColumns} onChange={set('insertColumns')} />
            <Check label="Delete rows" checked={allow.deleteRows} onChange={set('deleteRows')} />
            <Check label="Delete columns" checked={allow.deleteColumns} onChange={set('deleteColumns')} />
            <Check label="Sort" checked={allow.sort} onChange={set('sort')} />
            <Check label="Use filter" checked={allow.filter} onChange={set('filter')} />
            <Check label="Edit objects" checked={allow.objects} onChange={set('objects')} />
          </div>
          <Field label="Cells people may still edit (e.g. B2:B10, D4)">
            <input
              aria-label="Unlocked ranges"
              value={un}
              onChange={(e) => setUn(e.target.value)}
              placeholder="Leave empty to lock every cell"
            />
          </Field>
          <div className="row">
            <button
              className="primary"
              onClick={async () =>
                setR(
                  await G.protectSheet({
                    password: pw || undefined,
                    allow,
                    unlocked: un
                      .split(/[,;\n]/)
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }),
                )
              }
            >
              Protect sheet
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            Locked cells can’t be edited{sp.unlocked.length ? `; unlocked: ${sp.unlocked.join(', ')}` : ''}.
            {sp.hash ? ' A password is required to unprotect.' : ''}
          </p>
          {sp.hash && (
            <Field label="Password">
              <input aria-label="Sheet password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </Field>
          )}
          <div className="row">
            <button
              onClick={async () => {
                const o = await G.unprotectSheet(pw);
                setR(o);
                if (o.ok) setPw('');
              }}
            >
              Unprotect sheet
            </button>
          </div>
        </>
      )}
      <h3>Protect workbook structure {wp.enabled ? '— protected' : ''}</h3>
      <p className="hint">Stops sheets being added, deleted, renamed, moved or hidden.</p>
      {wp.hash && wp.enabled && (
        <Field label="Password">
          <input aria-label="Workbook password" type="password" value={wpw} onChange={(e) => setWpw(e.target.value)} />
        </Field>
      )}
      {!wp.enabled && (
        <Field label="Password (optional)">
          <input
            aria-label="Workbook password"
            type="password"
            value={wpw}
            onChange={(e) => setWpw(e.target.value)}
            autoComplete="new-password"
          />
        </Field>
      )}
      <div className="row">
        {wp.enabled ? (
          <button
            onClick={async () => {
              const o = await G.unprotectWorkbook(wpw);
              setR(o);
              if (o.ok) setWpw('');
            }}
          >
            Unprotect workbook
          </button>
        ) : (
          <button
            onClick={async () => {
              setR(await G.protectWorkbook(wpw || undefined));
              setWpw('');
            }}
          >
            Protect workbook
          </button>
        )}
      </div>
      <Result r={r} />
      <p className="hint">
        Protection is a guard against accidents, like Excel’s: it isn’t encryption, and anyone with the file can remove
        it.
      </p>
    </div>
  );
}
