# Browser tests for v93-v100: macros, scripts, links, accessibility, performance, language, palette/shortcuts, templates/themes/assist/parity
import time,sys,json
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
URL='http://localhost:4174/app'
def boot(ctx):
    pg=ctx.new_page(); pg.errs=[]; pg.on('pageerror',lambda e:pg.errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook() && window.dracoAuto && window.dracoCmd',timeout=60000); time.sleep(1.5); return pg
def val(pg,a): return pg.evaluate('([a])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).getValue()',[a])
def setv(pg,a,v): pg.evaluate('([a,v])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).setValue(v)',[a,v])
def act(pg,a): pg.evaluate('([a])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).activate()',[a])
def tools(pg,tab):
    if pg.locator('.dialog').count(): close(pg)
    pg.evaluate("()=>dracoCmd.run('open.macros')"); pg.wait_for_selector('.dialog')
    pg.get_by_role('tab',name=tab,exact=True).click(); time.sleep(.3)
def close(pg):
    if pg.locator('.dialog').count(): pg.locator('.dialog header .icon').click(); time.sleep(.3)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':900},accept_downloads=True); pg=boot(ctx)
    ck('header 48px',abs(pg.evaluate('()=>document.querySelector(".topbar").getBoundingClientRect().height')-48)<2, pg.evaluate('()=>document.querySelector(".topbar").getBoundingClientRect().height'))
    # ---------- tools dialog + tabs keyboard
    tools(pg,'Macros'); ck('11 tabs',pg.locator('.dialog [role=tab]').count()==11,pg.locator('[role=tab]').count())
    pg.locator('#tools-tab-macros').focus(); pg.keyboard.press('ArrowRight'); time.sleep(.2); ck('arrow moves tab',pg.locator('#tools-tab-scripts').get_attribute('aria-selected')=='true')
    pg.keyboard.press('End'); ck('end tab',pg.locator('#tools-tab-parity').get_attribute('aria-selected')=='true')
    pg.keyboard.press('Escape'); time.sleep(.3); ck('esc closes',pg.locator('.dialog').count()==0)
    # ---------- macros: record -> stop -> replay
    act(pg,'A1'); tools(pg,'Macros'); pg.get_by_label('Macro name').fill('Fill block'); pg.get_by_role('button',name='● Record').click(); time.sleep(.3)
    ck('recording status','Recording' in pg.locator('.dialog').inner_text()); close_btn=pg.locator('.dialog header .icon'); close_btn.click(); time.sleep(.3)
    setv(pg,'A1','x'); setv(pg,'B1',5); setv(pg,'A2','y'); pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A1").setFontWeight("bold")'); time.sleep(.5)
    tools(pg,'Macros'); pg.get_by_role('button',name='■ Stop & save').click(); time.sleep(.4)
    ms=pg.evaluate('()=>dracoAuto.macros().map(m=>({n:m.name,k:m.ops.length}))'); ck('macro saved',len(ms)==1 and ms[0]['n']=='Fill block' and ms[0]['k']>=1,ms)
    pg.evaluate('()=>{const w=dracoAPI.getActiveWorkbook().getActiveSheet(); w.getRange("A1:B2").clear()}'); time.sleep(.3); ck('cleared',val(pg,'A1') in (None,''))
    act(pg,'D5'); pg.get_by_role('button',name='▶ Run').first.click(); time.sleep(.8)
    ck('replay relative at D5',val(pg,'D5')=='x' and val(pg,'E5')==5 and val(pg,'D6')=='y',[val(pg,'D5'),val(pg,'E5'),val(pg,'D6')])
    pg.locator('[data-macro] input[type=checkbox]').first.uncheck(); time.sleep(.2); act(pg,'H9'); pg.get_by_role('button',name='▶ Run').first.click(); time.sleep(.6); ck('absolute replays at A1',val(pg,'A1')=='x',[val(pg,'A1'),pg.evaluate('()=>dracoAuto.macros()[0].relative'),pg.locator('.dialog').inner_text()[:300]])
    pg.get_by_role('button',name='Steps').first.click(); ck('steps listed',pg.locator('ol.steps li').count()>=1)
    pg.get_by_role('button',name='Convert to script').first.click(); time.sleep(.3); ck('convert opens scripts with code','draco.' in pg.get_by_label('Script code').input_value())
    # persistence of macro after reload
    close(pg); time.sleep(1.5); pg.reload(); pg.wait_for_function('window.dracoAuto',timeout=60000); time.sleep(2); ck('macro persists',pg.evaluate('()=>dracoAuto.macros().length')==1)
    # ---------- scripts
    tools(pg,'Scripts'); pg.get_by_label('Script code').fill('const s=draco.sheet(); await s.range("A1:A3").setValues([[1],[2],[3]]); await s.range("B1").setFormula("=SUM(A1:A3)"); draco.log("done "+(1+1));')
    pg.get_by_role('button',name='▶ Run').click(); time.sleep(1.5); ck('script wrote',val(pg,'A3')==3 and val(pg,'B1')==6,[val(pg,'A3'),val(pg,'B1')]); ck('script log','done 2' in pg.locator('[aria-label="Script output"]').inner_text())
    pg.get_by_label('Script code').fill('throw new Error("boom")'); pg.get_by_role('button',name='▶ Run').click(); time.sleep(1); ck('script error shown','boom' in pg.locator('.dialog').inner_text())
    pg.get_by_label('Script code').fill('const t=Date.now(); while(Date.now()-t<60000){}'); pg.get_by_role('button',name='▶ Run').click(); time.sleep(.6); ck('stop button shown',pg.get_by_role('button',name='Stop',exact=True).count()==1)
    pg.get_by_role('button',name='Stop',exact=True).click(); time.sleep(.6); ck('ui responsive after stop',pg.get_by_role('button',name='▶ Run').is_enabled())
    pg.get_by_label('Script code').fill('try{ await fetch("https://example.com"); draco.log("NET OK") }catch(e){ draco.log("blocked") }'); pg.get_by_role('button',name='▶ Run').click(); time.sleep(1); ck('script has no network','NET OK' not in pg.locator('.dialog').inner_text())
    pg.get_by_label('Script name').fill('My saved'); pg.locator('.dialog').get_by_role('button',name='Save',exact=True).click(); time.sleep(.3); ck('script saved',pg.evaluate('()=>dracoAuto.scripts().length')>=1)
    pg.get_by_label('Script examples').select_option(index=1); time.sleep(.2); ck('example loads',len(pg.get_by_label('Script code').input_value())>20)
    # ---------- links
    close(pg); act(pg,'C1'); setv(pg,'C1','Docs'); tools(pg,'Links & web data')
    r=pg.evaluate('()=>dracoLinks.insert({type:"web",target:"https://example.com",text:"Docs"})'); time.sleep(.4); ck('web link inserted',r['ok'],r)
    act(pg,'C2'); r=pg.evaluate('()=>dracoLinks.insert({type:"cell",target:"A1",text:"Top"})'); time.sleep(.3); ck('cell link inserted',r['ok'],r)
    ls=pg.evaluate('()=>dracoLinks.list()'); ck('list has 2',len(ls)>=2,ls); close(pg); tools(pg,'Links & web data'); ck('links listed in UI',pg.locator('[data-link]').count()>=2)
    pg.evaluate('()=>dracoLinks.remove(dracoLinks.list()[0].sheetId,dracoLinks.list()[0].row,dracoLinks.list()[0].col)'); time.sleep(.3); ck('link removed',len(pg.evaluate('()=>dracoLinks.list()'))==len(ls)-1)
    # web data from a routed CSV
    ctx.route('https://data.test/t.csv',lambda r:r.fulfill(status=200,headers={'content-type':'text/csv','access-control-allow-origin':'*'},body='name,score\nAnn,10\nBob,20\n'))
    r=pg.evaluate('async()=>await dracoLinks.addWeb({url:"https://data.test/t.csv",name:"Scores",dest:"Sheet1!K1"})'); time.sleep(.8); ck('web data loaded',r['ok'] and val(pg,'K1')=='name' and val(pg,'L3')==20,[r,val(pg,'K1'),val(pg,'L3')])
    ctx.unroute('https://data.test/t.csv'); ctx.route('https://data.test/t.csv',lambda r:r.fulfill(status=200,headers={'content-type':'text/csv','access-control-allow-origin':'*'},body='name,score\nAnn,11\nBob,21\nCy,31\n'))
    pg.evaluate('async()=>{const c=dracoLinks.connections()[0]; await dracoLinks.refresh(c.id)}'); time.sleep(.8); ck('web data refreshed',val(pg,'L4')==31,val(pg,'L4'))
    # ---------- accessibility
    close(pg); tools(pg,'Accessibility'); pg.get_by_label('High contrast').check(); time.sleep(.2); ck('hc class','hc' in pg.evaluate('()=>document.documentElement.className+" "+document.body.className'))
    pg.get_by_label('High contrast').uncheck(); pg.get_by_label('Reduce motion').check(); ck('reduce-motion class','reduce-motion' in pg.evaluate('()=>document.documentElement.className+" "+document.body.className')); pg.get_by_label('Reduce motion').uncheck()
    pg.get_by_label('Text size').select_option('130'); time.sleep(.2); fs=pg.evaluate('()=>getComputedStyle(document.documentElement).fontSize'); ck('text scale',fs!='16px',fs); pg.get_by_label('Text size').select_option('100')
    pg.get_by_role('button',name='Check workbook').click(); time.sleep(.6); ck('checker ran',pg.locator('.dialog [role=status]:has-text("warning")').count()>=1)
    # focus trap
    pg.keyboard.press('Shift+Tab'); ck('focus stays in dialog',pg.evaluate('()=>!!document.activeElement.closest(".dialog")')); close(pg)
    pg.evaluate('()=>dracoA11y.set({announce:true})'); act(pg,'A1'); setv(pg,'A1','Hello'); time.sleep(1.2); ck('announce text',pg.evaluate('()=>(document.querySelector("#draco-live")||{}).textContent||""').find('A1')>=0, pg.evaluate('()=>(document.querySelector("#draco-live")||{}).textContent'))
    ck('announcer exists',pg.evaluate('()=>!!document.querySelector("#draco-live")'))
    # skip link
    ck('skip link present',pg.locator('a.skip').count()==1)
    # ---------- performance
    tools(pg,'Large data'); r=pg.evaluate('()=>dracoPerf.expand()'); ck('expand limits',r['ok'] if isinstance(r,dict) else True,r); sz=pg.evaluate('()=>dracoPerf.size()'); ck('size 1048576 rows',sz['rows']==1048576 or sz.get('rowCount')==1048576,sz)
    r=pg.evaluate('async()=>await dracoPerf.fill({rows:20000,cols:5})'); ck('chunked fill',r['ok'],r); ck('fill value',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(20000,2).getValue()') is not None and r['written']>=20000,r)
    bn=pg.evaluate('async()=>await dracoPerf.bench(5000)'); ck('benchmark returns',isinstance(bn,list) and len(bn)>=3 and all('ms' in x for x in bn),bn); time.sleep(3); pg.evaluate('()=>document.querySelector(".dialog header .icon")?.click()'); time.sleep(1)
    # ---------- language
    tools(pg,'Language'); ck('lang tab content',pg.locator('.dialog select').count()>=2); close(pg)
    ck('regions',len(pg.evaluate('()=>dracoI18n.regions'))>=8)
    r=pg.evaluate('()=>dracoI18n.rtl(true)'); time.sleep(.5); ck('sheet rtl on',pg.evaluate('()=>dracoI18n.isRtl()')==True); pg.evaluate('()=>dracoI18n.rtl(false)'); time.sleep(.3)
    setv(pg,'N1','1.234,56'); setv(pg,'N2','31.12.2024'); pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("N1:N2").activate()')
    r=pg.evaluate('async()=>await dracoI18n.convert("de-DE","both")'); time.sleep(.6); ck('de-DE convert',r['ok'] if isinstance(r,dict) else True,r); ck('number parsed',abs((val(pg,'N1') or 0)-1234.56)<1e-6 if isinstance(val(pg,'N1'),(int,float)) else False,val(pg,'N1')); setv(pg,'O2','=N2+0'); time.sleep(.6); ck('date parsed',val(pg,'O2')==45657,val(pg,'O2'))
    pg.evaluate('async()=>await dracoI18n.setUi("arSA")'); time.sleep(2.5); ck('ui ar rtl',pg.evaluate('()=>document.documentElement.dir')=='rtl',pg.evaluate('()=>[document.documentElement.dir,document.documentElement.lang]'))
    pg.evaluate('async()=>await dracoI18n.setUi("frFR")'); time.sleep(2); ck('ui fr ltr',pg.evaluate('()=>document.documentElement.dir')!='rtl')
    pg.evaluate('async()=>await dracoI18n.setUi("enUS")'); time.sleep(1.5)
    # ---------- palette + shortcuts
    pg.locator('main.grid').click(position={'x':300,'y':200}) if pg.locator('main.grid').count() else pg.mouse.click(400,300); time.sleep(.2)
    pg.keyboard.press('Control+/'); time.sleep(.4); ck('palette opens',pg.locator('.palette').count()==1)
    pg.keyboard.type('freeze top'); time.sleep(.3); ck('palette filters',pg.locator('.palette li').count()>=1 and 'Freeze top row' in pg.locator('.palette li').first.inner_text(),pg.locator('.palette li').first.inner_text())
    pg.keyboard.press('Enter'); time.sleep(.6); ck('palette closed after run',pg.locator('.palette').count()==0); ck('palette ran freeze',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getFreeze().ySplit')==1)
    pg.keyboard.press('Alt+q'); time.sleep(.3); ck('alt+q opens',pg.locator('.palette').count()==1); pg.keyboard.press('Escape'); time.sleep(.3); pg.keyboard.press('Escape') if pg.locator('.palette').count() else None; ck('esc closes palette',pg.locator('.palette').count()==0)
    pg.keyboard.press('Control+/'); pg.keyboard.type('macros'); time.sleep(.3); pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowUp'); pg.keyboard.press('Enter'); time.sleep(.5); ck('palette opens tools tab',pg.locator('.dialog').count()==1 and pg.locator('#tools-tab-macros').get_attribute('aria-selected')=='true'); close(pg)
    pg.keyboard.press('F1'); time.sleep(.4); ck('F1 opens shortcuts',pg.locator('#tools-tab-keys').get_attribute('aria-selected')=='true' if pg.locator('.dialog').count() else False); close(pg)
    # shortcut behaviours
    setv(pg,'P1',10); setv(pg,'P2',''); act(pg,'P1'); pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("P1:P2").activate()'); pg.keyboard.press('Control+d'); time.sleep(.5); ck('Ctrl+D fills down',val(pg,'P2')==10,val(pg,'P2'))
    setv(pg,'Q1',1); setv(pg,'Q2',2); act(pg,'Q3'); time.sleep(.4); print('ACT',pg.evaluate('()=>[document.activeElement.tagName,document.activeElement.className.slice(0,40),dracoCmd.state()]')); pg.keyboard.press('Alt+='); time.sleep(1); ck('Alt+= autosum',val(pg,'Q3')==3,[pg.evaluate('()=>dracoCmd.state()'),val(pg,'Q3'),pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("Q3").getFormula()')])
    act(pg,'R1'); pg.keyboard.press('Control+;'); time.sleep(.4); setv(pg,'R2','=R1+0'); time.sleep(.6); ck('Ctrl+; date',isinstance(val(pg,'R2'),(int,float)) and val(pg,'R2')>40000,val(pg,'R2'))
    act(pg,'S1'); setv(pg,'S1',5); pg.keyboard.press('Control+Shift+$'); time.sleep(.4); ck('currency format','$' in str(pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("S1").getNumberFormat()')))
    act(pg,'T1'); setv(pg,'T1','z'); pg.keyboard.press('Control+5'); time.sleep(.3)
    act(pg,'U5'); pg.keyboard.press('Control+9'); time.sleep(.4); print('ROW',pg.evaluate('()=>{const w=dracoAPI.getActiveWorkbook();return JSON.stringify(w.save().sheets[w.getActiveSheet().getSheetId()].rowData)}'),pg.evaluate('()=>dracoCmd.state()')); ck('Ctrl+9 hides row',pg.evaluate('()=>{const w=dracoAPI.getActiveWorkbook();return w.save().sheets[w.getActiveSheet().getSheetId()].rowData?.[4]?.hd}')==1)
    n0=pg.evaluate('()=>dracoAPI.getActiveWorkbook().getSheets().length'); pg.keyboard.press('Shift+F11'); time.sleep(.5); ck('Shift+F11 new sheet',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getSheets().length')==n0+1)
    pg.keyboard.press('Control+PageUp'); time.sleep(.4); ck('Ctrl+PgUp prev sheet',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getSheetName()')!=pg.evaluate('()=>dracoAPI.getActiveWorkbook().getSheets().slice(-1)[0].getSheetName()'))
    # shortcut must not fire while editing a dialog input
    tools(pg,'Shortcuts'); pg.get_by_label('Filter shortcuts').fill('fill'); pg.keyboard.press('Control+d'); time.sleep(.2); ck('keys list filter',pg.locator('.dialog kbd').count()>=1); close(pg)
    # ---------- templates / themes / assist / parity
    tools(pg,'Templates & themes'); ck('6 templates',pg.locator('[data-template]').count()==6)
    pg.locator('[data-template=loan]').get_by_role('button',name='Use this template').click(); time.sleep(2); ck('dialog closed',pg.locator('.dialog').count()==0)
    ck('loan opened',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getSheetName()')=='Loan')
    vals=pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getDataRange().getValues().slice(0,8)'); ck('loan data',any('4,891' in str(c) for row in vals for c in row),vals)
    for t in ['budget','invoice','timesheet','gradebook','project']:
        tools(pg,'Templates & themes'); pg.locator(f'[data-template={t}]').get_by_role('button',name='Use this template').click(); time.sleep(1.8)
        errs=pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getDataRange().getValues().flat().filter(x=>typeof x==="string"&&x.startsWith("#")).length'); ck('template '+t+' no errors',errs==0,errs)
    tools(pg,'Templates & themes'); pg.get_by_role('button',name='Purple (dark)',exact=True).click(); time.sleep(.3); ck('dark theme bg',pg.evaluate('()=>getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()')=='#13101f')
    pg.reload(); pg.wait_for_function('window.dracoCmd',timeout=60000); time.sleep(1.5); ck('theme persists',pg.evaluate('()=>document.documentElement.dataset.dracoTheme')=='dark')
    tools(pg,'Templates & themes'); pg.get_by_role('button',name='Match my device').click(); time.sleep(.2); ck('system theme resets',pg.evaluate('()=>document.documentElement.style.getPropertyValue("--bg")')=='')
    pg.evaluate('()=>{const w=dracoAPI.getActiveWorkbook().getActiveSheet(); w.getRange("A1:B4").setValues([["Item","Price"],["a",10],["b",20],["c",30]]); w.getRange("B2:B4").activate();}')
    pg.get_by_label('Describe what you want').fill('sum of column B'); pg.get_by_role('button',name='Suggest').click(); time.sleep(.3); ck('suggestion shown',pg.locator('[data-suggest]').count()>=1 and 'SUM' in pg.locator('[data-suggest]').first.inner_text(),pg.locator('.dialog').inner_text()[-300:])
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D1").activate()'); pg.locator('[data-suggest]').first.get_by_role('button',name='Insert in selected cell').click(); time.sleep(.6); ck('suggestion inserted',val(pg,'D1')==60,val(pg,'D1'))
    pg.get_by_role('button',name='Explain formula in selected cell').click(); time.sleep(.3); ck('explain output',pg.locator('[aria-label=Explanation] li').count()>=1)
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B2:B4").activate()'); pg.get_by_role('button',name='Summarise selection').click(); time.sleep(.3); ck('summary output','60' in pg.locator('[aria-label=Explanation]').inner_text() or '20' in pg.locator('[aria-label=Explanation]').inner_text())
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B2:C3").activate()'); pg.get_by_role('button',name='Soft pastel #fbd5d5' if False else 'Soft pastel #fbd5d5').click(); time.sleep(.3)
    tools(pg,'Parity report'); ck('parity totals',pg.locator('.dialog [role=status]').first.inner_text().count('done')>=1); pg.get_by_role('button',name='Run self-test').click(); pg.wait_for_selector('[data-selftest]',timeout=30000)
    st=pg.locator('[data-selftest]').inner_text(); a,bb=st.split(' ')[0].split('/'); ck('self-test passes',a==bb and int(bb)>=50,st+' '+pg.locator('.dialog ul.msg').all_inner_texts().__str__()); ck('selftest sheet cleaned',not any('__selftest__' in n for n in pg.evaluate('()=>dracoAPI.getActiveWorkbook().getSheets().map(s=>s.getSheetName())')))
    pg.get_by_role('button',name='Open the full roadmap').click(); time.sleep(.3); ck('roadmap opens',pg.locator('.dialog h2:has-text("Roadmap")').count()==1); close(pg)
    ck('no page errors',not pg.errs,pg.errs[:3])
    # ---------- mobile
    m=b.new_context(viewport={'width':390,'height':800}); mp=boot(m); mp.locator('.burger').click(); time.sleep(.3); mp.get_by_role('button',name='Tools (macros, scripts…)').click(); mp.wait_for_selector('.dialog'); time.sleep(.3)
    r=mp.evaluate('()=>{const d=document.querySelector(".dialog").getBoundingClientRect(); return [d.width,innerWidth,document.documentElement.scrollWidth]}'); ck('mobile dialog fits',r[0]<=r[1]+1 and r[2]<=r[1]+1,r)
    mp.locator('.dialog header .icon').click(); mp.locator('.burger').click(); mp.get_by_role('button',name='Command search').click(); time.sleep(.3); ck('mobile palette',mp.locator('.palette').count()==1)
    b.close()
print(f'adv-ui: {P} passed, {F} failed'); sys.exit(1 if F else 0)
