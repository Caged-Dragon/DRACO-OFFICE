// Scripting (v94): the `draco` object scripts see, and a runner. Runs identically in a Worker (browser) or Node (tests): all
// access to the workbook goes through `call(method, args)`, so a script can't touch the page, storage or network of the app.
export type Call = (method: string, args: unknown[]) => Promise<unknown>;
export interface Logger {
  (kind: 'log' | 'warn' | 'error', text: string): void;
}
const fmt = (a: unknown): string => {
  if (typeof a === 'string') return a;
  try {
    return JSON.stringify(a, (_k, v) => (typeof v === 'bigint' ? String(v) : v)) ?? String(a);
  } catch {
    return String(a);
  }
};
export const colLetters = (c: number) => {
  let s = '',
    n = c + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
export function parseA1(a: string): { r0: number; c0: number; r1: number; c1: number } | null {
  const m = /^\s*\$?([A-Za-z]{1,3})\$?(\d+)(?::\$?([A-Za-z]{1,3})\$?(\d+))?\s*$/.exec(a);
  if (!m) return null;
  const ci = (x: string) => [...x.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const r0 = +m[2] - 1,
    c0 = ci(m[1]),
    r1 = m[4] ? +m[4] - 1 : r0,
    c1 = m[3] ? ci(m[3]) : c0;
  return { r0: Math.min(r0, r1), c0: Math.min(c0, c1), r1: Math.max(r0, r1), c1: Math.max(c0, c1) };
}
export interface Format {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  background?: string;
  fontSize?: number;
  numberFormat?: string;
  align?: 'left' | 'center' | 'right';
  wrap?: boolean;
}
export function makeDraco(call: Call, log: Logger, limits = { maxCalls: 200000 }) {
  let calls = 0;
  const c: Call = async (m, a) => {
    if (++calls > limits.maxCalls)
      throw new Error('This script made too many requests (limit ' + limits.maxCalls + ')');
    return call(m, a);
  };
  class Range {
    constructor(
      readonly sheet: string | undefined,
      readonly address: string,
    ) {
      if (!parseA1(address)) throw new Error(`"${address}" is not a valid range`);
    }
    private t(): unknown[] {
      return [this.sheet ?? null, this.address];
    }
    async values(): Promise<unknown[][]> {
      return (await c('getValues', this.t())) as unknown[][];
    }
    async value(): Promise<unknown> {
      const v = await this.values();
      return v[0]?.[0] ?? null;
    }
    async displayValues(): Promise<string[][]> {
      return (await c('getDisplay', this.t())) as string[][];
    }
    async formulas(): Promise<string[][]> {
      return (await c('getFormulas', this.t())) as string[][];
    }
    async setValues(v: unknown[][]): Promise<this> {
      if (!Array.isArray(v) || !v.every(Array.isArray))
        throw new Error('setValues needs a 2D array, e.g. [[1, 2], [3, 4]]');
      await c('setValues', [...this.t(), v]);
      return this;
    }
    async setValue(v: unknown): Promise<this> {
      const b = parseA1(this.address)!;
      const rows = b.r1 - b.r0 + 1,
        cols = b.c1 - b.c0 + 1;
      return this.setValues(Array.from({ length: rows }, () => Array.from({ length: cols }, () => v)));
    }
    async setFormulas(f: string[][]): Promise<this> {
      await c('setFormulas', [...this.t(), f]);
      return this;
    }
    async setFormula(f: string): Promise<this> {
      const b = parseA1(this.address)!;
      return this.setFormulas(
        Array.from({ length: b.r1 - b.r0 + 1 }, () => Array.from({ length: b.c1 - b.c0 + 1 }, () => f)),
      );
    }
    async format(f: Format): Promise<this> {
      await c('format', [...this.t(), f]);
      return this;
    }
    async clear(): Promise<this> {
      await c('clear', this.t());
      return this;
    }
    async select(): Promise<this> {
      await c('select', this.t());
      return this;
    }
    async sort(col = 0, asc = true): Promise<this> {
      await c('sort', [...this.t(), col, asc]);
      return this;
    }
    offset(dr: number, dc: number): Range {
      const b = parseA1(this.address)!;
      const r0 = b.r0 + dr,
        c0 = b.c0 + dc,
        r1 = b.r1 + dr,
        c1 = b.c1 + dc;
      if (r0 < 0 || c0 < 0) throw new Error('offset moves the range off the sheet');
      return new Range(this.sheet, `${colLetters(c0)}${r0 + 1}:${colLetters(c1)}${r1 + 1}`);
    }
  }
  class Sheet {
    constructor(readonly name: string | undefined) {}
    range(a: string) {
      return new Range(this.name, a);
    }
    cell(r: number, c: number) {
      return new Range(this.name, `${colLetters(c)}${r + 1}`);
    }
    async usedRange(): Promise<Range | null> {
      const a = (await c('usedRange', [this.name ?? null])) as string | null;
      return a ? new Range(this.name, a) : null;
    }
    async insertRows(at: number, n = 1) {
      await c('insertRows', [this.name ?? null, at, n]);
    }
    async deleteRows(at: number, n = 1) {
      await c('deleteRows', [this.name ?? null, at, n]);
    }
    async activate() {
      await c('activate', [this.name ?? null]);
    }
    async rename(to: string) {
      await c('renameSheet', [this.name ?? null, to]);
      return new Sheet(to);
    }
  }
  const draco = {
    sheet: (name?: string) => new Sheet(name),
    range: (a: string) => new Range(undefined, a),
    selection: async () => {
      const a = (await c('selection', [])) as string;
      return new Range(undefined, a);
    },
    sheets: async () => (await c('sheetNames', [])) as string[],
    addSheet: async (name: string) => {
      await c('addSheet', [name]);
      return new Sheet(name);
    },
    toast: async (m: unknown) => {
      await c('toast', [fmt(m)]);
    },
    replay: async (ops: unknown[], o?: { relative?: boolean; anchor?: { r: number; c: number } }) => {
      await c('replay', [ops, o ?? {}]);
    },
    sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, Math.min(Math.max(0, +ms || 0), 5000))),
    log: (...a: unknown[]) => log('log', a.map(fmt).join(' ')),
    colName: colLetters,
    parseA1,
  };
  const con = {
    log: draco.log,
    info: draco.log,
    warn: (...a: unknown[]) => log('warn', a.map(fmt).join(' ')),
    error: (...a: unknown[]) => log('error', a.map(fmt).join(' ')),
  };
  return { draco, console: con, calls: () => calls };
}
const AsyncFunction = Object.getPrototypeOf(async function () {
  /* */
}).constructor as new (...a: string[]) => (...args: unknown[]) => Promise<unknown>;
/** Compile + run; returns the script's return value (if any). Syntax errors are rethrown with a readable message. */
export async function runScript(code: string, call: Call, log: Logger): Promise<unknown> {
  const { draco, console } = makeDraco(call, log);
  let fn: (...a: unknown[]) => Promise<unknown>;
  try {
    fn = new AsyncFunction('draco', 'console', '"use strict";\n' + code);
  } catch (e) {
    throw new Error('Syntax error: ' + (e as Error).message);
  }
  return fn(draco, console);
}
export const SAMPLES: Array<{ name: string; code: string }> = [
  {
    name: 'Hello, sheet',
    code: `// Write a greeting and a small table\nconst s = draco.sheet();\nawait s.range('A1').setValue('Hello from a script');\nawait s.range('A3:C4').setValues([[1, 2, 3], [4, 5, 6]]);\nawait s.range('D3').setFormula('=SUM(A3:C3)');\nawait s.range('A1').format({ bold: true, color: '#c2410c' });\ndraco.log('done');\n`,
  },
  {
    name: 'Total each column',
    code: `// Add a total row under the data of the current sheet\nconst used = await draco.sheet().usedRange();\nif (!used) { draco.log('Sheet is empty'); return; }\nconst vals = await used.values();\nconst cols = vals[0].length; const row = vals.length;\nconst out = [];\nfor (let c = 0; c < cols; c++) out.push('=SUM(' + draco.colName(c) + '2:' + draco.colName(c) + row + ')');\nawait draco.sheet().range('A' + (row + 1) + ':' + draco.colName(cols - 1) + (row + 1)).setFormulas([out]);\nawait draco.sheet().range('A' + (row + 1) + ':' + draco.colName(cols - 1) + (row + 1)).format({ bold: true });\ndraco.log('Totals added in row ' + (row + 1));\n`,
  },
  {
    name: 'Clean text in selection',
    code: `// Trim spaces and fix case in the selected cells\nconst sel = await draco.selection();\nconst v = await sel.values();\nawait sel.setValues(v.map(r => r.map(x => typeof x === 'string' ? x.trim().replace(/\\s+/g, ' ') : x)));\ndraco.log('Cleaned ' + v.length * v[0].length + ' cells');\n`,
  },
  {
    name: 'Highlight values above average',
    code: `const sel = await draco.selection();\nconst v = (await sel.values()).flat().filter(x => typeof x === 'number');\nconst avg = v.reduce((a, b) => a + b, 0) / (v.length || 1);\nconst vals = await sel.values();\nfor (let r = 0; r < vals.length; r++) for (let c = 0; c < vals[r].length; c++) if (typeof vals[r][c] === 'number' && vals[r][c] > avg) await sel.offset(r, c).format({ background: '#fde68a' });\ndraco.log('Average ' + avg.toFixed(2));\n`,
  },
];
