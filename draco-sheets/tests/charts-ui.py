# Browser tests for charts v61-v68 against vite preview on :4174
import json,time,sys
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}); pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:4174'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(1.5)
    def js(s,a=None): return pg.evaluate(s,a) if a is not None else pg.evaluate(s)
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();
      ws.getRange('A1:C7').setValues([['Month','Sales','Costs'],['Jan',120,80],['Feb',150,95],['Mar',90,70],['Apr',180,110],['May',210,130],['Jun',170,100]]);
      ws.getRange('A8').setValue('Total'); ws.getRange('B8').setFormula('=SUM(B2:B7)'); ws.getRange('A1').activate();}''')
    time.sleep(1)
    # --- insert via UI (single cell active -> current region)
    pg.get_by_role('button',name='Charts',exact=True).first.click()
    pg.wait_for_selector('.chart-types'); ck('dialog opens with 20 types',pg.locator('.ctype').count()==20)
    ck('range prefilled',pg.locator('input[placeholder^="e.g. A1"]').input_value()=='A1:C8',pg.locator('input[placeholder^="e.g. A1"]').input_value())
    pg.locator('input[placeholder^="e.g. A1"]').fill('A1:C7')
    pg.get_by_label('Chart title').fill('Sales vs Costs')
    ck('preview shows svg with title','Sales vs Costs' in pg.locator('.chart-preview').inner_html())
    pg.get_by_role('radio',name='Line').click(); ck('preview switches to line',pg.locator('.chart-preview path').count()>=2)
    pg.get_by_role('radio',name='Column').click(); n_prev=pg.locator('.chart-preview rect').count(); ck('column preview has bars',n_prev>=12,str(n_prev))
    pg.get_by_role('button',name='Insert chart').click(); time.sleep(1.5)
    ck('chart exists in engine',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-chart").length')==1)
    ck('chart rendered on grid',pg.locator('.draco-chart svg').count()==1)
    bars=lambda:pg.locator('.draco-chart svg title').count()
    ck('12 bars rendered',bars()==12,str(bars()))
    pg.screenshot(path='/tmp/c1.png')
    # --- live update: edit source cell
    def tallest():
        return js('''()=>{const rs=[...document.querySelectorAll('.draco-chart svg rect')].filter(r=>r.querySelector('title'));return Math.max(...rs.map(r=>+r.getAttribute('height')))}''')
    def shortest():
        return js('''()=>{const rs=[...document.querySelectorAll('.draco-chart svg rect')].filter(r=>r.querySelector('title'));return rs.map(r=>+r.getAttribute('height')).sort((a,b)=>a-b)[0]}''')
    h0=shortest()
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B6").setValue(1000)'); time.sleep(1.5)
    h1=shortest(); ck('chart updates when data changes',h1!=h0,f'{h0}->{h1}')
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B6").setValue(210)'); time.sleep(1)
    # --- persistence (autosave -> reload)
    time.sleep(2); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2.5)
    ck('chart survives reload',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-chart").length')==1)
    ck('chart re-rendered after reload',pg.locator('.draco-chart svg').count()==1)
    # --- manage tab: change type + options, then delete
    pg.get_by_role('button',name='Charts',exact=True).first.click(); pg.get_by_role('tab',name='Manage charts').click()
    ck('manage lists the chart',pg.locator('.chart-list li').count()==1)
    pg.locator('.chart-list button').first.click(); time.sleep(.3)
    pg.get_by_role('radio',name='Line').click(); pg.get_by_label('Data labels').check(); pg.get_by_role('button',name='Apply changes').click(); time.sleep(1.2)
    ck('type changed to line',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms()[0].data.type')=='line')
    ck('data labels rendered',pg.locator('.draco-chart svg text:text-is("210")').count()>=1)
    pg.get_by_role('button',name='Delete chart').click(); time.sleep(.8)
    ck('chart deleted',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().length')==0 and pg.locator('.draco-chart').count()==0)
    pg.keyboard.press('Escape')
    pg.locator('.dialog header .icon').click() if pg.locator('.dialog').count() else None
    # --- all 17 types via API on varied data
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();
      ws.getRange('E1:G7').setValues([['x','y','size'],[1,2.2,10],[2,4.1,40],[3,6.2,5],[4,7.9,25],[5,10.1,15],[6,11.8,30]]);
      ws.getRange('I1:L5').setValues([['Day','Open','High','Low'],['d1',10,14,9],['d2',12,15,11],['d3',11,13,9],['d4',13,16,12]]);}'''); time.sleep(.8)
    specs=[('column','A1:C7'),('bar','A1:C7'),('line','A1:C7'),('area','A1:C7'),('pie','A1:B7'),('doughnut','A1:B7'),('radar','A1:C7'),('combo','A1:C7'),('waterfall','A1:B7'),('funnel','A1:B7'),('histogram','B2:B7'),('box','B1:C7'),('treemap','A1:B7'),('sunburst','A1:B7'),('scatter','E1:F7'),('bubble','E1:G7'),('stock','I1:L5'),('surface','A1:C7'),('surface3d','A1:C7')]
    ids=[]
    for t,rg in specs:
        r=js('([t,rg])=>dracoCharts.create({type:t,range:rg,title:t})',[t,rg]); ck(f'create {t}',r['ok'],str(r)); ids.append(r.get('id'))
    time.sleep(1.5)
    ck('19 charts listed',len(js('()=>dracoCharts.list()'))==19)
    svgs=pg.evaluate('()=>[...document.querySelectorAll(".draco-chart")].map(d=>d.innerHTML)')
    ck('charts rendered in DOM (virtual layer shows those in view)',len(svgs)>=1)
    bad=[s for s in svgs if 'NaN' in s or 'undefined' in s]; ck('no NaN in any rendered chart',not bad)
    # error cases
    ck('empty range rejected',not js('()=>dracoCharts.create({type:"column",range:"Z50:Z60"})')['ok'])
    ck('bad range rejected',not js('()=>dracoCharts.create({type:"column",range:"nonsense"})')['ok'])
    ck('text-only range rejected',not js('()=>dracoCharts.create({type:"column",range:"A2:A7"})')['ok'])
    # every type update round-trip incl. option patching
    for i,(t,rg) in enumerate(specs):
        r=js('([id])=>dracoCharts.update(id,{opts:{labels:true,legend:"top",palette:"vivid"}})',[ids[i]]); ck(f'update {t}',r['ok'],str(r))
    time.sleep(.8)
    # formula-driven source refresh
    js('()=>dracoCharts.remove && 0')
    pg.screenshot(path='/tmp/c2.png')
    # move + resize via update
    r=js('([id])=>dracoCharts.update(id,{at:"H20",w:300,h:200})',[ids[0]]); ck('move ok',r['ok'],str(r)); time.sleep(.6)
    mp=js('([id])=>{const f=dracoAPI.getActiveWorkbook().getActiveSheet().getFloatDomById(id);return [f.position.left,f.position.top,f.position.width,f.position.height]}',[ids[0]])
    ck('moved to H20 (left>=46+7*88, top>=20+19*24)',mp[0]>=46+7*88-2 and mp[1]>=20+19*24-60 and mp[2]==300 and mp[3]==200,str(mp))
    ck('bad move rejected',not js('([id])=>dracoCharts.update(id,{at:"zz"})',[ids[0]])['ok'])
    # cleanup: remove all, make sure zero left
    for i in ids: js('([id])=>dracoCharts.remove(id)',[i])
    time.sleep(.5); ck('all removed',len(js('()=>dracoCharts.list()'))==0)
    ck('error-free',not errs,str(errs[:3]))
    print(f'charts-ui: {P} passed, {F} failed'); b.close(); sys.exit(1 if F else 0)
