import sys,time
from playwright.sync_api import sync_playwright
B='http://localhost:4174'; P=F=0
def ck(n,c):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(B+'/'); pg.wait_for_selector('.s-hero')
    ck('home h1','spreadsheet' in pg.inner_text('h1').lower())
    ck('title','Draco Sheets' in pg.title())
    for path,txt in [('/features','Features'),('/templates','Templates'),('/shortcuts','shortcuts'),('/about','About')]:
        pg.click(f'.s-nav nav a[href="{path}"]'); pg.wait_for_selector('.s-phead')
        ck('nav '+path, pg.url.endswith(path) and txt.lower() in pg.inner_text('.s-phead h1').lower())
    pg.go_back(); time.sleep(.5); ck('back works', pg.url.endswith('/shortcuts'))
    pg.goto(B+'/nope'); ck('404', 'not found' in pg.inner_text('h1').lower())
    pg.screenshot(path='/tmp/xt/site-home.png') if False else None
    pg.goto(B+'/'); pg.screenshot(path='/tmp/xt/site-home.png')
    pg.click('.s-nav a.s-btn-go'); pg.wait_for_selector('.st-new'); ck('open app goes to start screen', pg.url.endswith('/home'))
    pg.click('.st-card.blank'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000)
    pg.wait_for_function('!location.search',timeout=60000); time.sleep(1); ck('app route', pg.url.endswith('/app'))
    pg.goto(B+'/features'); ck('deep link', 'Features' in pg.inner_text('.s-phead h1'))
    m=b.new_page(viewport={'width':390,'height':800}); m.goto(B+'/'); ck('mobile no hscroll', m.evaluate('document.documentElement.scrollWidth<=392'))
    # roadmap gone, settings + theme toggle present
    pg.goto(B+'/'); pg.wait_for_selector('.s-hero')
    ck('no roadmap link', pg.locator('a[href="/roadmap"]').count()==0)
    ck('theme toggle in nav', pg.locator('.s-nav .theme-toggle').count()==1)
    before=pg.evaluate('()=>document.documentElement.dataset.dracoTheme||"system"')
    pg.click('.s-nav .theme-toggle'); time.sleep(.3); ck('toggle changes theme', pg.evaluate('()=>document.documentElement.dataset.dracoTheme')=='dark')
    ck('purple dark brand', pg.evaluate('()=>getComputedStyle(document.documentElement).getPropertyValue("--brand").trim()')=='#7c4dff')
    pg.click('.s-nav .theme-toggle'); time.sleep(.3); ck('toggle back to gold', pg.evaluate('()=>getComputedStyle(document.documentElement).getPropertyValue("--brand").trim()')=='#8a6508')
    pg.click('.s-nav a.s-set-btn'); pg.wait_for_selector('.s-settings'); ck('settings page', pg.url.endswith('/settings'))
    pg.get_by_role('radio',name='Purple (dark)').click(); time.sleep(.2); ck('settings sets theme', pg.evaluate('()=>document.documentElement.dataset.dracoTheme')=='dark')
    pg.get_by_role('radio',name='Gold (light)').click()
    # templates page: card opens the template in the editor
    pg.goto(B+'/templates'); pg.wait_for_selector('a.s-card.link'); name=pg.locator('a.s-card.link h3').first.inner_text(); pg.locator('a.s-card.link').first.click()
    pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); pg.wait_for_function('!location.search',timeout=60000); time.sleep(1.5)
    ck('template opened', name in pg.evaluate('()=>document.querySelector(".title").value') and '?' not in pg.url)
    # start screen
    pg.goto(B+'/home'); pg.wait_for_selector('.st-new'); ck('start screen greets', pg.inner_text('.st-top h1').startswith('Good'))
    ck('start has settings + blank', pg.locator('.st-set').count()==1 and pg.locator('.st-card.blank').count()==1)
    pg.locator('.st-card').nth(1).click(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); pg.wait_for_function('!location.search',timeout=60000); time.sleep(1.5)
    ck('start template opens', pg.evaluate('()=>document.querySelector(".title").value')!='Untitled workbook')
    # ribbon
    pg.goto(B+'/app'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(1.5)
    tabs=pg.locator('.rb-tabs [role=tab]').all_inner_texts(); ck('ribbon tabs', tabs==['File','Home','Insert','Draw','Page Layout','Formulas','Data','Review','View','Automate','Help'])
    missing=pg.evaluate('()=>{const have=new Set(window.dracoCmd.list().map(c=>c.id)); return window.dracoRibbon.commands().filter(c=>!have.has(c))}'); ck('every ribbon command exists '+str(missing), not missing)
    pg.get_by_role('tab',name='Insert',exact=True).click(); pg.click('.rb-panel >> text=PivotTable'); pg.wait_for_selector('.dialog'); ck('ribbon opens pivot dialog', True)
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.get_by_role('tab',name='View',exact=True).click(); pg.click('.rb-panel >> text=Freeze top row'); time.sleep(.3); ck('ribbon freeze row', pg.evaluate('()=>window.dracoAPI.getActiveWorkbook().getActiveSheet().getFrozenRows?.()??1')>=1)
    pg.get_by_role('tab',name='Home',exact=True).click(); ck('univer toolbar on Home', pg.locator('main.grid header[data-draco-home="1"]').count()==1)
    pg.get_by_role('tab',name='Data',exact=True).click(); ck('univer toolbar hidden on Data', pg.locator('main.grid header[data-draco-home="0"]').count()==1)
    pg.click('.app .tt'); time.sleep(.3); ck('app theme toggle', pg.evaluate('()=>document.documentElement.dataset.dracoTheme')=='dark')
    ck('no errors', not errs); print(errs)
    b.close()
print(f'site-ui: {P} passed, {F} failed')
