"""UI tests for the Data tools dialog (v48, v50, v53, v56-v60), real clicks. Run: python3 tests/data-ui.py"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4174/"
res = []
def rec(v, name, ok, detail=""): res.append((v, name, bool(ok), detail))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_function("window.dracoAPI && window.dracoAPI.getActiveWorkbook()"); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate("(async()=>{const api=window.dracoAPI,wb=api.getActiveWorkbook(),sh=wb.getActiveSheet();const wait=(ms)=>new Promise(x=>setTimeout(x,ms));const col=(a)=>sh.getRange(a).getValues().map(r=>r[0]);" + js + "})()")
    def opn(tab):
        pg.get_by_role("button", name="Data", exact=True).click(); pg.wait_for_timeout(250)
        pg.get_by_role("tab", name=tab, exact=True).click(); pg.wait_for_timeout(200)
    def close(): pg.locator(".dialog header .icon").click(); pg.wait_for_timeout(200)
    def msg(): return pg.locator(".dialog [role=status], .dialog [role=alert], .dialog .msg").first.inner_text()
    ev("sh.setColumnCount(40); sh.setRowCount(200); return 1")

    # ---- v53 remove duplicates ----
    ev("sh.getRange('A1:B6').setValues([['id','name'],[1,'Ann'],[2,'ann'],[1,'Bob'],[3,'Cy'],[2,'Dee']]); sh.getRange('A1:B6').activate()"); pg.wait_for_timeout(200)
    opn("Remove duplicates"); pg.get_by_label("name", exact=True).uncheck()   # compare id column only
    pg.get_by_role("button", name="Remove duplicates").click(); pg.wait_for_timeout(600)
    m = msg(); close()
    rec(53, "remove duplicates by id column only: reports 2 removed", "2 duplicate" in m, m)
    got = ev("return sh.getRange('A1:B6').getValues().map(r=>r.join('|')).join(',')")
    rec(53, "kept first occurrences, header kept, tail cleared", got == "id|name,1|Ann,2|ann,3|Cy,|,|", got)
    ev("sh.getRange('A1:B4').activate()"); opn("Remove duplicates"); pg.get_by_role("button", name="Remove duplicates").click(); pg.wait_for_timeout(400)
    rec(53, "second run on the unique rows finds none", "No duplicate" in msg(), msg()); close()
    ev("sh.getRange('A1:B6').activate()"); opn("Remove duplicates"); pg.get_by_role("button", name="Remove duplicates").click(); pg.wait_for_timeout(400)
    rec(53, "blank rows count as duplicates of each other (like Excel)", "1 duplicate" in msg(), msg()); close()

    # ---- v53 text to columns ----
    ev("sh.getRange('D1:D3').setValues([['a,b,c'],['1,2,3'],['x,\"y,z\",w']]); sh.getRange('D1:D3').activate()"); pg.wait_for_timeout(200)
    opn("Text to columns"); pg.get_by_role("button", name="Split", exact=True).click(); pg.wait_for_timeout(500)
    got = ev("return sh.getRange('D1:G3').getValues().map(r=>r.join('|')).join(',')"); close()
    rec(53, "text to columns: comma, numbers converted, quoted field kept", got == "a|b|c|,1|2|3|,x|y,z|w|", got)
    ev("sh.getRange('D1:D2').setValues([['p,q'],['r,s']]); sh.getRange('D1:D2').activate()"); pg.wait_for_timeout(200)
    opn("Text to columns"); pg.get_by_role("button", name="Split", exact=True).click(); pg.wait_for_timeout(300)
    rec(53, "text to columns refuses to overwrite data to the right", "already data" in msg().lower(), msg()); close()

    # ---- v53 flash fill ----
    ev("sh.getRange('I1:I4').setValues([['John Smith'],['Jane Doe'],['Al Roe'],['Mary Jones']]); sh.getRange('J1').setValue('Smith, John'); sh.getRange('J1').activate()"); pg.wait_for_timeout(200)
    opn("Flash Fill"); pg.get_by_role("button", name="Flash Fill", exact=True).click(); pg.wait_for_timeout(500)
    m = msg(); got = ev("return col('J1:J4')"); close()
    rec(53, "flash fill 'Last, First' from one example", got == ["Smith, John", "Doe, Jane", "Roe, Al", "Jones, Mary"], f"{got} | {m}")
    ev("sh.getRange('L1:L3').setValues([['x'],['y'],['z']]); sh.getRange('M1').activate()"); opn("Flash Fill"); pg.get_by_role("button", name="Flash Fill", exact=True).click(); pg.wait_for_timeout(300)
    rec(53, "flash fill asks for an example when none given", "example" in msg().lower(), msg()); close()

    # ---- v50 go to / go to special ----
    opn("Go To"); pg.get_by_label("Go to (cell").fill("Z50"); pg.get_by_role("button", name="Go", exact=True).click(); pg.wait_for_timeout(400)
    rec(50, "Go To cell Z50 moves selection and closes", pg.locator(".dialog").count() == 0 and ev("return sh.getActiveRange().getA1Notation()") in ("Z50", "Z50:Z50"))
    opn("Go To"); pg.get_by_label("Go to (cell").fill("Q9999999"); pg.get_by_role("button", name="Go", exact=True).click(); pg.wait_for_timeout(300)
    rec(50, "Go To invalid reference shows error", "isn't valid" in msg(), msg()); close()
    ev("sh.getRange('O1:Q3').setValues([[1,'t',null],[null,'=1/0',5],[true,null,null]]); sh.getRange('P2').setFormula('=1/0'); sh.getRange('Q2').setFormula('=2+3'); sh.getRange('O1:Q3').activate()"); pg.wait_for_timeout(900)
    for label, kind_text, want in [("Blanks", "Blanks", 4), ("Constants", "Constants", 3), ("Formulas", "Formulas", 2), ("Errors", "Errors", 1)]:
        opn("Go To"); pg.locator(".dialog select").first.select_option(label=kind_text); pg.get_by_role("button", name="Select cells").click(); pg.wait_for_timeout(500)
        m = msg(); rec(50, f"Go To Special: {label} finds {want}", m.startswith("✔ " + str(want)) or (f"{want} cell" in m), m); close()
        ev("sh.getRange('O1:Q3').activate()"); pg.wait_for_timeout(150)
    opn("Go To"); pg.locator(".dialog select").first.select_option(label="Blanks"); pg.get_by_role("button", name="Select cells").click(); pg.wait_for_timeout(600); close()
    sel = ev("return (sh.getSelection()?.getActiveRangeList()||[]).map(r=>r.getA1Notation()).join(',')")
    rec(50, "Go To Special selects the found cells (multi-range selection)", len(sel.split(",")) >= 2, sel)

    # ---- v48 advanced filter ----
    ev("sh.getRange('A30:C35').setValues([['Name','Dept','Age'],['Ann','Eng',30],['Bob','Ops',45],['Cy','Eng',52],['Dee','HR',28],['Al','Eng',30]]); sh.getRange('E30:F31').setValues([['Dept','Age'],['Eng','>40']]); sh.getRange('A30').activate()"); pg.wait_for_timeout(300)
    opn("Advanced filter"); pg.get_by_label("List range").fill("A30:C35"); pg.get_by_label("Criteria range").fill("E30:F31")
    pg.get_by_role("button", name="Apply filter").click(); pg.wait_for_timeout(500); m = msg()
    hidden = ev("const snap=wb.save(); const s=Object.values(snap.sheets)[0]; return [31,32,33,34].map(r=>(s.rowData?.[r]?.hd===1)?1:0).join('')")
    rec(48, "advanced filter in place: only Cy (Eng, >40) visible; Ann/Al (Eng, 30) hidden too", hidden == "1011" and "1 of 5" in m, f"{hidden} | {m}")
    pg.get_by_role("button", name="Show all rows").click(); pg.wait_for_timeout(400)
    hidden = ev("const snap=wb.save(); const s=Object.values(snap.sheets)[0]; return [30,31,32,33,34].map(r=>(s.rowData?.[r]?.hd===1)?1:0).join('')")
    rec(48, "show all rows restores visibility", hidden == "00000", hidden)
    pg.get_by_label("Action").select_option("copy"); pg.get_by_role("textbox", name="Copy to").fill("K30"); pg.get_by_label("Criteria range").fill("E30:F32")
    ev("sh.getRange('E32:F32').setValues([['Ops','']])"); pg.get_by_role("button", name="Apply filter").click(); pg.wait_for_timeout(500)
    got = ev("return sh.getRange('K30:M32').getValues().map(r=>r.join('|')).join(',')"); close()
    rec(48, "advanced filter copy-to: OR rows (Eng & >40) or Ops", got == "Name|Dept|Age,Bob|Ops|45,Cy|Eng|52", got)

    # ---- v56 subtotal ----
    ev("sh.getRange('A50:C54').setValues([['dept','sales','units'],['a',10,1],['a',20,2],['b',5,3],['b',7,4]]); sh.getRange('A50:C54').activate()"); pg.wait_for_timeout(300)
    opn("Subtotal"); pg.get_by_label("sales", exact=True).check(); pg.get_by_role("button", name="Add subtotals").click(); pg.wait_for_timeout(1200)
    m = msg()
    got = ev("return sh.getRange('A50:B58').getValues().map(r=>r.join('|')).join(',')"); f = ev("return [sh.getRange('B53').getFormula(), sh.getRange('B56').getFormula(), sh.getRange('B57').getFormula()]")
    rec(56, "subtotal rows inserted per group + grand total", "3 subtotal" in m and got.startswith("dept|sales,a|10,a|20,a Total|30,b|5,b|7,b Total|12,Grand Total|42"), f"{got} | {m}")
    rec(56, "subtotal uses SUBTOTAL formulas", f == ["=SUBTOTAL(9,B51:B52)", "=SUBTOTAL(9,B54:B55)", "=SUBTOTAL(9,B51:B56)"], str(f))
    pg.get_by_role("button", name="Remove all").click(); pg.wait_for_timeout(900)
    got = ev("return sh.getRange('A50:B54').getValues().map(r=>r.join('|')).join(',')"); close()
    rec(56, "remove all subtotals restores the data", got == "dept|sales,a|10,a|20,b|5,b|7", got)

    # ---- v57 format as table ----
    ev("sh.getRange('A70:B73').setValues([['h1','h2'],[1,2],[3,4],[5,6]]); sh.getRange('A70:B73').activate()"); pg.wait_for_timeout(200)
    opn("Format as table"); pg.get_by_role("button", name="Green").click(); pg.get_by_role("button", name="Format as table", exact=True).click(); pg.wait_for_timeout(600)
    s = ev("const g=(a)=>sh.getRange(a).getCellStyleData()||{}; return [g('A70'), g('A71'), g('A72')].map(x=>JSON.stringify(x.bg||'')+'/'+(x.bl||0)).join(' ')").lower()
    rec(57, "format as table: header green bold, rows banded", "70ad47" in s and "e2efda" in s, s)
    has = ev("return !!sh.getFilter()"); rec(57, "format as table adds filter buttons", has)
    pg.get_by_role("button", name="Clear table style").click(); pg.wait_for_timeout(400); close()
    rec(57, "clear table style removes filter and fills", ev("return !sh.getFilter() && !(JSON.stringify(sh.getRange('A70').getCellStyleData()?.bg||'').toLowerCase().includes('70ad47'))"))

    # ---- v59/v60 what-if ----
    ev("sh.getRange('C1').setValue(10); sh.getRange('C2').setFormula('=C1*3+2'); sh.getRange('E60:E62').setValues([[1],[2],[3]]); sh.getRange('E60:E62').activate()"); pg.wait_for_timeout(700)
    opn("What-if"); pg.get_by_label("Set cell").fill("C2"); pg.get_by_label("To value").fill("11"); pg.get_by_label("By changing cell").fill("C1")
    pg.get_by_role("button", name="Solve").click(); pg.wait_for_function("document.querySelector('.dialog [role=status], .dialog [role=alert]')", timeout=60000); pg.wait_for_timeout(300)
    m = msg(); v = ev("await wait(300); return [sh.getRange('C1').getValue(), sh.getRange('C2').getValue()]")
    rec(59, "goal seek: 3x+2=11 -> x=3", abs(v[0] - 3) < 1e-4 and abs(v[1] - 11) < 1e-3 and "found a solution" in m, f"{v} | {m}")
    pg.get_by_label("Set cell").fill("C2"); pg.get_by_label("To value").fill("-5"); pg.get_by_label("By changing cell").fill("C2")
    pg.get_by_role("button", name="Solve").click(); pg.wait_for_timeout(600)
    rec(59, "goal seek rejects formula as changing cell", "must contain a value" in msg(), msg())
    ev("sh.getRange('E60:E62').activate()"); pg.get_by_label("Column input cell").fill("C1"); pg.get_by_label("Formula cell").fill("C2")
    pg.get_by_role("button", name="Fill data table").click(); pg.wait_for_function("document.querySelector('.dialog [role=status]') && document.querySelector('.dialog [role=status]').innerText.includes('Filled')", timeout=60000); pg.wait_for_timeout(300)
    got = ev("return [col('F60:F62'), sh.getRange('C1').getValue()]")
    rec(60, "one-variable data table: x=1,2,3 -> 5,8,11 and input restored", got[0] == [5, 8, 11] and abs(got[1] - 3) < 1e-4, str(got))
    pg.get_by_label("Scenario name").fill("Base"); pg.get_by_label("Changing cells").fill("C1"); pg.get_by_role("button", name="Save scenario").click(); pg.wait_for_timeout(200)
    ev("sh.getRange('C1').setValue(99)"); pg.wait_for_timeout(300)
    pg.locator(".filelist .row", has_text="Base").click(); pg.wait_for_timeout(1500)
    rec(60, "scenario saved then shown restores value", abs(ev("return sh.getRange('C1').getValue()") - 3) < 1e-6)
    pg.get_by_role("button", name="Delete scenario Base").click(); pg.wait_for_timeout(200)
    rec(60, "scenario delete", pg.locator(".filelist").count() == 0); close()

    # ---- v59 consolidate ----
    ev("sh.getRange('A100:C102').setValues([['','Q1','Q2'],['east',10,20],['west',5,5]]); const d=wb.create('Reg2',20,10); d.getRange('A1:C3').setValues([['','Q2','Q1'],['north',7,8],['east',100,1000]]); wb.setActiveSheet(sh)"); pg.wait_for_timeout(400)
    opn("Consolidate"); pg.get_by_label("Source ranges").fill("A100:C102\nReg2!A1:C3"); pg.get_by_label("Destination").fill("H100"); pg.get_by_role("button", name="Consolidate", exact=True).click(); pg.wait_for_timeout(500)
    got = ev("return sh.getRange('H100:J103').getValues().map(r=>r.join('|')).join(',')"); close()
    rec(59, "consolidate by labels across sheets", got == "|Q1|Q2,east|1010|120,west|5|5,north|8|7", got)
    b.close()

for v, n, ok, d in sorted(res, key=lambda r: r[0]): print(("PASS" if ok else "FAIL"), f"v{v:<3}", n, ("— " + d) if (d and not ok) else "")
bad = [r for r in res if not r[2]]
print(f"\n{len(res)-len(bad)}/{len(res)} passed; page errors: {errs}")
sys.exit(1 if bad else 0)
