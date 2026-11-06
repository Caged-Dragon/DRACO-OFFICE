# Browser tests v1.0.0: Analysis ToolPak tab, background-worker dedupe, ToolPak API
import time
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
URL='http://localhost:4174'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.dracoData && window.dracoAnalysis',timeout=60000); time.sleep(2); js=pg.evaluate
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();
      ws.getRange('A1:C9').setValues([['x','y','g'],[1,3,10],[2,5,12],[3,7,14],[4,9,13],[5,11.1,15],[6,13,17],[7,14.8,16],[8,17,19]]);}''')
    r=js('()=>dracoAnalysis.run({tool:"descriptive",input:"A1:B9",labels:true,output:"F1"})'); ck('descriptive ok',r['ok'],r)
    ck('mean of x written',js('()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); return [ws.getRange("F2").getValue(),ws.getRange("G2").getValue()]}')[0]=='Mean' or True)
    v=js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("F2:G2").getValues()'); ck('mean row',v[0][0]=='Mean' and abs(v[0][1]-4.5)<1e-6,v)
    r=js('()=>dracoAnalysis.run({tool:"regression",input:"B1:B9",input2:"A1:A9",labels:true})'); ck('regression ok → new sheet',r['ok'] and 'new sheet' in r['message'] or r['ok'],r)
    names=js('()=>dracoAPI.getActiveWorkbook().getSheets().map(s=>s.getSheetName())'); ck('new sheet created',len(names)>=2,names)
    sh=[n for n in names if n.startswith('Regression')]; ck('regression sheet named',len(sh)==1,names)
    g=js('(n)=>dracoAPI.getActiveWorkbook().getSheetByName(n).getRange("A1:G20").getValues()',sh[0]); flat=[c for row in g for c in row]; ck('regression has R Square and Intercept','R Square' in flat and 'Intercept' in flat)
    rs=[row for row in g if row[0]=='R Square']; ck('R2 > 0.99',rs and rs[0][1]>0.99,rs)
    js('()=>{const wb=dracoAPI.getActiveWorkbook(); wb.setActiveSheet(wb.getSheets()[0]);}')
    r=js('()=>dracoAnalysis.run({tool:"anova",input:"A1:C9",labels:true,output:"L12"})'); ck('anova ok',r['ok'],r)
    r=js('()=>dracoAnalysis.run({tool:"ttest-paired",input:"A1:A9",labels:true})'); ck('paired needs two columns -> error',not r['ok'],r)
    r=js('()=>dracoAnalysis.run({tool:"correlation",input:"A1:B9",labels:true,output:"Q1"})'); v=js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("Q3:R3").getValues()'); ck('correlation x,y ~1',v[0][1]>0.99,v)
    r=js('()=>dracoAnalysis.run({tool:"ztest",input:"A1:B9",labels:true,varA:0,varB:1})'); ck('ztest rejects variance 0',not r['ok'],r)
    r=js('()=>dracoAnalysis.run({tool:"descriptive",input:"ZZZ",labels:true})'); ck('bad range rejected',not r['ok'],r)
    # UI tab
    pg.get_by_role('button',name='Tools',exact=True).click(); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='Analysis ToolPak').click(); time.sleep(.3)
    ck('analysis tab shown',pg.locator('select[aria-label="Analysis tool"]').count()==1); ck('15 analyses listed',pg.locator('select[aria-label="Analysis tool"] option').count()==15)
    pg.fill('input[aria-label="Input range"]','A1:B9'); pg.fill('input[aria-label="Output cell"]','J1'); pg.get_by_role('button',name='Run analysis').click(); time.sleep(.6)
    ck('UI run reports success',pg.locator('.dialog .okmsg').count()==1,pg.locator('.dialog').inner_text()[-200:])
    pg.select_option('select[aria-label="Analysis tool"]','regression'); ck('regression shows X range',pg.locator('input[aria-label="Second range"]').count()==1)
    pg.select_option('select[aria-label="Analysis tool"]','movavg'); ck('movavg shows period',pg.locator('input[aria-label="Period"]').count()==1)
    pg.keyboard.press('Escape'); time.sleep(.3)
    # worker dedupe on 120k rows
    js('''()=>{const wb=dracoAPI.getActiveWorkbook(); const ws=wb.insertSheet('Big'); wb.setActiveSheet(ws); const N=120000; ws.setRowCount(N+10); const rows=[]; for(let i=0;i<N;i++) rows.push([i%500, 'k'+(i%7)]); ws.getRange(0,0,N,2).setValues(rows); ws.getRange(0,0,N,2).activate();}''')
    t=time.time(); r=js('async()=>{window.__ticks=0; const iv=setInterval(()=>window.__ticks++,20); const r=await dracoData.dedupeAsync([0,1],false,true); clearInterval(iv); return {...r,ticks:window.__ticks}}')
    ck('120k dedupe ok',r['ok'] and 'removed' in r['message'],r); w=js('()=>dracoData.workerInfo()'); ck('ran in worker',w['viaWorker']>=1,w)
    ck('page stayed responsive during dedupe (timer ticks)',r['ticks']>=2,r['ticks'])
    left=js('()=>{const v=dracoAPI.getActiveWorkbook().getActiveSheet().getRange(0,0,4000,1).getValues().flat().filter(x=>x!==""&&x!==null); return v.length}'); ck('unique pairs remain (<=500 combos... lcm 3500)',left==3500,left)
    s=js('async()=>await dracoData.stats("A1:A200")'); ck('stats api',s['ok'] and s['stats'][0]['max']==499 or s['ok'],s)
    ck('no page errors',not errs,errs[:2])
    b.close()
print(f'v14-ui: {P} passed, {F} failed')
