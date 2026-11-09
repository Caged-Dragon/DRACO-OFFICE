/** Evaluate Formula: parses a formula and reduces it one step at a time, like Excel's Evaluate Formula dialog. */
export type Val = number | string | boolean | Val[];
type Node =
  | { t: 'lit'; v: Val }
  | { t: 'ref'; text: string }
  | { t: 'rng'; text: string }
  | { t: 'fn'; name: string; args: Node[] }
  | { t: 'bin'; op: string; l: Node; r: Node }
  | { t: 'un'; op: string; x: Node }
  | { t: 'pct'; x: Node };

export interface Step {
  text: string;
  active?: string;
}
export interface Lookup {
  cell: (ref: string) => Val;
  range: (ref: string) => Val[];
}

const CELL = '\\$?[A-Za-z]{1,3}\\$?\\d+';
const TOKEN = new RegExp(
  `\\s*(?:(\\d+\\.?\\d*(?:[eE][+-]?\\d+)?)|"((?:[^"]|"")*)"|((?:'[^']+'|[A-Za-z_][\\w.]*)!)?(${CELL}(?::${CELL})?)|(TRUE|FALSE)\\b|([A-Za-z_][\\w.]*)\\s*(\\()|(<>|<=|>=|[-+*/^&=<>(),%]))`,
  'iy',
);

function parse(src: string): Node {
  const toks: { k: string; v: string; sheet?: string }[] = [];
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    TOKEN.lastIndex = i;
    const m = TOKEN.exec(src);
    if (!m) throw new Error(`Cannot parse near "${src.slice(i, i + 8)}"`);
    i = TOKEN.lastIndex;
    if (m[1] !== undefined) toks.push({ k: 'num', v: m[1] });
    else if (m[2] !== undefined) toks.push({ k: 'str', v: m[2].replace(/""/g, '"') });
    else if (m[4] !== undefined)
      toks.push({ k: m[4].includes(':') ? 'rng' : 'ref', v: m[4].replace(/\$/g, '').toUpperCase(), sheet: m[3] });
    else if (m[5] !== undefined) toks.push({ k: 'bool', v: m[5].toUpperCase() });
    else if (m[6] !== undefined) toks.push({ k: 'fn', v: m[6].toUpperCase() });
    else toks.push({ k: 'op', v: m[8] });
  }
  let p = 0;
  const peek = () => toks[p];
  const eat = () => toks[p++];
  const isOp = (...o: string[]) => peek()?.k === 'op' && o.includes(peek().v);
  const prec: Record<string, number> = {
    '=': 1,
    '<>': 1,
    '<': 1,
    '>': 1,
    '<=': 1,
    '>=': 1,
    '&': 2,
    '+': 3,
    '-': 3,
    '*': 4,
    '/': 4,
    '^': 5,
  };
  function expr(min: number): Node {
    let l = unary();
    while (peek()?.k === 'op' && prec[peek().v] >= min) {
      const op = eat().v;
      const r = expr(prec[op] + (op === '^' ? 0 : 1));
      l = { t: 'bin', op, l, r };
    }
    return l;
  }
  function unary(): Node {
    if (isOp('-', '+')) {
      const op = eat().v;
      return { t: 'un', op, x: unary() };
    }
    let n = atom();
    while (isOp('%')) {
      eat();
      n = { t: 'pct', x: n };
    }
    return n;
  }
  function atom(): Node {
    const t = eat();
    if (!t) throw new Error('Unexpected end of formula');
    if (t.k === 'num') return { t: 'lit', v: parseFloat(t.v) };
    if (t.k === 'str') return { t: 'lit', v: t.v };
    if (t.k === 'bool') return { t: 'lit', v: t.v === 'TRUE' };
    if (t.k === 'ref') return { t: 'ref', text: t.v };
    if (t.k === 'rng') return { t: 'rng', text: t.v };
    if (t.k === 'fn') {
      const args: Node[] = [];
      if (!isOp(')')) {
        args.push(expr(1));
        while (isOp(',')) {
          eat();
          args.push(expr(1));
        }
      }
      if (!isOp(')')) throw new Error('Missing ")"');
      eat();
      return { t: 'fn', name: t.v, args };
    }
    if (t.v === '(') {
      const n = expr(1);
      if (!isOp(')')) throw new Error('Missing ")"');
      eat();
      return n;
    }
    throw new Error(`Unexpected "${t.v}"`);
  }
  const root = expr(1);
  if (p < toks.length) throw new Error(`Unexpected "${toks[p].v}"`);
  return root;
}

const flat = (a: Val[]): Val[] => a.flatMap((x) => (Array.isArray(x) ? flat(x) : [x]));
const nums = (a: Val[]) => flat(a).filter((x): x is number => typeof x === 'number');
const num = (v: Val): number => {
  const x = typeof v === 'number' ? v : typeof v === 'boolean' ? +v : parseFloat(String(v));
  if (Number.isNaN(x)) throw new Error('#VALUE!');
  return x;
};
const str = (v: Val) => (typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v));
const FN: Record<string, (a: Val[]) => Val> = {
  SUM: (a) => nums(a).reduce((s, x) => s + x, 0),
  AVERAGE: (a) => {
    const n = nums(a);
    if (!n.length) throw new Error('#DIV/0!');
    return n.reduce((s, x) => s + x, 0) / n.length;
  },
  MIN: (a) => Math.min(...nums(a)),
  MAX: (a) => Math.max(...nums(a)),
  COUNT: (a) => nums(a).length,
  ABS: (a) => Math.abs(num(a[0])),
  SQRT: (a) => {
    if (num(a[0]) < 0) throw new Error('#NUM!');
    return Math.sqrt(num(a[0]));
  },
  INT: (a) => Math.floor(num(a[0])),
  MOD: (a) => {
    if (!num(a[1])) throw new Error('#DIV/0!');
    const m = num(a[1]);
    return num(a[0]) - m * Math.floor(num(a[0]) / m);
  },
  POWER: (a) => num(a[0]) ** num(a[1]),
  ROUND: (a) => {
    const d = 10 ** num(a[1] ?? 0);
    return (Math.sign(num(a[0])) * Math.round(Math.abs(num(a[0])) * d)) / d;
  },
  IF: (a) => (a[0] ? (a[1] ?? true) : (a[2] ?? false)),
  AND: (a) => flat(a).every(Boolean),
  OR: (a) => flat(a).some(Boolean),
  NOT: (a) => !a[0],
  LEN: (a) => str(a[0]).length,
  UPPER: (a) => str(a[0]).toUpperCase(),
  LOWER: (a) => str(a[0]).toLowerCase(),
  CONCAT: (a) => flat(a).map(str).join(''),
  CONCATENATE: (a) => flat(a).map(str).join(''),
};
export const supported = (name: string) => name in FN;

