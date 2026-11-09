// v93 macros + v94 scripting glue.
import type { Engine } from '../core/engine';
import { registerResource } from '../core/persist';
import * as M from './macros';
import { parseA1, type Format } from './script';

type Out = { ok: boolean; message: string; [k: string]: unknown };
const ok = (message: string, x: object = {}): Out => ({ ok: true, message, ...x });
const fail = (message: string): Out => ({ ok: false, message });
let eng: Engine | null = null;
let macros: M.Macro[] = [];
let scripts: Array<{ id: string; name: string; code: string; at: string }> = [];
let rec: { name: string; relative: boolean; anchor: { r: number; c: number }; ops: M.Op[] } | null = null;
let replaying = false;
let saveHook: () => void = () => undefined;
const listeners = new Set<() => void>();
export const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
let ver = 0;
export const version = () => ver;
const notify = () => {
  ver++;
  for (const l of listeners) l();
};
export const setSaveHook = (f: () => void) => {
  saveHook = f;
};
export const attach = (e: Engine) => {
  eng = e;
};
registerResource('DRACO_MACROS', {
  get: () => (macros.length ? macros : undefined),
  set: (v) => {
    macros = M.macrosOk(v) ? v : [];
    notify();
  },
  reset: () => {
    macros = [];
    notify();
  },
});
registerResource('DRACO_SCRIPTS', {
  get: () => (scripts.length ? scripts : undefined),
  set: (v) => {
    scripts = Array.isArray(v) ? (v as typeof scripts) : [];
    notify();
  },
  reset: () => {
    scripts = [];
    notify();
  },
});
const wb = () => eng?.api.getActiveWorkbook() ?? null;
const selTL = () => {
  const r = wb()?.getActiveRange();
  return r ? { r: r.getRow(), c: r.getColumn() } : { r: 0, c: 0 };
};

// ---- macros
export const getMacros = () => macros;
export const isRecording = () => !!rec;
export const recordingInfo = () => (rec ? { name: rec.name, steps: rec.ops.length, relative: rec.relative } : null);
export function startRecording(name: string, relative: boolean): Out {
  if (rec) return fail('Already recording');
  if (replaying) return fail('A macro is running');
  rec = { name, relative, anchor: selTL(), ops: [] };
  notify();
  return ok('Recording… do the steps you want to repeat, then stop.');
}
export function stopRecording(save = true): Out {
  if (!rec) return fail('Not recording');
  const r = rec;
  rec = null;
  if (!save || !r.ops.length) {
    notify();
    return ok(save ? 'Nothing was recorded, so no macro was saved' : 'Recording discarded');
  }
  const m = M.newMacro({ name: r.name, relative: r.relative, anchor: r.anchor, ops: r.ops });
  macros = [...macros, m];
  saveHook();
  notify();
  return ok(`Saved macro “${m.name}” with ${m.ops.length} step${m.ops.length === 1 ? '' : 's'}`, { id: m.id });
}
export function onCommand(id: string, params: unknown, options?: Record<string, unknown>) {
  if (!rec || replaying || !M.recordable(id, options)) return;
  rec.ops = M.pushOp(rec.ops, { id, params: params as Record<string, unknown> });
  notify();
}
export function replayOps(ops: M.Op[], o: { relative?: boolean; anchor?: { r: number; c: number } } = {}): Out {
  const w = wb();
  const ws = w?.getActiveSheet();
  if (!w || !ws || !eng) return fail('No workbook');
  const cur = selTL();
  const dr = o.relative && o.anchor ? cur.r - o.anchor.r : 0,
    dc = o.relative && o.anchor ? cur.c - o.anchor.c : 0;
  let n = 0;
  const api = eng.api as unknown as { syncExecuteCommand(id: string, p: unknown): unknown };
  replaying = true;
  try {
    for (const op of ops) {
      const t = M.retarget(op, { unitId: w.getId(), subUnitId: ws.getSheetId(), dr, dc });
      api.syncExecuteCommand(t.id, t.params);
      n++;
    }
  } catch (e) {
    return fail(`Stopped at step ${n + 1}: ${(e as Error).message}`);
  } finally {
    replaying = false;
  }
  return ok(`Ran ${n} step${n === 1 ? '' : 's'}`);
}
export function runMacro(id: string): Out {
  const m = macros.find((x) => x.id === id);
  if (!m) return fail('Macro not found');
  const r = replayOps(m.ops, { relative: m.relative, anchor: m.anchor });
  return r.ok ? ok(`Ran “${m.name}”`) : r;
}
export function deleteMacro(id: string): Out {
  const n = macros.length;
  macros = macros.filter((m) => m.id !== id);
  if (macros.length === n) return fail('Macro not found');
  saveHook();
  notify();
  return ok('Deleted');
}
export function renameMacro(id: string, name: string): Out {
  const m = macros.find((x) => x.id === id);
  if (!m || !name.trim()) return fail('Not renamed');
  m.name = name.trim();
  saveHook();
  notify();
  return ok('Renamed');
}
export function setMacroRelative(id: string, rel: boolean) {
  const m = macros.find((x) => x.id === id);
  if (m) {
    m.relative = rel;
    saveHook();
    notify();
  }
}
export const macroScript = (id: string) => {
  const m = macros.find((x) => x.id === id);
  return m ? M.macroToScript(m) : '';
};

