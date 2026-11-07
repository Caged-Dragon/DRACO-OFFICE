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
    for path,txt in [('/features','Features'),('/templates','Templates'),('/shortcuts','shortcuts'),('/roadmap','Roadmap'),('/about','About')]:
        pg.click(f'.s-nav nav a[href="{path}"]'); pg.wait_for_selector('.s-phead')
        ck('nav '+path, pg.url.endswith(path) and txt.lower() in pg.inner_text('.s-phead h1').lower())
    pg.go_back(); time.sleep(.5); ck('back works', pg.url.endswith('/roadmap'))
    pg.goto(B+'/nope'); ck('404', 'not found' in pg.inner_text('h1').lower())
    pg.screenshot(path='/tmp/xt/site-home.png') if False else None
    pg.goto(B+'/'); pg.screenshot(path='/tmp/xt/site-home.png')
    pg.click('.s-nav a.s-btn-go'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000)
    ck('app route', pg.url.endswith('/app'))
    pg.goto(B+'/features'); ck('deep link', 'Features' in pg.inner_text('.s-phead h1'))
    m=b.new_page(viewport={'width':390,'height':800}); m.goto(B+'/'); ck('mobile no hscroll', m.evaluate('document.documentElement.scrollWidth<=392'))
    ck('no errors', not errs); print(errs)
    b.close()
print(f'site-ui: {P} passed, {F} failed')
