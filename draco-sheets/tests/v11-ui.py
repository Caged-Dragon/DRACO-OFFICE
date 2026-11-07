# Browser tests v0.11.0: slicer/timeline move+resize (v75), pivot field buttons (v77), sparklines follow resize (v69), .xls import (v83)
import time,sys,json
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
URL='http://localhost:4174/app'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950}); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(URL); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook() && window.dracoPivots',timeout=60000); time.sleep(1.5)
    js=lambda s,a=None: pg.evaluate(s,a) if a is not None else pg.evaluate(s)
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('A1:D7').setValues([['Region','Product','Date','Sales'],['East','Apple','2024-01-15',100],['East','Pear','2024-02-10',50],['West','Apple','2024-01-20',200],['West','Apple','2024-04-05',150],['West','Pear','2024-05-01',80],['North','Pear','2024-05-20',70]]); ws.getRange('A1').activate();}''')
    time.sleep(.6)
    r=js('()=>dracoPivots.create({src:"A1:D7",dest:"H2",cfg:{rows:["Region","Product"],values:[{field:"Sales",agg:"sum"}],layout:"tabular"}})'); pid=r.get('id'); ck('pivot built',r['ok'],r); time.sleep(1)
    # ---- field buttons
    n=pg.locator('.draco-fieldbtn').count(); ck('field buttons shown (2 row fields)',n==2,n)
    pg.locator('.draco-fieldbtn').first.click(); time.sleep(.4); ck('menu opens',pg.locator('.draco-fieldmenu').count()==1)
    items=pg.locator('.draco-fieldmenu label').all_inner_texts(); ck('menu lists regions',sorted(items)==['East','North','West'],items)
    pg.locator('.draco-fieldmenu label',has_text='West').locator('input').click(); time.sleep(1)
    vals=js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("H2:K12").getValues().flat().filter(x=>x!=="" && x!==null)')
    ck('West filtered out of pivot','West' not in vals and 'East' in vals,vals)
    ck('menu stays open and unchecks',pg.locator('.draco-fieldmenu label',has_text='West').locator('input').is_checked()==False)
    pg.get_by_role('button',name='Select all').click(); time.sleep(1); vals=js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("H2:K14").getValues().flat()'); ck('select all restores West','West' in vals)
    pg.keyboard.press('Escape'); time.sleep(.3); ck('Esc closes menu',pg.locator('.draco-fieldmenu').count()==0)
    # reload keeps buttons
    # ---- slicer move / resize
    r=js('([id])=>dracoPivots.slicer(id,"Product","slicer")',[pid]); ck('slicer added',r['ok'],r); time.sleep(1.2)
    box=lambda: pg.locator('.draco-slicer').first.bounding_box()
    b0=box(); ck('slicer visible',b0 is not None and b0['width']>100,b0)
    hd=pg.locator('.draco-slicer [data-drag]').first.bounding_box(); sx,sy=hd['x']+20,hd['y']+hd['height']/2
    pg.mouse.move(sx,sy); pg.mouse.down(); pg.mouse.move(sx+60,sy+40,steps=6); ck('ghost outline while dragging',pg.locator('.draco-ghost').count()==1); pg.mouse.up(); time.sleep(1)
    b1=box(); ck('slicer moved ~(+60,+40)',abs((b1['x']-b0['x'])-60)<6 and abs((b1['y']-b0['y'])-40)<6,[b0,b1]); ck('ghost removed',pg.locator('.draco-ghost').count()==0)
    g=pg.locator('.draco-slicer [data-grip]').first.bounding_box(); gx,gy=g['x']+8,g['y']+8
    pg.mouse.move(gx,gy); pg.mouse.down(); pg.mouse.move(gx+50,gy+30,steps=6); pg.mouse.up(); time.sleep(1)
    b2=box(); ck('slicer resized ~(+50,+30)',abs((b2['width']-b1['width'])-50)<6 and abs((b2['height']-b1['height'])-30)<6,[b1,b2])
    pg.mouse.move(b2['x']+b2['width']-8,b2['y']+b2['height']-8); pg.mouse.down(); pg.mouse.move(b2['x']-300,b2['y']-300,steps=6); pg.mouse.up(); time.sleep(1); b3=box(); ck('min size enforced',b3['width']>=105 and b3['height']>=75,b3)
    # slicer still filters after move
    pg.locator('.draco-slicer button[aria-pressed]:not([title])',has_text='Pear').first.click(); time.sleep(1); vals=js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("H2:K14").getValues().flat()'); ck('slicer still filters after move','Apple' not in vals,vals)
    pg.locator('.draco-slicer button[title="Clear filter"]').first.click(); time.sleep(.8)
    # persistence of moved position
    snap_pos=js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-slicer").map(f=>[Math.round(f.position.left),Math.round(f.position.top),Math.round(f.position.width),Math.round(f.position.height)])'); ck('float position stored',len(snap_pos)==1 and snap_pos[0][2]>100,snap_pos)
    # ---- timeline move
    r=js('([id])=>dracoPivots.slicer(id,"Date","timeline")',[pid]); time.sleep(1.2)
    if r['ok']:
        tb=pg.locator('.draco-timeline').first.bounding_box(); th=pg.locator('.draco-timeline [data-drag]').first.bounding_box(); pg.mouse.move(th['x']+10,th['y']+10); pg.mouse.down(); pg.mouse.move(th['x']+10,th['y']+90,steps=5); pg.mouse.up(); time.sleep(1); ta=pg.locator('.draco-timeline').first.bounding_box(); ck('timeline moved down ~80',abs((ta['y']-tb['y'])-80)<8,[tb,ta])
    else: ck('timeline created',False,r)
    # ---- sparklines follow resize
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('A20:E21').setValues([[1,3,2,5,4],[2,1,4,3,6]]);}'''); time.sleep(.4)
    r=js('()=>dracoCharts.sparkline({src:"A20:E21",loc:"G20:G21",opts:{type:"line"}})'); ck('sparklines created',r['ok'],r); time.sleep(1)
    geo=lambda: js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getAllFloatDoms().filter(f=>f.componentKey==="draco-spark").map(f=>[Math.round(f.position.left),Math.round(f.position.top),Math.round(f.position.width),Math.round(f.position.height)])')
    g0=geo(); ck('2 sparklines',len(g0)==2,g0)
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().setColumnWidth(6,200)'); time.sleep(1.8); g1=geo(); ck('width follows column resize',max(x[2] for x in g1)>=190 and max(x[2] for x in g1)<=200,[g0,g1])
    ck('left unchanged by widening col G (to the right)',sorted(x[0] for x in g1)==sorted(x[0] for x in g0),[g0,g1])
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().setRowHeight(19,60)'); time.sleep(1.8); g2=geo(); ck('height follows row resize',max(x[3] for x in g2)>=50,g2)
    ck('second sparkline top shifted down',max(x[1] for x in g2)>max(x[1] for x in g1),[g1,g2])
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().setColumnWidth(0,160)'); time.sleep(1.8); g3=geo(); ck('shifts right when an earlier column widens',min(x[0] for x in g3)>min(x[0] for x in g2)+50,[g2,g3])
    time.sleep(1.5); g4=geo(); ck('stable (no re-fit loop)',g3==g4,[g3,g4])
    # ---- xls import via real file chooser
    import subprocess,os
    open('/tmp/mk.mjs','w').write("import * as X from '/home/claude/draco-sheets/node_modules/@e965/xlsx/xlsx.mjs'; import fs from 'node:fs'; const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,X.utils.aoa_to_sheet([['Name','Score'],['Ann',90],['Bob',75]]),'Marks'); fs.writeFileSync('/tmp/old.xls',X.write(wb,{type:'buffer',bookType:'xls'}));")
    rc=subprocess.run(['node','/tmp/mk.mjs'],capture_output=True,text=True); ck('xls fixture written',os.path.exists('/tmp/old.xls'),rc.stderr[-200:])
    pg.get_by_role('button',name='Files',exact=True).click(); pg.wait_for_selector('.dialog'); pg.set_input_files('input[aria-label="Choose file to import"]','/tmp/old.xls'); time.sleep(3)
    ck('xls opened as new workbook',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getSheetName()')=='Marks',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getSheetName()'))
    ck('xls values',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("B3").getValue()')==75)
    ck('no page errors',not errs,errs[:3]); b.close()
print(f'v11-ui: {P} passed, {F} failed'); sys.exit(1 if F else 0)
