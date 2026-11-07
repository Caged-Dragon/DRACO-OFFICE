"""Engine-native data tools (v46-v55): sort, filter, find/replace, validation, freeze, autofill, text-to-columns.
Run: python3 tests/data-engine.py   (preview server on :4174)"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4174/app"
res = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_function("window.dracoAPI && window.dracoAPI.getActiveWorkbook()"); pg.wait_for_timeout(1200)
    def T(v, name, js, want=True):
        try:
            out = pg.evaluate("(async()=>{const api=window.dracoAPI,wb=api.getActiveWorkbook(),sh=wb.getActiveSheet();const E=api.Enum;const g=(a)=>sh.getRange(a).getValue();const col=(a)=>sh.getRange(a).getValues().map(r=>r[0]);const wait=(ms)=>new Promise(x=>setTimeout(x,ms));" + js + "})()")
            ok = out == want; res.append((v, name, ok, "" if ok else f"got {json.dumps(out)[:200]}"))
        except Exception as e:
            res.append((v, name, False, str(e).splitlines()[0][:200]))
    T(0, "setup", "sh.setColumnCount(60); sh.setRowCount(300); return true;")
    # v46 sort
    T(46, "single-column sort ascending (numbers)", "sh.getRange('A1:A5').setValues([[5],[3],[9],[1],[7]]); sh.getRange('A1:A5').sort({column:0, ascending:true}); await wait(300); return col('A1:A5');", [1,3,5,7,9])
    T(46, "descending sort", "sh.getRange('A1:A5').sort({column:0, ascending:false}); await wait(300); return col('A1:A5');", [9,7,5,3,1])
    T(46, "text sort (A to Z, case-insensitive)", "sh.getRange('B1:B5').setValues([['pear'],['Apple'],['banana'],['cherry'],['Date']]); sh.getRange('B1:B5').sort({column:0, ascending:true}); await wait(300); return col('B1:B5');", ["Apple","banana","cherry","Date","pear"])
    T(46, "multi-level sort (dept asc, salary desc) keeps rows together", """
      sh.getRange('D1:F6').setValues([['b',10,'r1'],['a',30,'r2'],['b',50,'r3'],['a',20,'r4'],['b',30,'r5'],['a',30,'r6']]);
      sh.getRange('D1:F6').sort([{column:0, ascending:true},{column:1, ascending:false}]); await wait(400);
      return sh.getRange('D1:F6').getValues().map(r=>r.join('|')).join(',');""", "a|30|r2,a|30|r6,a|20|r4,b|50|r3,b|30|r5,b|10|r1")
    T(46, "sort moves formulas with their rows (relative refs follow)", """
      sh.getRange('H1:H3').setValues([[3],[1],[2]]); sh.getRange('I1').setFormula('=H1*10'); sh.getRange('I2').setFormula('=H2*10'); sh.getRange('I3').setFormula('=H3*10'); await wait(500);
      sh.getRange('H1:I3').sort({column:0, ascending:true}); await wait(600); return sh.getRange('H1:I3').getValues().map(r=>r.join('|')).join(',');""", "1|10,2|20,3|30")
    T(46, "blanks sort to the bottom", "sh.getRange('K1:K5').setValues([[3],[null],[1],[null],[2]]); sh.getRange('K1:K5').sort({column:0, ascending:true}); await wait(300); return col('K1:K5').map(v=>v===null||v===''?'_':v).join(',');", "1,2,3,_,_")
    # v47 autofilter
    T(47, "create filter on a range and filter by values", """
      sh.getRange('M1:N6').setValues([['name','dept'],['a','x'],['b','y'],['c','x'],['d','z'],['e','x']]);
      const f = sh.getRange('M1:N6').createFilter(); await wait(300);
      f.setColumnFilterCriteria(13, { colId: 1, filters: { filters: ['x'] } }); await wait(500);
      return JSON.stringify(f.getFilteredOutRows());""", "[2,4]")
    T(47, "remove filter criteria shows all rows again", """
      const f = sh.getFilter(); f.removeFilterCriteria(); await wait(500); return JSON.stringify(f.getFilteredOutRows());""", "[]")
    T(47, "filter by blank", """
      sh.getRange('P1:P5').setValues([['h'],['a'],[null],['b'],[null]]); const f = sh.getFilter(); f.remove ? f.remove() : null; await wait(300);
      const f2 = sh.getRange('P1:P5').createFilter(); await wait(300); f2.setColumnFilterCriteria(15, { colId: 0, filters: { blank: true } }); await wait(500); const out = JSON.stringify(f2.getFilteredOutRows()); f2.remove(); await wait(400); return out;""", "[1,3]")
    T(47, "removing the filter unhides all rows", "return JSON.stringify(sh.getFilter()?.getFilteredOutRows?.() ?? []);", "[]")
    # v49 find & replace
    T(49, "find: count matches (default / match case / entire cell)", """
      sh.getRange('R1:R5').setValues([['Zqx'],['zqx pie'],['ZQX'],['grape'],['zqx']]); await wait(200);
      const count = async (tf) => { await tf.ensureCompleteAsync(); const seen = new Set(); for (let i=0;i<20;i++){ const r = tf.findNext(); if(!r) break; const k=r.getA1Notation(); if (seen.has(k)) break; seen.add(k);} return seen.size; };
      const tf = await api.createTextFinderAsync('zqx'); const a = await count(tf);
      await tf.matchCaseAsync(true); const b = await count(tf); await tf.matchEntireCellAsync(true); const c = await count(tf);
      return [a,b,c].join(',');""", "4,2,1")
    T(49, "replace all", """
      sh.getRange('S1:S4').setValues([['cat'],['concat'],['dog'],['cat']]); await wait(200);
      const tf = await api.createTextFinderAsync('cat'); const n = await tf.replaceAllWithAsync('cow'); await wait(400); return n + ':' + col('S1:S4').join(',');""", "3:cow,concow,dog,cow")
    # v51 data validation
    T(51, "list validation: attach + read back", """
      const rule = api.newDataValidation().requireValueInList(['red','green','blue']).setAllowInvalid(false).build();
      sh.getRange('U1').setDataValidation(rule); await wait(300); const dv = sh.getRange('U1').getDataValidation(); return !!dv && dv.getCriteriaType() ? true : !!dv;""")
    T(51, "number-between validation: valid and invalid detected", """
      sh.getRange('V1:V3').setValues([[5],[50],[7]]); sh.getRange('V1:V3').setDataValidation(api.newDataValidation().requireNumberBetween(1,10).build()); await wait(600);
      const st = await sh.getRange('V1:V3').getValidatorStatus(); return st.flat().join(',');""", 'valid,invalid,valid')
    T(52, "custom-formula validation (even numbers only)", """
      sh.getRange('W1:W3').setValues([[2],[3],[4]]); sh.getRange('W1:W3').setDataValidation(api.newDataValidation().requireFormulaSatisfied('=ISEVEN(W1)').build()); await wait(800);
      return (await sh.getRange('W1:W3').getValidatorStatus()).flat().join(',');""", 'valid,invalid,valid')
    T(52, "text-length rule via custom formula (<= 4 chars)", """
      sh.getRange('W5:W6').setValues([['ab'],['abcdefgh']]); sh.getRange('W5:W6').setDataValidation(api.newDataValidation().requireFormulaSatisfied('=LEN(W5)<=4').build()); await wait(800);
      return (await sh.getRange('W5:W6').getValidatorStatus()).flat().join(',');""", "valid,invalid")
    T(52, "date validation + checkbox + list-from-range builders exist", """
      const b = api.newDataValidation(); return ['requireDateAfter','requireDateBetween','requireCheckbox','requireValueInRange','setAllowBlank'].map(m=>typeof b[m]).join(',');""", "function,function,function,function,function")
    # v54 autofill
    T(54, "autofill number series (1,2 -> 3,4,5)", "sh.getRange('X1:X2').setValues([[1],[2]]); await sh.getRange('X1:X2').autoFill(sh.getRange('X1:X5'), 'SERIES'); await wait(500); return col('X1:X5');", [1,2,3,4,5])
    T(54, "autofill copy", "sh.getRange('Y1:Y2').setValues([[1],[2]]); await sh.getRange('Y1:Y2').autoFill(sh.getRange('Y1:Y5'), 'COPY'); await wait(500); return col('Y1:Y5');", [1,2,1,2,1])
    T(54, "autofill days of week (Mon -> Tue, Wed)", "sh.getRange('Z1').setValue('Mon'); await sh.getRange('Z1').autoFill(sh.getRange('Z1:Z4'), 'SERIES'); await wait(500); return col('Z1:Z4');", ["Mon","Tue","Wed","Thu"])
    T(54, "autofill months (Jan -> Feb, Mar)", "sh.getRange('AA1').setValue('Jan'); await sh.getRange('AA1').autoFill(sh.getRange('AA1:AA4'), 'SERIES'); await wait(500); return col('AA1:AA4');", ["Jan","Feb","Mar","Apr"])
    T(54, "autofill formula adjusts refs", "sh.getRange('AB1:AB3').setValues([[1],[2],[3]]); sh.getRange('AC1').setFormula('=AB1*2'); await wait(300); await sh.getRange('AC1').autoFill(sh.getRange('AC1:AC3'), 'SERIES'); await wait(800); return [sh.getRange('AC2').getFormula(), sh.getRange('AC3').getFormula()].join(',');", "=AB2*2,=AB3*2")
    # v55 freeze panes
    T(55, "freeze rows + columns, read back, unfreeze", """
      sh.setFrozenRows(2); sh.setFrozenColumns(1); await wait(300); const a=[sh.getFrozenRows(), sh.getFrozenColumns()];
      sh.setFrozenRows(0); sh.setFrozenColumns(0); await wait(300); return JSON.stringify([a, sh.getFrozenRows(), sh.getFrozenColumns()]);""", "[[2,1],0,0]")
    # v53 text to columns (engine-native)
    T(53, "text to columns (comma)", """
      sh.getRange('AE1:AE2').setValues([['a,b,c'],['d,e,f']]); sh.getRange('AE1:AE2').splitTextToColumns(false, E.SplitDelimiterType.Comma); await wait(500);
      return sh.getRange('AE1:AG2').getValues().map(r=>r.join('')).join(',');""", "abc,def")
    b.close()
for v, n, ok, d in sorted(res, key=lambda r: r[0]): print(("PASS" if ok else "FAIL"), f"v{v:<3}", n, ("— " + d) if (d and not ok) else "")
bad = [r for r in res if not r[2]]
print(f"\n{len(res)-len(bad)}/{len(res)} passed; page errors: {errs}")
sys.exit(1 if bad else 0)
