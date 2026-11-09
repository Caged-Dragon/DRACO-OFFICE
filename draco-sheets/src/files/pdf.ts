// Minimal PDF writer (v81): standard Helvetica fonts, rectangles, lines and text from print ops. No dependencies.
import type { Op, PageOps } from './print';

const CP1252: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};
/** Escape text for a PDF literal string in WinAnsi; unsupported characters become '?'. */
export function pdfString(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    let b: number;
    if (cp === 10 || cp === 13 || cp === 9) b = 32;
    else if (cp >= 32 && cp < 127) b = cp;
    else if (cp >= 0xa0 && cp <= 0xff) b = cp;
    else if (CP1252[cp]) b = CP1252[cp];
    else b = 63;
    if (b === 40 || b === 41 || b === 92) out += '\\' + String.fromCharCode(b);
    else if (b < 32 || b > 126) out += '\\' + b.toString(8).padStart(3, '0');
    else out += String.fromCharCode(b);
  }
  return out;
}
const num = (n: number) => (Math.round(n * 100) / 100).toString();
function rgb(c: string): string {
  const h = /^#[0-9a-f]{6}$/i.test(c) ? c.slice(1) : '000000';
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => num(v / 255)).join(' ');
}

function pageStream(p: PageOps): string {
  const out: string[] = [];
  const Y = (y: number) => num(p.h - y);
  for (const o of p.ops as Op[]) {
    if (o.k === 'rect') out.push(`${rgb(o.fill)} rg ${num(o.x)} ${Y(o.y + o.h)} ${num(o.w)} ${num(o.h)} re f`);
    else if (o.k === 'line')
      out.push(
        `q ${rgb(o.color)} RG ${num(o.w)} w ${o.dash ? `[${o.dash.map(num).join(' ')}] 0 d ` : ''}${num(o.x1)} ${Y(o.y1)} m ${num(o.x2)} ${Y(o.y2)} l S Q`,
      );
    else {
      const f = o.bold ? (o.italic ? 'F4' : 'F2') : o.italic ? 'F3' : 'F1';
      const clip = o.clip ? `${num(o.clip.x)} ${Y(o.clip.y + o.clip.h)} ${num(o.clip.w)} ${num(o.clip.h)} re W n ` : '';
      out.push(
        `q ${clip}BT ${rgb(o.color)} rg /${f} ${num(o.size)} Tf ${num(o.x)} ${Y(o.y)} Td (${pdfString(o.text)}) Tj ET Q`,
      );
      if (o.underline || o.strike) {
        const w = textWidth(o);
        const ly = o.underline ? o.y + o.size * 0.12 : o.y - o.size * 0.3;
        out.push(
          `q ${rgb(o.color)} RG ${num(Math.max(0.4, o.size / 20))} w ${num(o.x)} ${Y(ly)} m ${num(o.x + w)} ${Y(ly)} l S Q`,
        );
      }
    }
  }
  return out.join('\n');
}
import { textW } from './print';
const textWidth = (o: Extract<Op, { k: 'text' }>) => textW(o.text, o.size, o.bold);

/** Build a PDF 1.4 document from rendered pages. */
export function pagesToPdf(pages: PageOps[], title = 'Draco Sheets'): Uint8Array {
  const objs: string[] = [];
  const add = (s: string) => {
    objs.push(s);
    return objs.length;
  };
  const catalog = add('');
  const pagesObj = add('');
  const fonts = ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique'].map((f) =>
    add(`<< /Type /Font /Subtype /Type1 /BaseFont /${f} /Encoding /WinAnsiEncoding >>`),
  );
  const kids: number[] = [];
  const list = pages.length ? pages : [{ w: 612, h: 792, ops: [], pageNo: 1 } as PageOps];
  for (const p of list) {
    const content = pageStream(p);
    const cid = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pid = add(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${num(p.w)} ${num(p.h)}] /Resources << /Font << /F1 ${fonts[0]} 0 R /F2 ${fonts[1]} 0 R /F3 ${fonts[2]} 0 R /F4 ${fonts[3]} 0 R >> >> /Contents ${cid} 0 R >>`,
    );
    kids.push(pid);
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = add(`<< /Title (${pdfString(title)}) /Producer (Draco Sheets) /Creator (Draco Sheets) >>`);
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return bytes;
}
