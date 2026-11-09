# Browser tests: comments, notes, live co-editing, change log, protection, share links (v87-v92)
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
    pg.goto(URL); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook() && window.dracoCollab',timeout=60000); time.sleep(1.5); return pg
def fg(pg): pg.evaluate('()=>document.querySelector("[contenteditable=true]")?.focus()')
def val(pg,a): return pg.evaluate('([a])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).getValue()',[a])
def setv(pg,a,v): pg.evaluate('([a,v])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).setValue(v)',[a,v])
def opendlg(pg,btn,tab=None):
    if btn=='Review': pg.evaluate("()=>dracoCmd.run('open.comments')")
    else: pg.get_by_role('button',name=btn,exact=True).first.click()
    pg.wait_for_selector('.dialog')
    if tab: pg.get_by_role('tab',name=tab).click()
def close(pg):
    if pg.locator('.dialog').count(): pg.locator('.dialog header .icon').click(); time.sleep(.2)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950},accept_downloads=True); pg=boot(ctx)
    pg.evaluate('()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange("A1:B3").setValues([["Item","Qty"],["Apple",3],["Pear",5]]); ws.getRange("A2").activate();}'); time.sleep(.3)
    # ---- comments
    opendlg(pg,'Review','Comments'); pg.get_by_label('Comment text').fill('Is this price right?'); pg.get_by_role('button',name='Comment',exact=True).click(); time.sleep(.4)
    ck('thread listed',pg.locator('.thread').count()==1 and 'price right' in pg.locator('.thread').inner_text())
    pg.get_by_label('Reply').fill('Yes, checked'); pg.get_by_role('button',name='Reply',exact=True).click(); time.sleep(.3)
    ck('reply shown',pg.locator('.reply').count()==1)
    pg.get_by_role('button',name='Resolve').click(); time.sleep(.3); ck('resolved leaves open list',pg.locator('.thread').count()==0)
    pg.get_by_label('Comment status filter').select_option('resolved'); time.sleep(.2); ck('resolved listed',pg.locator('.thread.resolved').count()==1)
    pg.get_by_role('button',name='Reopen').click(); time.sleep(.2); close(pg); time.sleep(.5)
    ck('marker drawn',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-cmark").length')==1)
    ck('marker dom',pg.locator('.draco-cmark').count()==1)
    pg.locator('.draco-cmark').first.click(force=True); time.sleep(.5); ck('marker click opens thread',pg.locator('.dialog .thread').count()>=1); close(pg)
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().insertRowBefore(0)'); time.sleep(.8)
    c=pg.evaluate('()=>dracoCollab.comments().threads.map(t=>[t.r,t.c])'); ck('anchor shifted on row insert',c==[[2,0]],c)
    ck('marker follows',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-cmark").length')==1)
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().deleteRow(0)'); time.sleep(.5)
    time.sleep(2.2); pg.reload(); pg.wait_for_function('window.dracoCollab',timeout=60000); time.sleep(2.5)
    ck('comments persist',pg.evaluate('()=>dracoCollab.comments().threads.length')==1 and pg.evaluate('()=>dracoCollab.comments().threads[0].replies.length')==1)
    ck('marker after reload',pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-cmark").length')==1)
    csv=pg.evaluate('()=>dracoCollab.commentsCsv()'); ck('comments csv',csv.count('\n')>=1 and 'price right' in csv)
    # delete row containing comment removes thread
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().deleteRow(1)'); time.sleep(.6); ck('thread dropped with its row',pg.evaluate('()=>dracoCollab.comments().threads.length')==0)
    # ---- notes
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B2").activate()'); opendlg(pg,'Review','Notes'); pg.get_by_label('Note text').fill('Check supplier'); pg.get_by_role('button',name='Save note').click(); time.sleep(.4)
    n=pg.evaluate('()=>dracoCollab.notes()'); ck('note saved',len(n)==1 and n[0]['text']=='Check supplier',n); ck('note listed in dialog','Check supplier' in pg.locator('.dialog').inner_text())
    ck('notes csv',pg.evaluate('()=>dracoCollab.notesCsv()').startswith('Sheet,Cell,Note')); pg.locator('.dialog').get_by_role('button',name='Delete',exact=True).first.click(); time.sleep(.3); ck('note deleted',pg.evaluate('()=>dracoCollab.notes().length')==0); close(pg)
    # ---- change log
    pg.evaluate('()=>dracoCollab.clearLog()'); setv(pg,'B2',10); time.sleep(.3); setv(pg,'C2','=B2*2'); time.sleep(.3)
    lg=pg.evaluate('()=>dracoCollab.log().map(c=>[c.r,c.c,c.before,c.after,c.user])'); ck('log captured',any(x[:4]==[1,1,'5','10'] for x in lg) or any(x[3]=='10' for x in lg),lg)
    ck('formula captured',any(x[3]=='=B2*2' for x in lg),lg)
    r=pg.evaluate('()=>{const l=dracoCollab.log().find(c=>c.after==="10"); return dracoCollab.revert([l.id])}'); time.sleep(.4); ck('revert ok',r['ok'],r); ck('value restored',str(val(pg,'B2'))=='5',val(pg,'B2'))
    setv(pg,'B2',77); time.sleep(.3); pg.evaluate('()=>{dracoCollab.log().push}'); id_=pg.evaluate('()=>dracoCollab.log().filter(c=>c.after==="=B2*2")[0].id'); setv(pg,'C2','changed later'); time.sleep(.3)
    r=pg.evaluate('([i])=>dracoCollab.revert([i])',[id_]); ck('revert refuses when cell changed since',not r['ok'] or 'skipped' in r,r)
    opendlg(pg,'Review','Changes'); ck('changes table rows',pg.locator('table.chg tbody tr').count()>=2); close(pg)
    pg.evaluate('()=>dracoCollab.setTracking(false)'); n0=pg.evaluate('()=>dracoCollab.log().length'); setv(pg,'A9','untracked'); time.sleep(.3); ck('tracking off',pg.evaluate('()=>dracoCollab.log().length')==n0); pg.evaluate('()=>dracoCollab.setTracking(true)')
    # ---- protection
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A1:F20").clear()'); setv(pg,'A1','locked'); setv(pg,'D4','free'); time.sleep(.3)
    r=pg.evaluate('()=>dracoCollab.protect({password:"pw1",unlocked:["D4:D6"],allow:{}})'); ck('protect ok',r['ok'],r); time.sleep(1.2)
    ck('wrong password rejected',not pg.evaluate('()=>dracoCollab.unprotect("bad")')['ok']); time.sleep(.2)
    ck('canEditCell locked',pg.evaluate('()=>dracoCollab.canEditCell(0,0)')==False and pg.evaluate('()=>dracoCollab.canEditCell(3,3)')==True)
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A2").activate()'); fg(pg); pg.keyboard.type('hack'); pg.keyboard.press('Enter'); time.sleep(.5); pg.keyboard.press('Escape'); time.sleep(.3)
    ck('typing into locked cell blocked',val(pg,'A2') in ('',None),val(pg,'A2'))
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D5").activate()')
    xy=pg.evaluate('()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); const r=[...document.querySelectorAll("main.grid canvas")].map(c=>c.getBoundingClientRect()).sort((a,b)=>b.height-a.height)[0]; let x=r.x+46, y=r.y+27; for(let c=0;c<3;c++) x+=ws.getColumnWidth(c); for(let k=0;k<4;k++) y+=ws.getRowHeight(k); return [x+ws.getColumnWidth(3)/2, y+ws.getRowHeight(4)/2]}')
    pg.mouse.click(xy[0],xy[1]); time.sleep(.3); pg.keyboard.type('okay'); pg.keyboard.press('Enter'); time.sleep(.5)
    ck('typing into unlocked cell works',val(pg,'D5')=='okay',val(pg,'D5'))
    opendlg(pg,'Review','Protect'); ck('protect dialog shows state','protected' in pg.locator('.dialog').inner_text().lower()); close(pg)
    time.sleep(2.2); pg.reload(); pg.wait_for_function('window.dracoCollab',timeout=60000); time.sleep(3)
    ck('protection persists',pg.evaluate('()=>dracoCollab.protection().sheets')!={} and len(pg.evaluate('()=>Object.keys(dracoCollab.protection().sheets)'))==1)
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A3").activate()'); fg(pg); pg.keyboard.type('again'); pg.keyboard.press('Enter'); time.sleep(.5); pg.keyboard.press('Escape'); time.sleep(.3); ck('still blocked after reload',val(pg,'A3') in ('',None),val(pg,'A3'))
    ck('password stored hashed','pw1' not in json.dumps(pg.evaluate('()=>dracoCollab.protection()')))
    r=pg.evaluate('()=>dracoCollab.unprotect("pw1")'); ck('unprotect with password',r['ok'],r); time.sleep(1)
    pg.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A3").activate()'); pg.keyboard.type('free'); pg.keyboard.press('Enter'); time.sleep(.4); ck('editable after unprotect',val(pg,'A3')=='free',val(pg,'A3'))
    r=pg.evaluate('()=>dracoCollab.protectWb("")'); ck('workbook protect',r['ok'],r); ck('wb protect flag',pg.evaluate('()=>dracoCollab.protection().wb.enabled')==True); r=pg.evaluate('()=>dracoCollab.unprotectWb("")'); ck('wb unprotect',r['ok'],r)
    # ---- share link
    setv(pg,'H1','shared!'); time.sleep(.5)
    url=pg.evaluate('async()=>{const s=window.__dracoEngine.api.getActiveWorkbook().save(); const o=await dracoCollab.shareLink("view",s,"My Book"); return o}'); ck('share link made',url['ok'] and '#share=' in url['url'],url.get('message'))
    pg2=ctx.new_page(); pg2.goto(url['url']); pg2.wait_for_function('window.dracoCollab && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2.5)
    ck('shared copy has data',val(pg2,'H1')=='shared!',val(pg2,'H1')); ck('link hash cleared','share=' not in pg2.url)
    pg2.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("H2").activate()'); fg(pg2); pg2.keyboard.type('nope'); pg2.keyboard.press('Enter'); time.sleep(.5); pg2.keyboard.press('Escape'); ck('view-only copy blocks typing',val(pg2,'H2') in ('',None),val(pg2,'H2')); pg2.close()
    # ---- live session between two tabs
    ctx2=b.new_context(viewport={'width':1300,'height':900}); A=boot(ctx2); A.evaluate('()=>{dracoCollab.setName("Alice"); dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A1:B2").setValues([["x",1],["y",2]])}')
    h=A.evaluate('()=>dracoCollab.host("edit")'); room=h['room']; ck('host started',h['ok'] and len(room)==6,h)
    B=ctx2.new_page(); B.errs=[]; B.goto(URL); B.wait_for_function('window.dracoCollab',timeout=60000); time.sleep(1.5); B.evaluate('()=>dracoCollab.setName("Bob")')
    r=B.evaluate('([c])=>dracoCollab.join(c)',[room]); ck('join ok',r['ok'],r); time.sleep(3)
    ck('guest got snapshot',val(B,'A1')=='x' and val(B,'B2')==2,[val(B,'A1'),val(B,'B2')])
    ck('same workbook id',A.evaluate('()=>dracoAPI.getActiveWorkbook().getId()')==B.evaluate('()=>dracoAPI.getActiveWorkbook().getId()'))
    setv(A,'C1','from alice'); time.sleep(1); ck('host edit reaches guest',val(B,'C1')=='from alice',val(B,'C1'))
    setv(B,'C2','from bob'); time.sleep(1); ck('guest edit reaches host',val(A,'C2')=='from bob',val(A,'C2'))
    A.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D1").setFormula("=B1+B2")'); time.sleep(1.2); ck('formula syncs',B.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D1").getFormula()')=='=B1+B2' and val(B,'D1')==3,[val(B,'D1')])
    A.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A1").setFontWeight("bold")'); time.sleep(1); ck('format syncs',B.evaluate('()=>{const c=dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A1").getCellStyles()[0][0]; return !!(c._style||c).bl}'))
    iA=A.evaluate('()=>dracoCollab.info()'); iB=B.evaluate('()=>dracoCollab.info()'); ck('presence both ways',len(iA['peers'])==1 and iA['peers'][0]['name']=='Bob' and len(iB['peers'])==1 and iB['peers'][0]['name']=='Alice',[iA,iB])
    B.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("E5").activate()'); time.sleep(1.2)
    ck('presence selection shared',A.evaluate('()=>dracoCollab.info().peers[0].sel')['r']==4,A.evaluate('()=>dracoCollab.info().peers[0]'))
    ck('peer cursor drawn',A.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-peer").length')==1)
    # no echo loop: counts stable
    time.sleep(1); ck('no echo (values stable)',val(A,'C1')=='from alice' and val(B,'C2')=='from bob')
    # comments sync
    A.evaluate('()=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A2").activate()}'); A.evaluate('()=>dracoCollab.addComment("hello bob")'); time.sleep(1.2); ck('comment syncs',B.evaluate('()=>dracoCollab.comments().threads.length')==1)
    # roles
    pid=A.evaluate('()=>dracoCollab.info().peers[0].id'); A.evaluate('([i])=>dracoCollab.setGuestRole(i,"view")',[pid]); time.sleep(1); ck('guest role is view',B.evaluate('()=>dracoCollab.info().role')=='view')
    setv(B,'F1','sneaky'); time.sleep(1); ck('viewer edits not shared',val(A,'F1') in ('',None),val(A,'F1'))
    r=B.evaluate('()=>dracoCollab.addComment("viewer comment",{sheetId:dracoAPI.getActiveWorkbook().getActiveSheet().getSheetId(),r:0,c:0})'); ck('viewer cannot comment',not r['ok'],r)
    A.evaluate('([i])=>dracoCollab.setGuestRole(i,"comment")',[pid]); time.sleep(.8); r=B.evaluate('()=>dracoCollab.addComment("ok now",{sheetId:dracoAPI.getActiveWorkbook().getActiveSheet().getSheetId(),r:0,c:0})'); ck('commenter can comment',r['ok'],r)
    # bob leaves
    B.evaluate('()=>dracoCollab.leave()'); time.sleep(1); ck('leave removes peer',A.evaluate('()=>dracoCollab.info().peers.length')==0)
    ck('cursor removed',A.evaluate('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-peer").length')==0)
    # join by link form
    A.evaluate('()=>0'); lnk=A.evaluate('()=>dracoCollab.roomLink("comment")'); ck('room link',lnk['ok'] and 'room='+room in lnk['url'],lnk)
    C=ctx2.new_page(); C.errs=[]; C.goto(lnk['url']); C.wait_for_function('window.dracoCollab',timeout=60000); time.sleep(4)
    ck('?room= auto-joins',C.evaluate('()=>dracoCollab.info().active')==True and val(C,'C1')=='from alice',[C.evaluate('()=>dracoCollab.info()'),val(C,'C1')]); ck('room param role',C.evaluate('()=>dracoCollab.info().role')=='comment')
    # UI: dialog share tab
    opendlg(A,'Review','Share & live'); ck('share tab shows session code',room in A.locator('.dialog').inner_text()); close(A)
    errs=pg.errs+A.errs+B.errs+C.errs; ck('no page errors',not errs,errs[:3])
    # mobile layout
    m=b.new_context(viewport={'width':390,'height':780}); M=boot(m); M.locator('button.burger').click(); ck('mobile menu has review',M.get_by_role('button',name='Review (comments, changes)').count()==1)
    M.get_by_role('button',name='Review (comments, changes)').click(); M.wait_for_selector('.dialog'); bx=M.locator('.dialog').bounding_box(); ck('dialog fits phone',bx['width']<=392 and M.evaluate('()=>document.documentElement.scrollWidth')<=392,bx)
    b.close()
print(f'collab-ui: {P} passed, {F} failed'); sys.exit(1 if F else 0)
