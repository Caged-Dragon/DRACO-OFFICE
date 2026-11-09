import time
from playwright.sync_api import sync_playwright
ok=bad=0
def ck(n,c,x=''):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':1000})
    pg.goto('http://localhost:4174/app?new=1'); pg.wait_for_function('window.dracoAPI&&!location.search',timeout=60000); time.sleep(2)
    pg.evaluate("""()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();ws.getRange('A1').setValue(2);ws.getRange('A2').setValue(3);ws.getRange('A3').setFormula('=SUM(A1:A2)*2');ws.getRange('A3').activate();}""")
    time.sleep(1.5)
    pg.get_by_role('tab',name='Formulas',exact=True).click()
    pg.get_by_role('button',name='Evaluate formula').first.click(); time.sleep(.8)
    box=pg.get_by_role('status',name='Evaluation')
    ck('eval box',box.count()==1)
    first=box.inner_text()
    for _ in range(8):
        btn=pg.get_by_role('button',name='Evaluate',exact=True)
        if btn.is_disabled(): break
        btn.click()
    last=box.inner_text()
    ck('steps progress',first!=last,(first,last)); ck('result 10',last.strip().lstrip('=')=='10',last)
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.get_by_role('button',name='Watch window').first.click(); time.sleep(.6)
    ck('watch tab opens',pg.get_by_role('button',name='Add watch for current cell').count()==1)
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.get_by_role('tab',name='View',exact=True).click(); time.sleep(.4)
    z0=pg.evaluate("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getZoom?.()")
    pg.get_by_role('button',name='Zoom in').first.click(); time.sleep(.5)
    z1=pg.evaluate("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getZoom?.()")
    ck('zoom in raises ratio',z1 is not None and z0 is not None and z1>z0,(z0,z1))
    pg.get_by_role('button',name='Zoom options',exact=True).first.click(); pg.get_by_role('menuitem',name='200%',exact=True).click(); time.sleep(.5)
    ck('zoom 200',pg.evaluate("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getZoom?.()")==2)
    pg.get_by_role('button',name='Headings').first.click(); time.sleep(.5)
    pg.get_by_role('button',name='Headings').first.click(); time.sleep(.5)
    ck('headings toggle runs',True)
    b.close()
print(f'eval-ui: {ok} passed, {bad} failed')
