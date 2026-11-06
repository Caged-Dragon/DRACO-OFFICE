# Browser tests v1.1.0: spill references (A1#), trace arrows on the grid
import time
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:4174'); pg.wait_for_function('window.dracoTrace',timeout=60000); time.sleep(2); js=pg.evaluate
    # spill ref
    js("""()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('A1').setFormula('=SEQUENCE(4)'); ws.getRange('C1').setFormula('=SUM(A1#)'); ws.getRange('C2').setFormula('=ROWS(A1#)'); ws.getRange('C3').setFormula('=SUM(E1#)');
      ws.getRange('E1:G2').setValues([[1,2,3],[4,5,6]]); ws.getRange('C4').setFormula('=COLUMNS(E1#)'); }""")
    for a in ('C1','C2','C3','C4'): js("(a)=>dracoTrace.fixSpill('Sheet1',+a.slice(1)-1,2)",a)
    time.sleep(3.5)
    v=js("()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); return ['C1','C2','C3','C4'].map(a=>String(ws.getRange(a).getValue()))}")
    ck('SUM(A1#) = 10 (SEQUENCE(4))',v[0]=='10',v); ck('ROWS(A1#) = 4',v[1]=='4',v); ck('SUM(E1#) 2-D block = 21',v[2]=='21',v); ck('COLUMNS(E1#) = 3',v[3]=='3',v)
    f=js("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('C1').getFormula()"); ck('formula rewritten to OFFSET',f.startswith('=SUM(OFFSET(A1') if hasattr(f,'startswith') else False,f)
    # grow the spill: dynamic
    js("()=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A1').setFormula('=SEQUENCE(6)')}"); time.sleep(3)
    ck('spill ref is dynamic (SEQUENCE(6) -> 21)',js("()=>String(dracoAPI.getActiveWorkbook().getActiveSheet().getRange('C1').getValue())")=='21')
    # arrows
    js("""()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('J1:J3').setValues([[1],[2],[3]]); ws.getRange('L5').setFormula('=SUM(J1:J3)+J1'); ws.getRange('L7').setFormula('=L5*2'); ws.getRange('L5').activate();}""")
    time.sleep(1.5)
    r=js("()=>dracoTrace.trace('precedents',false)"); ck('trace precedents draws',r['ok'] and r['drawn']==2,r); time.sleep(.8)
    ck('arrow overlay present',pg.locator('svg[aria-label="Formula trace arrows"]').count()==1)
    ck('overlay has arrowheads',pg.locator('svg[aria-label="Formula trace arrows"] line[marker-end]').count()==2)
    ck('range box drawn for J1:J3',pg.locator('svg[aria-label="Formula trace arrows"] rect[stroke-dasharray]').count()==1)
    r=js("()=>dracoTrace.trace('dependents',true)"); time.sleep(.8); ck('dependents replaces arrows',r['ok'] and r['drawn']==1 and pg.locator('svg[aria-label="Formula trace arrows"]').count()==1,r)
    ck('overlay never blocks clicks',pg.locator('svg[aria-label="Formula trace arrows"]').first.evaluate("e=>getComputedStyle(e).pointerEvents")=='none')
    n=js("()=>dracoTrace.clear()"); time.sleep(.5); ck('remove arrows',pg.locator('svg[aria-label="Formula trace arrows"]').count()==0)
    js("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('N20').activate()"); time.sleep(.5)
    r=js("()=>dracoTrace.trace('precedents',false)"); ck('plain cell: friendly message',r['ok'] and r['drawn']==0 and 'no precedents' in r['message'],r)
    # dialog buttons
    pg.get_by_role('button',name='Formulas',exact=True).click(); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='Auditing').click(); time.sleep(.3)
    ck('dialog has Draw arrows + Remove arrows',pg.get_by_role('button',name='Draw arrows on sheet').count()==1 and pg.get_by_role('button',name='Remove arrows').count()==1)
    pg.keyboard.press('Escape'); time.sleep(.3)
    js("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('L5').activate()"); time.sleep(.4)
    pg.get_by_role('button',name='Formulas',exact=True).click(); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='Auditing').click(); time.sleep(.3)
    pg.get_by_role('button',name='Draw arrows on sheet').click(); time.sleep(.8); ck('dialog draws arrows + status text','arrow' in pg.locator('.dialog [role=status]').inner_text(),pg.locator('.dialog').inner_text()[-150:])
    pg.keyboard.press('Escape'); time.sleep(.5); ck('arrows stay after closing dialog',pg.locator('svg[aria-label="Formula trace arrows"]').count()==1)
    # circle invalid data
    js("""()=>{const wb=dracoAPI.getActiveWorkbook(); const ws=wb.getActiveSheet(); ws.getRange('P1:P5').setValues([[5],[50],[7],[500],[3]]);
      const rule=dracoAPI.newDataValidation().requireNumberBetween(1,10).setAllowInvalid(true).build(); ws.getRange('P1:P5').setDataValidation(rule);}""")
    time.sleep(1.5)
    r=js("async()=>await dracoTrace.circleInvalid()"); ck('circle invalid finds P2,P4',r['ok'] and sorted(r['cells'])==['P2','P4'],r); time.sleep(.6)
    ck('two red ellipses drawn',pg.locator('svg[aria-label="Formula trace arrows"] ellipse').count()==2)
    js("()=>dracoTrace.clearCircles()"); time.sleep(.4); ck('circles cleared',pg.locator('svg[aria-label="Formula trace arrows"] ellipse').count()==0)
    js("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('P2').setValue(4)"); time.sleep(1)
    r=js("async()=>await dracoTrace.circleInvalid()"); ck('after fixing P2 only P4 left',r['cells']==['P4'],r); js("()=>dracoTrace.clearCircles()")
    js("()=>{const wb=dracoAPI.getActiveWorkbook(); wb.setActiveSheet(wb.insertSheet('NoRules'))}"); time.sleep(.5)
    r=js("async()=>await dracoTrace.circleInvalid()"); ck('sheet without rules: clear message','no data-validation' in r['message'],r)
    pg.get_by_role('button',name='Formulas',exact=True).click(); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='Error checking').click(); time.sleep(.3)
    ck('Error checking tab has Circle invalid data',pg.get_by_role('button',name='Circle invalid data').count()==1); pg.keyboard.press('Escape')
    ck('no page errors',not errs,errs[:2]); b.close()
print(f'v18-ui: {P} passed, {F} failed')
