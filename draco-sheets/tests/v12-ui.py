# Browser tests v0.12.0: huge-range safety (no stack overflow), chunked writes, Draco screens in other languages
import time,sys
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
URL='http://localhost:4174/app'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.dracoData && window.dracoPerf && window.dracoI18n',timeout=60000); time.sleep(2)
    js=pg.evaluate; T0=time.time(); tick=lambda m: print(m,round(time.time()-T0,1),flush=True)
    # ---- shell translations
    def top(): return pg.evaluate('()=>[...document.querySelectorAll(".topbar .actions button")].map(b=>b.textContent.trim())')
    h0=js('()=>document.querySelector(".topbar").getBoundingClientRect().height'); ck('header 48px (English)',abs(h0-48)<2,h0)
    r=js('async()=>await dracoI18n.setUi("hiIN")'); ck('hi switch ok',r['ok'],r); time.sleep(1)
    t=top(); ck('hi top bar',('नया' in t) and ('टूल्स' in t) and ('सहेजें' in t),t)
    ck('hi status text',js('()=>document.querySelector(".topbar .status").textContent').find('सहेज')>=0,js('()=>document.querySelector(".topbar .status").textContent'))
    ck('hi lang attr',js('()=>document.documentElement.lang')=='hi')
    ck('header 48px (Hindi)',abs(js('()=>document.querySelector(".topbar").getBoundingClientRect().height')-48)<2,js('()=>document.querySelector(".topbar").getBoundingClientRect().height'))
    pg.get_by_role('button',name='टूल्स',exact=True).click(); pg.wait_for_selector('.dialog'); tabs=pg.locator('.dialog [role=tab]').all_inner_texts(); ck('hi tools tabs',tabs[0]=='मैक्रो' and 'शॉर्टकट' in tabs,tabs)
    ck('hi dialog close label',pg.locator('.dialog header .icon').get_attribute('aria-label')=='बंद करें'); pg.locator('.dialog header .icon').click(); time.sleep(.3)
    pg.reload(); pg.wait_for_function('window.dracoI18n',timeout=60000); time.sleep(2); ck('hindi persists after reload','नया' in top(),top())
    r=js('async()=>await dracoI18n.setUi("taIN")'); time.sleep(.6); ck('ta top bar','புதியது' in top(),top())
    r=js('async()=>await dracoI18n.setUi("frFR")'); time.sleep(2); t=top(); ck('fr top bar',('Nouveau' in t) and ('Outils' in t),t)
    r=js('async()=>await dracoI18n.setUi("deDE")'); time.sleep(2); t=top(); ck('de top bar',('Neu' in t) and ('Werkzeuge' in t),t); ck('header 48px (German)',abs(js('()=>document.querySelector(".topbar").getBoundingClientRect().height')-48)<2,js('()=>document.querySelector(".topbar").getBoundingClientRect().height'))
    r=js('async()=>await dracoI18n.setUi("esES")'); time.sleep(2); ck('es top bar','Nuevo' in top(),top())
    r=js('async()=>await dracoI18n.setUi("arSA")'); time.sleep(2.5); ck('arabic falls back to English labels and rtl',js('()=>document.documentElement.dir')=='rtl' and 'New' in top(),top())
    r=js('async()=>await dracoI18n.setUi("enUS")'); time.sleep(2); ck('back to English','New' in top() and js('()=>document.documentElement.dir')=='ltr',top())
    pg.get_by_role('button',name='Tools',exact=True).click(); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='Language',exact=True).click(); time.sleep(.3); opts=pg.locator('select[aria-label="Interface language"] option').all_inner_texts(); ck('language picker lists Hindi and Tamil',any('हिन्दी' in o for o in opts) and any('தமிழ்' in o for o in opts),opts)
    pg2=ctx.new_page(); pg2.goto(URL); pg2.wait_for_function('window.dracoData && window.dracoPerf',timeout=60000); time.sleep(2); pg=pg2; js=pg.evaluate
    # ---- huge ranges (150k rows used to overflow the call stack in Math.max(...rows))
    js('()=>dracoPerf.expand()'); r=js('async()=>await dracoPerf.fill({rows:150000,cols:3})'); ck('fill 150k rows',r['ok'] and r['written']==150000,r)
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(0,0,150001,3).activate()')
    tick('filled'); r=js('()=>dracoData.dedupe([1],true,true)'); ck('dedupe on 150k rows works',r['ok'] and 'removed' in r['message'],r); ck('dedupe under 30 s',r['ms']<30000,r['ms'])
    tick('deduped'); n=js('()=>{const v=dracoAPI.getActiveWorkbook().getActiveSheet().getRange(0,1,20000,1).getValues().flat().filter(x=>x!==""&&x!==null); return v.length}'); ck('unique keys remain at the top',n<=11000 and n>=9000,n)
    tick('read'); ck('page still responsive',js('()=>1+1')==2)
    ck('no page errors',not errs,errs[:3]); b.close()
print(f'v12-ui: {P} passed, {F} failed'); sys.exit(1 if F else 0)
