/** Post-process an .xlsx written by ExcelJS: inject native Excel chart parts (drawingN.xml + chartN.xml) for Draco charts. */
import JSZip from 'jszip';

export interface ChartOut {
  sheet: string;
  range: string;
  type: string;
  title: string;
  byRows: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  legend?: string;
  names?: string[];
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colL = (c: number) => {
  let s = '';
  for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  return s;
};
const pc = (a: string) => {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(a.trim());
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return { r: +m[2] - 1, c: c - 1 };
};
const qs = (n: string) => (/^[A-Za-z0-9_]+$/.test(n) ? n : `'${n.replace(/'/g, "''")}'`);
const ref = (sheet: string, r0: number, c0: number, r1: number, c1: number) =>
  `${qs(sheet)}!$${colL(c0)}$${r0 + 1}:$${colL(c1)}$${r1 + 1}`;

export function chartXml(c: ChartOut): string | null {
  const [a, b] = c.range.replace(/\$/g, '').split(':');
  const p = pc(a),
    q = pc(b ?? a);
  if (!p || !q) return null;
  const rows = q.r - p.r + 1,
    cols = q.c - p.c + 1;
  if (rows < 2 || cols < 2) return null;
  const t = c.type;
  const kind =
    t === 'column' || t === 'bar'
      ? 'bar'
      : t === 'line'
        ? 'line'
        : t === 'area'
          ? 'area'
          : t === 'pie'
            ? 'pie'
            : t === 'doughnut'
              ? 'doughnut'
              : t === 'scatter'
                ? 'scatter'
                : null;
  if (!kind) return null;
  const ser: string[] = [];
  const n = c.byRows ? rows - 1 : cols - 1;
  for (let i = 0; i < n; i++) {
    const name = c.byRows
      ? ref(c.sheet, p.r + 1 + i, p.c, p.r + 1 + i, p.c)
      : ref(c.sheet, p.r, p.c + 1 + i, p.r, p.c + 1 + i);
    const cat = c.byRows ? ref(c.sheet, p.r, p.c + 1, p.r, q.c) : ref(c.sheet, p.r + 1, p.c, q.r, p.c);
    const val = c.byRows
      ? ref(c.sheet, p.r + 1 + i, p.c + 1, p.r + 1 + i, q.c)
      : ref(c.sheet, p.r + 1, p.c + 1 + i, q.r, p.c + 1 + i);
    const tx = `<c:tx><c:strRef><c:f>${esc(name)}</c:f></c:strRef></c:tx>`;
    if (kind === 'scatter')
      ser.push(
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/></c:marker><c:xVal><c:numRef><c:f>${esc(cat)}</c:f></c:numRef></c:xVal><c:yVal><c:numRef><c:f>${esc(val)}</c:f></c:numRef></c:yVal><c:smooth val="0"/></c:ser>`,
      );
    else
      ser.push(
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}<c:cat><c:strRef><c:f>${esc(cat)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(val)}</c:f></c:numRef></c:val>${kind === 'line' ? '<c:smooth val="0"/>' : ''}</c:ser>`,
      );
    if (kind === 'pie' || kind === 'doughnut') break;
  }
  const ax = '<c:axId val="111"/><c:axId val="222"/>';
  let plot = '';
  if (kind === 'bar')
    plot = `<c:barChart><c:barDir val="${t === 'bar' ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser.join('')}<c:gapWidth val="150"/>${ax}</c:barChart>`;
  else if (kind === 'line')
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser.join('')}<c:marker val="1"/>${ax}</c:lineChart>`;
  else if (kind === 'area')
    plot = `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${ser.join('')}${ax}</c:areaChart>`;
  else if (kind === 'scatter')
    plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${ser.join('')}${ax}</c:scatterChart>`;
  else if (kind === 'pie')
    plot = `<c:pieChart><c:varyColors val="1"/>${ser.join('')}<c:firstSliceAng val="0"/></c:pieChart>`;
  else
    plot = `<c:doughnutChart><c:varyColors val="1"/>${ser.join('')}<c:firstSliceAng val="0"/><c:holeSize val="50"/></c:doughnutChart>`;
  const pieLike = kind === 'pie' || kind === 'doughnut';
  const catAx =
    kind === 'scatter'
      ? `<c:valAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222"/></c:valAx>`
      : `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${t === 'bar' ? 'l' : 'b'}"/><c:crossAx val="222"/></c:catAx>`;
  const axes = pieLike
    ? ''
    : `${catAx}<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${t === 'bar' ? 'b' : 'l'}"/><c:majorGridlines/><c:crossAx val="111"/></c:valAx>`;
  const title = c.title
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:r><a:t>${esc(c.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>';
  const lg =
    c.legend === 'none'
      ? ''
      : `<c:legend><c:legendPos val="${({ top: 't', bottom: 'b', left: 'l', right: 'r' } as Record<string, string>)[c.legend ?? 'right'] ?? 'r'}"/><c:overlay val="0"/></c:legend>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${lg}<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
}

const EMU = 9525;
export async function injectCharts(buf: Uint8Array, charts: ChartOut[], sheetNames: string[]): Promise<Uint8Array> {
  const items = charts.map((c) => ({ c, xml: chartXml(c) })).filter((x): x is { c: ChartOut; xml: string } => !!x.xml);
  if (!items.length) return buf;
  const zip = await JSZip.loadAsync(buf);
  const wbXml = await zip.file('xl/workbook.xml')!.async('string');
  const wbRels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const sheetFile = (name: string): string | null => {
    const m = [...wbXml.matchAll(/<sheet [^>]*?name="([^"]*)"[^>]*?r:id="([^"]*)"/g)].find(
      (x) => x[1].replace(/&amp;/g, '&').replace(/&apos;/g, "'") === name,
    );
    if (!m) return null;
    const r = new RegExp(
      `<Relationship [^>]*?Id="${m[2]}"[^>]*?Target="([^"]*)"|<Relationship [^>]*?Target="([^"]*)"[^>]*?Id="${m[2]}"`,
    ).exec(wbRels);
    const tg = r?.[1] ?? r?.[2];
    return tg ? 'xl/' + tg.replace(/^\/?(xl\/)?/, '') : null;
  };
  void sheetNames;
  let ct = await zip.file('[Content_Types].xml')!.async('string');
  let n = 0;
  const bySheet = new Map<string, typeof items>();
  for (const it of items) {
    const f = sheetFile(it.c.sheet);
    if (!f) continue;
    (bySheet.get(f) ?? bySheet.set(f, []).get(f)!).push(it);
  }
  let d = 0;
  for (const [file, list] of bySheet) {
    d++;
    const anchors: string[] = [];
    const rels: string[] = [];
    list.forEach((it, i) => {
      n++;
      zip.file(`xl/charts/chart${n}.xml`, it.xml);
      ct = ct.replace(
        '</Types>',
        `<Override PartName="/xl/charts/chart${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/></Types>`,
      );
      rels.push(
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${n}.xml"/>`,
      );
      const col = Math.max(0, Math.floor((it.c.left - 46) / 64)),
        row = Math.max(0, Math.floor((it.c.top - 20) / 20));
      anchors.push(
        `<xdr:oneCellAnchor><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:ext cx="${Math.round(it.c.width * EMU)}" cy="${Math.round(it.c.height * EMU)}"/><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${n}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:oneCellAnchor>`,
      );
    });
    zip.file(
      `xl/drawings/drawing${d}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>`,
    );
    zip.file(
      `xl/drawings/_rels/drawing${d}.xml.rels`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`,
    );
    ct = ct.replace(
      '</Types>',
      `<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    );
    const relPath = file.replace(/worksheets\/(sheet\d+\.xml)$/, 'worksheets/_rels/$1.rels');
    const rf = zip.file(relPath);
    let rx = rf
      ? await rf.async('string')
      : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    rx = rx.replace(
      '</Relationships>',
      `<Relationship Id="rIdDr${d}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d}.xml"/></Relationships>`,
    );
    zip.file(relPath, rx);
    let sx = await zip.file(file)!.async('string');
    if (!sx.includes('xmlns:r='))
      sx = sx.replace(
        '<worksheet ',
        '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ',
      );
    const tag = `<drawing r:id="rIdDr${d}"/>`;
    sx = /<(legacyDrawing|tableParts|extLst)/.test(sx)
      ? sx.replace(/<(legacyDrawing|tableParts|extLst)/, tag + '<$1')
      : sx.replace('</worksheet>', tag + '</worksheet>');
    zip.file(file, sx);
  }
  zip.file('[Content_Types].xml', ct);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}
