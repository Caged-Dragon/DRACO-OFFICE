"""UI + behavior tests for v26 and v41-v45 (real clicks and keystrokes). Run: python3 tests/formula-ui.py"""
import sys, json
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4174/"
res = []
def rec(v, name, ok, detail=""): res.append((v, name, bool(ok), detail))
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(URL, wait_until="networkidle"); pg.wait_for_function("window.dracoAPI && window.dracoAPI.getActiveWorkbook()"); pg.wait_for_timeout(1200)
    ev = lambda js: pg.evaluate("(async()=>{const api=window.dracoAPI,wb=api.getActiveWorkbook(),sh=wb.getActiveSheet();" + js + "})()")
    ev("sh.setColumnCount(40); sh.setRowCount(200); sh.getRange('A1:B3').setValues([[3,10],[1,20],[4,30]]); sh.getRange('D1').setFormula('=A1+B1'); sh.getRange('E1').setFormula('=D1*2'); sh.getRange('F1').setFormula('=SUM(D1:E1)'); sh.getRange('A20').setFormula('=1/0'); sh.getRange('B22').setFormula('=NA()');")
    pg.wait_for_timeout(1200)

    # v41 Name Manager (UI)
    ev("sh.getRange('B1:B3').activate()"); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Formulas", exact=True).click(); pg.wait_for_timeout(300)
    pg.get_by_label("Name", exact=True).fill("A1"); pg.get_by_role("button", name="Add name").click(); pg.wait_for_timeout(200)
    rec(41, "rejects cell-like name (A1)", pg.locator(".msg").count() == 1 and "cell reference" in pg.locator(".msg").inner_text())
    pg.get_by_label("Name", exact=True).fill("1bad"); pg.get_by_role("button", name="Add name").click()
    rec(41, "rejects name starting with digit", "must start" in pg.locator(".msg").inner_text())
    pg.get_by_label("Name", exact=True).fill("SalesData"); pg.get_by_role("button", name="Add name").click(); pg.wait_for_timeout(300)
    rec(41, "adds valid name from selection", "SalesData" in pg.locator(".filelist").inner_text() and "$B$1:$B$3" in pg.locator(".filelist").inner_text(), pg.locator(".filelist").inner_text()[:80])
    pg.get_by_label("Name", exact=True).fill("salesdata"); pg.get_by_role("button", name="Add name").click()
    rec(41, "rejects duplicate (case-insensitive)", "already exists" in pg.locator(".msg").inner_text())
    pg.get_by_label("Name", exact=True).fill("Doubled"); pg.get_by_label("Refers to").fill("=SalesData*2"); pg.get_by_role("button", name="Add name").click(); pg.wait_for_timeout(300)
    pg.keyboard.press("Escape"); pg.locator(".dialog header .icon").click(); pg.wait_for_timeout(200)
    r = ev("sh.getRange('H1').setFormula('=SUM(SalesData)'); sh.getRange('H2').setFormula('=SUM(Doubled)'); await new Promise(x=>setTimeout(x,1200)); return [sh.getRange('H1').getValue(), sh.getRange('H2').getValue()];")
    rec(41, "names usable in formulas (range name + formula name)", r == [60, 120], str(r))
    # edit + delete
    pg.get_by_role("button", name="Formulas", exact=True).click(); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Delete name Doubled").click(); pg.wait_for_timeout(200)
    rec(41, "delete name", "Doubled" not in pg.locator(".filelist").inner_text())
    pg.locator(".dialog header .icon").click(); pg.wait_for_timeout(200)

    # v43 Auditing
    ev("sh.getRange('F1').activate()"); pg.wait_for_timeout(200)
    pg.get_by_role("button", name="Formulas", exact=True).click(); pg.get_by_role("tab", name="Auditing").click(); pg.wait_for_timeout(300)
    t = pg.locator(".filelist").inner_text()
    rec(43, "trace precedents (direct) of F1 = D1:E1", "D1:E1" in t and "A1" not in t.replace("D1:E1", ""), t)
    pg.get_by_label("All levels").check(); pg.wait_for_timeout(200)
    t = pg.locator(".filelist").inner_text()
    rec(43, "trace precedents (all levels) reaches A1 and B1", "A1" in t and "B1" in t, t.replace("\n", " "))
    pg.get_by_label("All levels").uncheck(); pg.get_by_role("button", name="All formulas").click(); pg.wait_for_timeout(200)
    rec(43, "formula list shows F1 =SUM(D1:E1)", "=SUM(D1:E1)" in pg.locator(".filelist").inner_text())
    pg.locator(".filelist .row", has_text="D1").first.click(); pg.wait_for_timeout(400)   # jump & close
    rec(43, "click jumps to cell and closes dialog", pg.locator(".dialog").count() == 0 and ev("return sh.getActiveRange().getA1Notation()") in ("D1", "D1:D1"))
    ev("sh.getRange('D1').activate()"); pg.get_by_role("button", name="Formulas", exact=True).click(); pg.get_by_role("tab", name="Auditing").click()
    pg.get_by_role("button", name="Trace dependents").click(); pg.wait_for_timeout(200)
    t = pg.locator(".filelist").inner_text()
    rec(43, "trace dependents of D1 = E1, F1", "E1" in t and "F1" in t, t.replace("\n", " "))
    pg.locator(".dialog header .icon").click()

    # v44 Error checking + Watch window
    pg.get_by_role("button", name="Formulas", exact=True).click(); pg.get_by_role("tab", name="Error checking").click(); pg.wait_for_timeout(400)
    t = pg.locator(".filelist").inner_text()
    rec(44, "error scan finds #DIV/0! and #N/A with cell refs", "A20" in t and "#DIV/0!" in t and "B22" in t and "#N/A" in t, t.replace("\n", " "))
    pg.locator(".dialog header .icon").click()
    ev("sh.getRange('B3').activate()"); pg.get_by_role("button", name="Formulas", exact=True).click(); pg.get_by_role("tab", name="Watch window").click()
    pg.get_by_role("button", name="Add watch for current cell").click(); pg.wait_for_timeout(300)
    rec(44, "watch window lists B3 = 30", "30" in pg.locator(".watch").inner_text(), pg.locator(".watch").inner_text().replace("\n", " "))
    ev("sh.getRange('B3').setValue(99)"); pg.wait_for_timeout(1600)
    rec(44, "watch value updates live", "99" in pg.locator(".watch").inner_text(), pg.locator(".watch").inner_text().replace("\n", " "))
    pg.locator(".dialog header .icon").click()

    # v45 Calculation
    pg.get_by_role("button", name="Formulas", exact=True).click(); pg.get_by_role("tab", name="Calculation").click()
    pg.get_by_role("button", name="Calculate now").click(); pg.wait_for_timeout(400)
    rec(45, "Calculate now runs without error", "started" in pg.locator("[role=status]").inner_text())
    pg.locator(".dialog header .icon").click()
    r = ev("sh.getRange('A30').setFormula('=A31+1'); sh.getRange('A31').setFormula('=A30+1'); await new Promise(x=>setTimeout(x,1500)); return [String(sh.getRange('A30').getValue()), String(sh.getRange('A31').getValue())];")
    rec(45, "circular reference does not hang the engine (value reported)", r is not None, str(r))
    r = ev("sh.getRange('A40').setValue(5); await new Promise(x=>setTimeout(x,500)); return sh.getRange('A40').getValue();")
    rec(45, "engine still responsive after circular ref", r == 5, str(r))
    pg.get_by_role("button", name="Formulas", exact=True).click(); pg.get_by_role("tab", name="Error checking").click(); pg.wait_for_timeout(500)
    t = pg.locator(".dialog").inner_text()
    rec(45, "circular references flagged in Error checking (A30, A31)", "circular references (2)" in t.lower() and "A30" in t and "A31" in t, t.replace("\n", " ")[:200])
    pg.locator(".dialog header .icon").click()

    # v26 F4 toggles absolute/relative in the formula editor; F2 enters edit mode
    ev("sh.getRange('J1').activate()"); pg.wait_for_timeout(200)
    pg.keyboard.press("F2"); pg.keyboard.type("=A1"); pg.keyboard.press("F4"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    f = ev("return sh.getRange('J1').getFormula()")
    rec(26, "F2 edit + F4 -> absolute ref ($A$1)", f == "=$A$1", f)
    ev("sh.getRange('J2').activate()"); pg.keyboard.press("F2"); pg.keyboard.type("=A1"); pg.keyboard.press("F4"); pg.keyboard.press("F4"); pg.keyboard.press("Enter"); pg.wait_for_timeout(500)
    f = ev("return sh.getRange('J2').getFormula()")
    rec(26, "F4 twice -> mixed ref (A$1)", f == "=A$1", f)

    # v42 relative/absolute refs when copying formulas
    ev("sh.getRange('L1:L3').setValues([[1],[2],[3]]); sh.getRange('M1').setFormula('=L1*2'); sh.getRange('N1').setFormula('=$L$1+L1')"); pg.wait_for_timeout(600)
    ev("sh.getRange('M2:M3').copyFrom ? sh.getRange('M2:M3').copyFrom(sh.getRange('M1')) : null"); pg.wait_for_timeout(300)
    f = ev("return [sh.getRange('M2').getFormula(), sh.getRange('M3').getFormula()]")
    if f == ["", ""]:
        pg.context.grant_permissions(["clipboard-read", "clipboard-write"])
        ev("sh.getRange('M1:N1').activate()"); pg.wait_for_timeout(200); pg.keyboard.press("Control+c"); pg.wait_for_timeout(400)
        ev("sh.getRange('M2:N3').activate()"); pg.wait_for_timeout(200); pg.keyboard.press("Control+v"); pg.wait_for_timeout(900)
        f = ev("return [sh.getRange('M2').getFormula(), sh.getRange('M3').getFormula(), sh.getRange('N3').getFormula()]")
    rec(42, "copy/paste adjusts relative refs, keeps absolute", f[:2] == ["=L2*2", "=L3*2"] and (len(f) < 3 or f[2] == "=$L$1+L3"), str(f))
    # v40 spill + v42 3D refs
    r = ev("""sh.getRange('R1').setFormula('=SEQUENCE(3)'); sh.getRange('T1').setFormula('=SORT({3;1;2})'); sh.getRange('V2').setValue('x'); sh.getRange('V1').setFormula('=SEQUENCE(3)'); sh.getRange('X1').setFormula('=SEQUENCE(2,2)');
      const d=wb.create('Sheet9',10,5); d.getRange('A1').setValue(5); wb.setActiveSheet(sh); sh.getRange('Z1').setValue(7); sh.getRange('Z2').setFormula('=SUM(Sheet1:Sheet9!A1)');
      await new Promise(x=>setTimeout(x,1800)); const g=(a)=>sh.getRange(a).getValue();
      return {seq:[g('R1'),g('R2'),g('R3')], sort:[g('T1'),g('T2'),g('T3')], blocked:[g('V1'),g('V2')], grid:[g('X1'),g('Y1'),g('X2'),g('Y2')], threeD:g('Z2')}""")
    rec(40, "spill range fills cells below (SEQUENCE, SORT)", r["seq"] == [1,2,3] and r["sort"] == [1,2,3], str(r))
    rec(40, "2-D spill (SEQUENCE(2,2))", r["grid"] == [1,2,3,4], str(r["grid"]))
    rec(40, "#SPILL! when spill range is blocked", r["blocked"] == ["#SPILL!", "x"], str(r["blocked"]))
    rec(42, "3D reference =SUM(Sheet1:Sheet9!A1) = 3 + 5", r["threeD"] == 8, str(r["threeD"]))
    b.close()

for v, n, ok, d in sorted(res, key=lambda r: r[0]): print(("PASS" if ok else "FAIL"), f"v{v:<3}", n, ("— " + d) if (d and not ok) else "")
bad = [r for r in res if not r[2]]
print(f"\n{len(res)-len(bad)}/{len(res)} passed; page errors: {errs}")
sys.exit(1 if bad else 0)
