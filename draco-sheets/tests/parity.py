"""Draco Sheets parity suite: drives real engine features via window.dracoAPI and asserts results.
Run:  npm run build && npx vite preview --port 4174 &   then   python3 tests/parity.py
Needs: pip install playwright && playwright install chromium
"""
import json, sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4174/"
results = []  # (version, name, ok, detail)

PRE = """
const api = window.dracoAPI; const wb = api.getActiveWorkbook(); const sh = wb.getActiveSheet(); const E = api.Enum;
const R = (a) => sh.getRange(a);
const sd = (a) => R(a).getCellStyleData() || {};
"""

def check(pg, v, name, js, expect=None):
    try:
        out = pg.evaluate("(async()=>{" + PRE + js + "})()")
        ok = (out is True) if expect is None else (out == expect)
        results.append((v, name, ok, "" if ok else f"got {json.dumps(out)[:160]}"))
    except Exception as e:
        results.append((v, name, False, str(e).splitlines()[0][:160]))

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_function("window.dracoAPI && window.dracoAPI.getActiveWorkbook()")
    pg.wait_for_timeout(1200)

    # v11 font
    check(pg, 11, "bold/italic/underline/strike/family/size", """
      R('A1').setValue('x').setFontWeight('bold').setFontStyle('italic').setFontLine('underline').setFontFamily('Times New Roman').setFontSize(18);
      R('B1').setValue('y').setFontLine('line-through');
      const a = sd('A1'), b2 = sd('B1');
      return a.bl===1 && a.it===1 && !!a.ul && a.ff==='Times New Roman' && a.fs===18 && !!b2.st;""")
    # v12 colors
    check(pg, 12, "font color + fill", """
      R('A2').setValue('c').setFontColor('#ff0000').setBackground('#00ff00'); const s = sd('A2');
      return JSON.stringify(s.cl).toLowerCase().includes('ff0000') && JSON.stringify(s.bg).toLowerCase().includes('00ff00');""")
    # v13 alignment
    check(pg, 13, "horizontal + vertical alignment", """
      R('A3').setValue('a').setHorizontalAlignment('center').setVerticalAlignment('middle'); const s = sd('A3');
      return s.ht===2 && s.vt===2;""")
    check(pg, 13, "increase/decrease indent (padding)", """
      const id = wb.getId(), sid = sh.getSheetId(); R('A5').setValue('i');
      const set = (l) => api.executeCommand('sheet.command.set-range-values', { unitId:id, subUnitId:sid, range:{startRow:4,endRow:4,startColumn:0,endColumn:0}, value:{ s:{ pd:{ l } } } });
      await set(10); const a = sd('A5').pd?.l; await set(20); const b = sd('A5').pd?.l; await set(10); const c = sd('A5').pd?.l;
      return a===10 && b===20 && c===10;""")
    # v14 wrap + merge
    check(pg, 14, "wrap text", """
      R('A4').setValue('long text here').setWrap(true); return sd('A4').tb===3;""")
    check(pg, 14, "merge / mergeAcross / breakApart", """
      const r = R('C1:D2'); r.merge(); const m1 = R('C1:D2').isPartOfMerge();
      R('C1:D2').breakApart(); const m2 = R('C1:D2').isPartOfMerge();
      R('C4:E4').mergeAcross(); const m3 = R('C4:E4').isPartOfMerge();
      return m1===true && m2===false && m3===true;""")
    # v15 borders: all styles
    check(pg, 15, "all border styles + colors", """
      const styles = Object.entries(E.BorderStyleTypes).filter(([k,v])=>typeof v==='number' && v>0);
      let n=0; styles.forEach(([k,v],i)=>{ const cell = sh.getRange(10+i, 0); cell.setBorder(E.BorderType.ALL, v, '#336699'); const bd = cell.getCellStyleData()?.bd; if (bd && bd.t && bd.b && bd.l && bd.r) n++; });
      return n===styles.length ? true : `ok ${n}/${styles.length}`;""")
    # v16/v17 number formats
    nf = [
      (16, "Number #,##0.00", 1234.5, "#,##0.00", "1,234.50"),
      (16, "Currency", 1234.5, "$#,##0.00", "$1,234.50"),
      (16, "Accounting", 1234.5, '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)', None),
      (17, "Date yyyy-mm-dd", 45000, "yyyy-mm-dd", "2023-03-15"),
      (17, "Time h:mm AM/PM", 0.5, "h:mm AM/PM", "12:00 PM"),
      (17, "Percentage 0.0%", 0.256, "0.0%", "25.6%"),
      (17, "Fraction # ?/?", 0.5, "# ?/?", " 1/2"),
      (17, "Scientific 0.00E+00", 12345, "0.00E+00", "1.23E+04"),
      (17, "Text @", 123, "@", "123"),
      (18, "Custom 0.0,\" K\"", 12500, '0.0," K"', "12.5 K"),
      (18, "Custom negatives in parens", -5, "#,##0;(#,##0)", "(5)"),
    ]
    for i, (v, name, val, pat, want) in enumerate(nf):
        cell = f"G{i+1}"
        js = f"""const r = R('{cell}'); r.setValue({json.dumps(val)}); r.setNumberFormat({json.dumps(pat)}); await new Promise(x=>setTimeout(x,60));
                 const d = r.getDisplayValue ? r.getDisplayValue() : String(r.getValue()); return d;"""
        if want is None:
            js += ""; check(pg, v, "Number format: " + name, js.replace("return d;", "return /1,234\\.50/.test(d);"))
        else:
            check(pg, v, "Number format: " + name, js, want)
    # v21 rotation
    check(pg, 21, "text rotation 45/90/-90", """
      let ok=true; for (const [i,a] of [[0,45],[1,90],[2,-90]]) { const r = sh.getRange(30,i); r.setValue('r').setTextRotation(a); const t = r.getCellStyleData()?.tr; ok = ok && t && t.a===a; } return ok;""")
    # v22 shrink + overflow rules
    check(pg, 22, "shrink to fit", """
      R('A40').setValue('shrink me please').setShrinkToFit(true); const s = sd('A40'); return s.stf===1 ? true : JSON.stringify(s);""")
    check(pg, 22, "overflow / clip / wrap strategies", """
      const W=E.WrapStrategy; const out=[]; for (const [a,k] of [['A41','OVERFLOW'],['A42','CLIP'],['A43','WRAP']]) { R(a).setValue('t').setWrapStrategy(W[k]); out.push(sd(a).tb); } return JSON.stringify(out)==='[1,2,3]' ? true : JSON.stringify(out);""")
    # v23-25 conditional formatting
    check(pg, 23, "highlight rules (>, text contains, duplicates, empty)", """
      R('K1:K5').setValues([[1],[5],[10],[5],[20]]); const f = sh;
      const before = f.getConditionalFormattingRules().length;
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().whenNumberGreaterThan(6).setBackground('#ffc7ce').setFontColor('#9c0006').setRanges([R('K1:K5').getRange()]).build());
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().whenTextContains('x').setBold(true).setRanges([R('L1:L5').getRange()]).build());
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().setDuplicateValues(true).setBackground('#ffeb9c').setRanges([R('K1:K5').getRange()]).build());
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().whenCellEmpty().setBackground('#eee').setRanges([R('M1:M5').getRange()]).build());
      return f.getConditionalFormattingRules().length - before;""", 4)
    check(pg, 24, "data bars, color scales, icon sets", """
      const f = sh; const before = f.getConditionalFormattingRules().length;
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().setDataBar({ min:{type:'min'}, max:{type:'max'}, positiveColor:'#638ec6', isShowValue:true }).setRanges([R('N1:N5').getRange()]).build());
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().setColorScale([{index:0,color:'#f8696b',value:{type:'min'}},{index:1,color:'#ffeb84',value:{type:'percentile',value:50}},{index:2,color:'#63be7b',value:{type:'max'}}]).setRanges([R('O1:O5').getRange()]).build());
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().setIconSet({ iconConfigs:[{iconType:'3Arrows',iconId:'0',operator:'greaterThanOrEqual',value:{type:'percent',value:67}},{iconType:'3Arrows',iconId:'1',operator:'greaterThanOrEqual',value:{type:'percent',value:33}},{iconType:'3Arrows',iconId:'2',operator:'lessThan',value:{type:'percent',value:33}}], isShowValue:true }).setRanges([R('P1:P5').getRange()]).build());
      return f.getConditionalFormattingRules().length - before;""", 3)
    check(pg, 25, "custom formula rule + top-N rank + manage (delete)", """
      const f = sh; const n0 = f.getConditionalFormattingRules().length;
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().whenFormulaSatisfied('=$K1>$K2').setBackground('#cce5ff').setRanges([R('K1:K5').getRange()]).build());
      f.addConditionalFormattingRule(f.newConditionalFormattingRule().setRank({ isBottom:false, isPercent:false, value:2 }).setBold(true).setRanges([R('K1:K5').getRange()]).build());
      const rules = f.getConditionalFormattingRules(); const added = rules.length - n0;
      f.deleteConditionalFormattingRule(rules[rules.length-1].cfId); const after = f.getConditionalFormattingRules().length;
      return added===2 && after===rules.length-1;""")
    # sanity on earlier-verified engine features used by roadmap v26-v27/v32-33
    check(pg, 26, "formula bar + formulas calculate", """
      R('S1').setValue(3); R('S2').setValue(4); R('S3').setFormula('=S1*S2+SUM(S1:S2)'); await new Promise(x=>setTimeout(x,400)); return R('S3').getValue();""", 19)
    check(pg, 33, "XLOOKUP + XMATCH", """
      R('A100:A102').setValues([['a'],['b'],['c']]); R('B100:B102').setValues([[1],[2],[3]]); R('C100').setFormula('=XLOOKUP("b",A100:A102,B100:B102)'); R('C101').setFormula('=XMATCH("c",A100:A102)'); await new Promise(x=>setTimeout(x,500)); return [R('C100').getValue(), R('C101').getValue()].join(',');""", "2,3")
    check(pg, 17, "English month/day names in long date", """
      const r = R('H1'); r.setValue(45000); r.setNumberFormat('dddd, mmmm d, yyyy'); await new Promise(x=>setTimeout(x,80)); return r.getDisplayValue();""", "Wednesday, March 15, 2023")

    # --- UI-level checks (real clicks) ---
    pg.evaluate("window.dracoAPI.getActiveWorkbook().getActiveSheet().getRange('J50').setValue('ui').activate()")
    pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Increase indent").first.click(); pg.wait_for_timeout(250)
    pg.get_by_role("button", name="Increase indent").first.click(); pg.wait_for_timeout(250)
    pg.get_by_role("button", name="Decrease indent").first.click(); pg.wait_for_timeout(250)
    check(pg, 13, "indent buttons (UI): +,+,- = 1 level", "return (sd('J50').pd?.l) === 10;")
    pg.evaluate("window.dracoAPI.getActiveWorkbook().getActiveSheet().getRange('J51').setValue('style me').activate()")
    pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Styles", exact=True).click(); pg.wait_for_timeout(300)
    pg.locator(".swatch", has_text="Good").first.click(); pg.wait_for_timeout(400)
    check(pg, 20, "cell style gallery (UI): Good", "const s = sd('J51'); return JSON.stringify(s.bg).toLowerCase().includes('c6efce') && JSON.stringify(s.cl).toLowerCase().includes('006100');")
    pg.evaluate("window.dracoAPI.getActiveWorkbook().getActiveSheet().getRange('J52').setValue(1234.5).activate()")
    pg.get_by_role("button", name="Styles", exact=True).click(); pg.wait_for_timeout(300)
    pg.locator(".swatch", has_text="Heading 1").first.click(); pg.wait_for_timeout(400)
    check(pg, 20, "cell style gallery (UI): Heading 1 (bold, 15pt, border)", "const s = sd('J52'); return s.bl===1 && s.fs===15 && !!s.bd?.b;")
    # v19 format painter with real clicks: style A27, click it, click painter, click C27
    pg.evaluate("window.dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A27').setValue('src').setFontWeight('bold').setBackground('#abcdef').setFontSize(16)")
    pg.evaluate("window.dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A1').activate()"); pg.wait_for_timeout(200)
    pg.mouse.click(90, 184 + 24*26 + 4); pg.wait_for_timeout(200)           # select A27
    btn = pg.get_by_role("button", name="Format Painter").first
    btn.click(); pg.wait_for_timeout(200)
    pg.mouse.click(266, 184 + 24*26 + 4); pg.wait_for_timeout(500)          # click C27
    check(pg, 19, "format painter (UI): copies bold/size/fill", """
      const s = sd('C27'); return s.bl===1 && s.fs===16 && JSON.stringify(s.bg).toLowerCase().includes('abcdef') ? true : JSON.stringify(s);""")
    b.close()

fails = [r for r in results if not r[2]]
for v, name, ok, detail in sorted(results):
    print(("PASS" if ok else "FAIL"), f"v{v:<3}", name, ("— " + detail) if detail else "")
print(f"\n{len(results)-len(fails)}/{len(results)} passed; page errors: {errs}")
sys.exit(1 if fails else 0)
