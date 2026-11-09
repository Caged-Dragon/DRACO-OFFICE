// Final parity audit (v100): roadmap progress by phase + an in-app formula self-check. Pure parts only.
export interface Ver {
  v: number;
  title: string;
  phase: string;
  status: 'done' | 'partial' | 'planned';
}
export interface PhaseRow {
  phase: string;
  done: number;
  partial: number;
  planned: number;
  total: number;
  pct: number;
}
export function byPhase(list: Ver[]): PhaseRow[] {
  const m = new Map<string, PhaseRow>();
  for (const x of list) {
    const r = m.get(x.phase) ?? { phase: x.phase, done: 0, partial: 0, planned: 0, total: 0, pct: 0 };
    r[x.status]++;
    r.total++;
    m.set(x.phase, r);
  }
  return [...m.values()].map((r) => ({ ...r, pct: Math.round(((r.done + r.partial * 0.5) / r.total) * 100) }));
}
export const totals = (list: Ver[]) => {
  const t = { done: 0, partial: 0, planned: 0, total: list.length, pct: 0 };
  for (const x of list) t[x.status]++;
  t.pct = Math.round(((t.done + t.partial * 0.5) / (t.total || 1)) * 100);
  return t;
};
export const PARTIAL_NOTES: Record<number, string> = {
  7: 'Cloud save untested until Supabase is connected',
  8: 'Cloud sync untested until Supabase is connected',
  9: 'Cloud workbook list untested until Supabase is connected',
  70: 'Pictures untested in some formats',
  78: 'URL sources are limited by the website’s CORS settings',
  89: 'Live co-editing is tested between tabs; the Supabase Realtime transport is untested',
  90: 'Cloud share links are role-checked by the database (view/comment/edit, expiry, revoke); copy links and live sessions are enforced in the browser only',
  98: 'Univer’s own menus have 11 languages; Draco’s top bar and Tools are translated into Hindi, Tamil, French, Spanish and German, other dialogs are English; right-to-left sheets are stored but the grid still draws left to right',
};
export interface Check {
  name: string;
  formula: string;
  expect: number | string | boolean;
}
export const SELF_CHECKS: Check[] = [
  { name: 'SUM', formula: '=SUM(1,2,3)', expect: 6 },
  { name: 'AVERAGE', formula: '=AVERAGE(2,4,9)', expect: 5 },
  { name: 'ROUND', formula: '=ROUND(2.567,2)', expect: 2.57 },
  { name: 'IF', formula: '=IF(2>1,"yes","no")', expect: 'yes' },
  { name: 'IFERROR', formula: '=IFERROR(1/0,"oops")', expect: 'oops' },
  { name: 'AND / OR', formula: '=AND(TRUE,OR(FALSE,TRUE))', expect: true },
  { name: 'LEN', formula: '=LEN("draco")', expect: 5 },
  { name: 'UPPER', formula: '=UPPER("abc")', expect: 'ABC' },
  { name: 'LEFT', formula: '=LEFT("spreadsheet",6)', expect: 'spread' },
  { name: 'MID', formula: '=MID("spreadsheet",7,5)', expect: 'sheet' },
  { name: 'SUBSTITUTE', formula: '=SUBSTITUTE("a-b-c","-","+")', expect: 'a+b+c' },
  { name: 'TRIM', formula: '=TRIM("  a   b ")', expect: 'a b' },
  { name: 'TEXTJOIN', formula: '=TEXTJOIN("-",TRUE,"a","","b")', expect: 'a-b' },
  { name: 'REPT', formula: '=REPT("ab",3)', expect: 'ababab' },
  { name: 'TEXT', formula: '=TEXT(1234.5,"#,##0.00")', expect: '1,234.50' },
  { name: 'MOD', formula: '=MOD(17,5)', expect: 2 },
  { name: 'POWER', formula: '=POWER(2,10)', expect: 1024 },
  { name: 'SQRT', formula: '=SQRT(144)', expect: 12 },
  { name: 'ABS', formula: '=ABS(-7.5)', expect: 7.5 },
  { name: 'INT', formula: '=INT(-2.5)', expect: -3 },
  { name: 'MAX', formula: '=MAX(3,9,4)', expect: 9 },
  { name: 'MIN', formula: '=MIN(3,9,4)', expect: 3 },
  { name: 'MEDIAN', formula: '=MEDIAN(1,3,9,4)', expect: 3.5 },
  { name: 'SUMPRODUCT', formula: '=SUMPRODUCT({1,2,3},{4,5,6})', expect: 32 },
  { name: 'COUNTIF', formula: '=SUMPRODUCT(--({1,5,8,10}>4))', expect: 3 },
  { name: 'LARGE', formula: '=LARGE({4,9,2,7},2)', expect: 7 },
  { name: 'RANK', formula: '=RANK(7,{4,9,2,7})', expect: 2 },
  { name: 'CHOOSE', formula: '=CHOOSE(2,"a","b","c")', expect: 'b' },
  { name: 'INDEX/MATCH', formula: '=INDEX({10,20,30},MATCH(20,{10,20,30},0))', expect: 20 },
  { name: 'VLOOKUP', formula: '=VLOOKUP(2,{1,"a";2,"b";3,"c"},2,FALSE)', expect: 'b' },
  { name: 'XLOOKUP', formula: '=XLOOKUP(3,{1,2,3},{"x","y","z"})', expect: 'z' },
  { name: 'DATE', formula: '=DATE(2024,2,29)+0', expect: 45351 },
  { name: 'YEAR', formula: '=YEAR(DATE(2024,2,29))', expect: 2024 },
  { name: 'DAYS', formula: '=DAYS(DATE(2024,3,1),DATE(2024,2,1))', expect: 29 },
  { name: 'EDATE', formula: '=EDATE(DATE(2024,1,31),1)+0', expect: 45351 },
  { name: 'EOMONTH', formula: '=EOMONTH(DATE(2024,2,10),0)+0', expect: 45351 },
  { name: 'WEEKDAY', formula: '=WEEKDAY(DATE(2024,2,29))', expect: 5 },
  { name: 'NETWORKDAYS', formula: '=NETWORKDAYS(DATE(2024,2,26),DATE(2024,3,1))', expect: 5 },
  { name: 'PMT', formula: '=ROUND(PMT(0.05/12,60,10000),2)', expect: -188.71 },
  { name: 'FV', formula: '=ROUND(FV(0.05,10,-100),2)', expect: 1257.79 },
  { name: 'NPV', formula: '=ROUND(NPV(0.1,100,100,100),2)', expect: 248.69 },
  { name: 'IRR', formula: '=ROUND(IRR({-100,60,60}),4)', expect: 0.1307 },
  { name: 'SEQUENCE', formula: '=SUM(SEQUENCE(5))', expect: 15 },
  { name: 'FILTER', formula: '=SUM(FILTER({1,2,3,4},{1,2,3,4}>2))', expect: 7 },
  { name: 'LET', formula: '=LET(x,5,x*x)', expect: 25 },
  { name: 'LAMBDA', formula: '=LAMBDA(a,b,a+b)(2,3)', expect: 5 },
  { name: 'ISNUMBER', formula: '=ISNUMBER(3)', expect: true },
  { name: 'ISBLANK', formula: '=ISBLANK(Z999)', expect: true },
  { name: 'CONCAT', formula: '=CONCAT("a","b","c")', expect: 'abc' },
  { name: 'PROPER', formula: '=PROPER("hello big world")', expect: 'Hello Big World' },
  { name: 'ROUNDUP', formula: '=ROUNDUP(2.121,1)', expect: 2.2 },
  { name: 'CEILING', formula: '=CEILING(4.2,0.5)', expect: 4.5 },
  { name: 'FLOOR', formula: '=FLOOR(4.7,0.5)', expect: 4.5 },
];
export function compare(got: unknown, expect: Check['expect']): boolean {
  if (typeof expect === 'number')
    return typeof got === 'number'
      ? Math.abs(got - expect) < 1e-6
      : Number(got) === expect && got !== '' && got !== null;
  if (typeof expect === 'boolean')
    return got === expect || got === (expect ? 1 : 0) || String(got).toUpperCase() === String(expect).toUpperCase();
  return String(got) === String(expect);
}