// ---- scripts
export const getScripts = () => scripts;
export function saveScript(name: string, code: string, id?: string): Out {
  name = name.trim() || 'Script';
  const ex = id ? scripts.find((s) => s.id === id) : scripts.find((s) => s.name === name);
  if (ex) {
    ex.name = name;
    ex.code = code;
    ex.at = new Date().toISOString();
  } else scripts = [...scripts, { id: 's' + Date.now().toString(36), name, code, at: new Date().toISOString() }];
  saveHook();
  notify();
  return ok('Script saved', { id: (ex ?? scripts[scripts.length - 1]).id });
}
export function deleteScript(id: string): Out {
  scripts = scripts.filter((s) => s.id !== id);
  saveHook();
  notify();
  return ok('Deleted');
}
const sheetOf = (name: string | null) => {
  const w = wb();
  if (!w) throw new Error('No workbook');
  const s = name ? w.getSheetByName(name) : w.getActiveSheet();
  if (!s) throw new Error(`Sheet "${name}" doesn't exist`);
  return s;
};
const rangeOf = (sheet: string | null, a1: string) => {
  if (!parseA1(a1)) throw new Error(`"${a1}" is not a valid range`);
  return sheetOf(sheet).getRange(a1);
};
const dims = (a1: string) => {
  const b = parseA1(a1)!;
  return { rows: b.r1 - b.r0 + 1, cols: b.c1 - b.c0 + 1 };
};
let toastFn: (m: string) => void = () => undefined;
export const setToast = (f: (m: string) => void) => {
  toastFn = f;
};
const A = { left: 'left', center: 'center', right: 'normal' } as const;
const host: Record<string, (...a: never[]) => unknown> = {
  getValues: ((s: string | null, a: string) => rangeOf(s, a).getValues()) as never,
  getDisplay: ((s: string | null, a: string) => rangeOf(s, a).getDisplayValues()) as never,
  getFormulas: ((s: string | null, a: string) => rangeOf(s, a).getFormulas()) as never,
  setValues: ((s: string | null, a: string, v: unknown[][]) => {
    const d = dims(a);
    if (v.length !== d.rows || v.some((r) => r.length !== d.cols))
      throw new Error(`The data is ${v.length}×${v[0]?.length ?? 0} but ${a} is ${d.rows}×${d.cols}`);
    rangeOf(s, a).setValues(v as never);
    return true;
  }) as never,
  setFormulas: ((s: string | null, a: string, f: string[][]) => {
    const d = dims(a);
    if (f.length !== d.rows || f.some((r) => r.length !== d.cols))
      throw new Error(`The formulas are ${f.length}×${f[0]?.length ?? 0} but ${a} is ${d.rows}×${d.cols}`);
    rangeOf(s, a).setValues(f.map((r) => r.map((x) => (String(x).startsWith('=') ? String(x) : '=' + x))) as never);
    return true;
  }) as never,
  format: ((s: string | null, a: string, f: Format) => {
    const r = rangeOf(s, a);
    if (f.bold !== undefined) r.setFontWeight(f.bold ? 'bold' : 'normal');
    if (f.italic !== undefined) r.setFontStyle(f.italic ? 'italic' : 'normal');
    if (f.underline !== undefined) r.setFontLine(f.underline ? 'underline' : 'none');
    if (f.color) r.setFontColor(f.color);
    if (f.background) r.setBackground(f.background);
    if (f.fontSize) r.setFontSize(f.fontSize);
    if (f.numberFormat) r.setNumberFormat(f.numberFormat);
    if (f.align) r.setHorizontalAlignment(A[f.align]);
    if (f.wrap !== undefined) r.setWrap(f.wrap);
    return true;
  }) as never,
  clear: ((s: string | null, a: string) => {
    rangeOf(s, a).clear();
    return true;
  }) as never,
  select: ((s: string | null, a: string) => {
    const sh = sheetOf(s);
    wb()!.setActiveSheet(sh);
    rangeOf(s, a).activate();
    return true;
  }) as never,
  sort: ((s: string | null, a: string, col: number, asc: boolean) => {
    (rangeOf(s, a) as unknown as { sort(o: object): unknown }).sort({ column: col, ascending: asc });
    return true;
  }) as never,
  usedRange: ((s: string | null) => {
    const sh = sheetOf(s);
    const r = sh.getDataRange();
    const v = r.getValues();
    return v.some((row) => row.some((x) => x !== null && x !== '' && x !== undefined)) ? r.getA1Notation() : null;
  }) as never,
  insertRows: ((s: string | null, at: number, n: number) => {
    sheetOf(s).insertRows(at, n);
    return true;
  }) as never,
  deleteRows: ((s: string | null, at: number, n: number) => {
    sheetOf(s).deleteRows(at, n);
    return true;
  }) as never,
  activate: ((s: string | null) => {
    const sh = sheetOf(s);
    wb()!.setActiveSheet(sh);
    return true;
  }) as never,
  renameSheet: ((s: string | null, to: string) => {
    sheetOf(s).setName(to);
    return true;
  }) as never,
  selection: (() => {
    const r = wb()?.getActiveRange();
    if (!r) throw new Error('Nothing is selected');
    return r.getA1Notation();
  }) as never,
  sheetNames: (() =>
    wb()
      ?.getSheets()
      .map((s) => s.getSheetName()) ?? []) as never,
  addSheet: ((name: string) => {
    const w = wb();
    if (!w) throw new Error('No workbook');
    if (w.getSheetByName(name)) throw new Error(`A sheet named "${name}" already exists`);
    w.create(name, 100, 26);
    return true;
  }) as never,
  toast: ((m: string) => {
    toastFn(m);
    return true;
  }) as never,
  replay: ((ops: M.Op[], o: { relative?: boolean; anchor?: { r: number; c: number } }) => {
    const r = replayOps(ops, o);
    if (!r.ok) throw new Error(r.message);
    return true;
  }) as never,
};
export interface RunResult {
  ok: boolean;
  logs: Array<{ kind: string; text: string }>;
  error?: string;
  value?: unknown;
  ms: number;
}
let runningWorker: Worker | null = null;
let stopper: (() => void) | null = null;
export const isRunning = () => !!runningWorker;
export function stopScript() {
  if (stopper) stopper();
  else {
    runningWorker?.terminate();
    runningWorker = null;
    notify();
  }
}
export function runScriptInWorker(
  code: string,
  timeoutMs = 15000,
  onLog?: (k: string, t: string) => void,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const logs: RunResult['logs'] = [];
    if (runningWorker) return resolve({ ok: false, logs, error: 'A script is already running', ms: 0 });
    const w = new Worker(new URL('./script.worker.ts', import.meta.url), { type: 'module' });
    runningWorker = w;
    notify();
    const finish = (r: Omit<RunResult, 'logs' | 'ms'>) => {
      window.clearTimeout(timer);
      if (runningWorker === w) {
        runningWorker = null;
        stopper = null;
      }
      w.terminate();
      notify();
      resolve({ ...r, logs, ms: Math.round(performance.now() - t0) });
    };
    stopper = () => finish({ ok: false, error: 'Stopped by you' });
    const timer = window.setTimeout(
      () => finish({ ok: false, error: `Stopped: the script ran longer than ${Math.round(timeoutMs / 1000)} seconds` }),
      timeoutMs,
    );
    w.onerror = (e) => finish({ ok: false, error: e.message || 'Script crashed' });
    w.onmessage = (e: MessageEvent) => {
      const m = e.data as {
        type: string;
        id?: number;
        method?: string;
        args?: never[];
        kind?: string;
        text?: string;
        value?: unknown;
        error?: string;
      };
      if (m.type === 'log') {
        logs.push({ kind: m.kind ?? 'log', text: m.text ?? '' });
        onLog?.(m.kind ?? 'log', m.text ?? '');
      } else if (m.type === 'call') {
        const fnc = host[m.method ?? ''];
        Promise.resolve()
          .then(() => {
            if (!fnc) throw new Error(`Unknown request "${m.method}"`);
            return (fnc as (...a: never[]) => unknown)(...(m.args ?? []));
          })
          .then(
            (value) => w.postMessage({ type: 'result', id: m.id, ok: true, value }),
            (err: Error) => w.postMessage({ type: 'result', id: m.id, ok: false, error: err.message }),
          );
      } else if (m.type === 'done') {
        saveHook();
        finish({ ok: true, value: m.value });
      } else if (m.type === 'fail') finish({ ok: false, error: m.error });
    };
    w.postMessage({ type: 'run', code });
  });
}
export function install(w: Record<string, unknown>) {
  w.dracoAuto = {
    startRecording,
    stopRecording,
    macros: () => macros,
    runMacro,
    deleteMacro,
    renameMacro,
    macroScript,
    recording: recordingInfo,
    saveScript,
    scripts: () => scripts,
    runScript: runScriptInWorker,
    stopScript,
    replay: replayOps,
  };
}