function binop(op: string, l: Val, r: Val): Val {
  switch (op) {
    case '+':
      return num(l) + num(r);
    case '-':
      return num(l) - num(r);
    case '*':
      return num(l) * num(r);
    case '/':
      if (!num(r)) throw new Error('#DIV/0!');
      return num(l) / num(r);
    case '^':
      return num(l) ** num(r);
    case '&':
      return str(l) + str(r);
    case '=':
      return l === r;
    case '<>':
      return l !== r;
    case '<':
      return l < r;
    case '>':
      return l > r;
    case '<=':
      return l <= r;
    default:
      return l >= r;
  }
}

/** Text of a value as it would appear in a formula. */
export const show = (v: Val): string =>
  Array.isArray(v)
    ? `{${v.map(show).join(',')}}`
    : typeof v === 'string'
      ? `"${v.replace(/"/g, '""')}"`
      : typeof v === 'boolean'
        ? v
          ? 'TRUE'
          : 'FALSE'
        : String(+v.toPrecision(15));

function render(n: Node, hot?: Node): string {
  const s = (x: Node): string => (x === hot ? `␂${inner(x)}␃` : inner(x));
  const inner = (x: Node): string => {
    switch (x.t) {
      case 'lit':
        return show(x.v);
      case 'ref':
      case 'rng':
        return x.text;
      case 'fn':
        return `${x.name}(${x.args.map(s).join(',')})`;
      case 'bin':
        return `${s(x.l)}${x.op}${s(x.r)}`;
      case 'un':
        return `${x.op}${s(x.x)}`;
      default:
        return `${s(x.x)}%`;
    }
  };
  return s(n);
}

const isLit = (n: Node): n is Extract<Node, { t: 'lit' }> => n.t === 'lit';

/** Find the next node to reduce (left-most, deepest), or null when the tree is one literal. */
function next(n: Node): Node | null {
  const kids = n.t === 'fn' ? n.args : n.t === 'bin' ? [n.l, n.r] : n.t === 'un' || n.t === 'pct' ? [n.x] : [];
  for (const k of kids) {
    const r = next(k);
    if (r) return r;
  }
  if (n.t === 'lit') return null;
  if (n.t === 'ref' || n.t === 'rng') return n;
  return kids.every(isLit) ? n : null;
}
function replace(n: Node, target: Node, to: Node): Node {
  if (n === target) return to;
  switch (n.t) {
    case 'fn':
      return { ...n, args: n.args.map((a) => replace(a, target, to)) };
    case 'bin':
      return { ...n, l: replace(n.l, target, to), r: replace(n.r, target, to) };
    case 'un':
    case 'pct':
      return { ...n, x: replace(n.x, target, to) };
    default:
      return n;
  }
}

/** Evaluate step by step. `steps[0]` is the formula as typed; the last step is the result (or an error). */
export function evaluateSteps(formula: string, look: Lookup): Step[] {
  let tree: Node;
  try {
    tree = parse(formula.replace(/^=/, ''));
  } catch (e) {
    return [{ text: formula }, { text: (e as Error).message }];
  }
  const steps: Step[] = [{ text: render(tree, next(tree) ?? undefined) }];
  for (let guard = 0; guard < 200; guard++) {
    const t = next(tree);
    if (!t) break;
    let v: Val;
    try {
      if (t.t === 'ref') v = look.cell(t.text);
      else if (t.t === 'rng') v = look.range(t.text);
      else if (t.t === 'fn') {
        const f = FN[t.name];
        if (!f) throw new Error(`UNSUPPORTED:${t.name}`);
        v = f(t.args.map((a) => (a as { v: Val }).v));
      } else if (t.t === 'bin') v = binop(t.op, (t.l as { v: Val }).v, (t.r as { v: Val }).v);
      else if (t.t === 'un') v = t.op === '-' ? -num((t.x as { v: Val }).v) : num((t.x as { v: Val }).v);
      else if (t.t === 'pct') v = num((t.x as { v: Val }).v) / 100;
      else v = (t as { v: Val }).v;
    } catch (e) {
      const m = (e as Error).message;
      return [
        ...steps,
        {
          text: m.startsWith('UNSUPPORTED:')
            ? `${m.slice(12)} is not stepped through here — use the cell's own value`
            : m,
        },
      ];
    }
    tree = replace(tree, t, { t: 'lit', v });
    const nx = next(tree);
    steps.push({ text: render(tree, nx ?? undefined) });
  }
  return steps;
}
export const resultOf = (steps: Step[]) => steps[steps.length - 1].text.replace(/[␂␃]/g, '');
