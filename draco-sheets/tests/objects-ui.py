# Browser tests for sparklines, shapes, icons, diagrams, linked picture (v69-v72)
import time,sys
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':900}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:4174/app'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(1.5)
    def js(s,a=None): return pg.evaluate(s,a) if a is not None else pg.evaluate(s)
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();
      ws.getRange('A1:G4').setValues([['Item','Q1','Q2','Q3','Q4','Q5','Trend'],['A',3,5,2,8,6,null],['B',9,7,6,-4,3,null],['C',1,1,2,3,5,null]]);
      ws.getRange('A1:G1').setBackground('#DDEBF7'); ws.getRange('A1').activate();}''')
    time.sleep(.8)
    n=lambda sel:pg.locator(sel).count()
    # sparklines via UI
    pg.get_by_role('button',name='Objects',exact=True).first.click(); pg.wait_for_selector('.dialog')
    pg.locator('input[placeholder="e.g. B2:G6"]').fill('B2:F4'); pg.locator('input[placeholder="e.g. H2"]').fill('G2')
    ck('spark preview svg',n('.obj-preview svg')==1)
    pg.get_by_label('High point').check(); pg.get_by_label('Markers').check()
    pg.get_by_role('button',name='Insert sparklines').click(); time.sleep(1.5)
    ck('3 sparklines created',len(js('()=>dracoCharts.objects("draco-spark")'))==3,str(js('()=>dracoCharts.objects("draco-spark")')))
    ck('3 sparklines rendered',n('.draco-spark svg')==3,str(n('.draco-spark svg')))
    ck('sparkline has high-point circle',pg.locator('.draco-spark svg circle').count()>=3*6)
    # data change updates sparkline
    before=pg.locator('.draco-spark svg').first.inner_html()
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B2").setValue(99)'); time.sleep(1.5)
    ck('sparkline refreshes on data change',pg.locator('.draco-spark svg').first.inner_html()!=before)
    # style change
    r=js('()=>dracoCharts.sparkOpts("G3",{kind:"column"})'); time.sleep(.8); ck('sparkOpts ok',r['ok'],str(r)); ck('column sparkline has rects',pg.locator('.draco-spark svg rect').count()>=5)
    ck('bad location rejected',not js('()=>dracoCharts.sparkline({src:"B2:F4",loc:"zz",opts:{kind:"line"}})')['ok'])
    ck('too few location cells rejected',not js('()=>dracoCharts.sparkline({src:"B2:F4",loc:"G2:G3",opts:{kind:"line"}})')['ok'])
    r=js('()=>dracoCharts.sparkClear("sheet")'); time.sleep(.5); ck('clear sparklines',len(js('()=>dracoCharts.objects("draco-spark")'))==0 and n('.draco-spark')==0,str(r))
    # shapes: UI
    pg.get_by_role('tab',name='Shapes & text').click(); pg.get_by_role('radio',name='Oval').click(); pg.locator('textarea').first.fill('Hello Draco'); ck('shape preview text','Hello Draco' in pg.locator('.obj-preview').inner_html())
    pg.get_by_role('button',name='Insert shape').click(); time.sleep(1)
    ck('shape rendered',n('.draco-shape svg ellipse')==1)
    # icon via UI
    pg.get_by_role('tab',name='Icons').click(); pg.get_by_role('radio',name='heart').click(); pg.get_by_role('button',name='Insert icon').click(); time.sleep(1)
    ck('icon rendered',n('.draco-shape svg path')>=1)
    # diagram via UI
    pg.get_by_role('tab',name='Diagrams').click(); pg.get_by_role('radio',name='Cycle').click(); ck('diagram preview','Plan' in pg.locator('.obj-preview').inner_html())
    pg.get_by_role('button',name='Insert diagram').click(); time.sleep(1); ck('diagram rendered',n('.draco-diagram svg circle')==4)
    ck('empty diagram rejected',not js('()=>dracoCharts.diagram({kind:"list",text:"  "})')['ok'])
    # camera via UI
    pg.get_by_role('tab',name='Linked picture').click(); pg.locator('input[placeholder="e.g. A1:D8"]').fill('A1:C4'); pg.get_by_role('button',name='Insert linked picture').click(); time.sleep(1.2)
    ck('camera rendered',n('.draco-camera svg')==1)
    ck('camera shows header bg',pg.locator('.draco-camera svg').first.inner_html().count('#DDEBF7')>=1 or '#ddebf7' in pg.locator('.draco-camera svg').first.inner_html().lower())
    cam_before=pg.locator('.draco-camera svg').first.inner_html()
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B2").setValue(12345)'); time.sleep(1.5)
    ck('camera is live',pg.locator('.draco-camera svg').first.inner_html()!=cam_before and '12345' in pg.locator('.draco-camera svg').first.inner_html())
    ck('bad camera range rejected',not js('()=>dracoCharts.camera("nonsense")')['ok'])
    pg.screenshot(path='/tmp/o1.png')
    # manage
    pg.get_by_role('tab',name='Manage').click(); ck('manage lists 4',pg.locator('.chart-list li').count()==4,str(pg.locator('.chart-list li').count()))
    pg.locator('.chart-list button',has_text='ellipse').first.click(); pg.locator('textarea').fill('Renamed'); pg.get_by_role('button',name='Apply').click(); time.sleep(1)
    ck('shape text updated',any('Renamed' in h for h in pg.locator('.draco-shape').evaluate_all('els=>els.map(e=>e.innerHTML)')))
    # persistence
    n_obj=len(js('()=>dracoCharts.objects("draco-shape","draco-diagram","draco-camera","draco-spark")')); time.sleep(2.5)
    pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(3)
    objs=js('()=>dracoCharts.objects("draco-shape","draco-diagram","draco-camera","draco-spark")'); ck('all objects survive reload',len(objs)==n_obj==4,f'{n_obj} -> {len(objs)}')
    ck('persisted shape text kept',any('Renamed' in h for h in pg.locator('.draco-shape').evaluate_all('els=>els.map(e=>e.innerHTML)')))
    # remove one
    for o in objs: js('([id])=>dracoCharts.removeObject(id)',[o['id']])
    time.sleep(.5); ck('removed all',len(js('()=>dracoCharts.objects("draco-shape","draco-diagram","draco-camera")'))==0)
    ck('no page errors',not errs,str(errs[:3]))
    print(f'objects-ui: {P} passed, {F} failed'); b.close(); sys.exit(1 if F else 0)
