import { readFileSync, writeFileSync } from 'node:fs';
const md = readFileSync('ROADMAP.md', 'utf8').split('\n');
const partial = new Set((process.env.PARTIAL || '').split(',').filter(Boolean).map(Number));
const done = new Set((process.env.DONE || '').split(',').filter(Boolean).map(Number));
let phase = '';
const out = [];
for (const line of md) {
  const p = line.match(/^## Phase (\w) — (.+?) \(v(\d+)–v(\d+)\)/);
  if (p) { phase = `${p[1]} · ${p[2]}`; continue; }
  const m = line.match(/^- v(\d+) (.+)$/);
  if (m) out.push({ v: +m[1], title: m[2], phase, status: done.has(+m[1]) ? 'done' : partial.has(+m[1]) ? 'partial' : 'planned' });
}
if (out.length !== 100) throw new Error('expected 100 versions, got ' + out.length);
writeFileSync('src/versions.json', JSON.stringify(out, null, 1));
console.log('versions', out.length);
