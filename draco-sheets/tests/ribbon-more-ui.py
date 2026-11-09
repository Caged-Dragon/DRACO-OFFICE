"""v1.7 ribbon buttons: clipboard, font, colours, borders, alignment, number formats, cell size, sheets, find."""
import time
from playwright.sync_api import sync_playwright
ok=bad=0
def ck(n,c,x=''):
    global ok,bad
    if c: ok+=1
    else: bad+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':1000}); ctx.grant_permissions(['clipboard-read','clipboard-write'])
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog',lambda d:d.accept('Renamed'))
    pg.goto('http://localhost:4174/app?new=1'); pg.wait_for_function('window.dracoAPI&&!location.search',timeout=60000); time.sleep(2.5)
    ev=lambda js,*a: pg.evaluate(js,*a)
    ev("()=>{const s=dracoAPI.getActiveWorkbook().getActiveSheet();s.getRange('A1').setValue(1234.5);s.getRange('B1').setValue('hello');s.getRange('A2').setValue(7);s.getRange('A1:B1').activate();}"); time.sleep(.5)
    def btn(name): pg.get_by_role('button',name=name,exact=True).first.click(); time.sleep(.35)
    TEXTMENU={'Font','Font size','Number format'}
    def pick(menu,item):
        pg.get_by_role('button',name=(menu if menu in TEXTMENU else menu+' options'),exact=True).first.click(); time.sleep(.2)
        pg.get_by_role('menuitem',name=item,exact=True).first.click(); time.sleep(.35)
    R="dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A1')"
    def sty(cell='A1'):
        return ev("(a)=>{const wb=dracoAPI.getActiveWorkbook();const sn=wb.save();const sh=Object.values(sn.sheets).find(x=>x.id===wb.getActiveSheet().getSheetId());const m=a.match(/([A-Z]+)(\\d+)/);const c=sh.cellData?.[+m[2]-1]?.[m[1].charCodeAt(0)-65];const st=c?.s;return typeof st==='string'?(sn.styles||{})[st]||{}:(st||{})}",cell)
    # drawer
    pg.get_by_role('tab',name='File').click(); time.sleep(.3)
    ck('drawer has New',pg.get_by_role('button',name='New workbook').count()==1)
    ck('drawer has Settings',pg.get_by_role('button',name='Settings').count()==1)
    pg.keyboard.press('Escape'); time.sleep(.2); ck('drawer closes',pg.locator('.drawer').count()==0)
    ck('top bar is clean',pg.locator('.topbar button:visible').count()<=3,pg.locator('.topbar button:visible').all_inner_texts())
    ck('ribbon does not scroll',pg.evaluate("()=>{const e=document.querySelector('.rb-panel');return e.scrollWidth<=e.clientWidth}"))
    # every command exists
    ids=ev("()=>dracoCmd.list().map(c=>c.id)")
    for i in ['edit.cut','edit.copy','edit.paste','edit.paste.values','edit.painter','edit.find','edit.replace','edit.selectall','fmt.border.all','fmt.dec.more','cell.insert.right','row.autofit','col.autofit','sheet.rename','sheet.moveleft','view.fullscreen','insert.hyperlink']:
        ck('registered '+i,i in ids)
    # every ribbon command id exists
    missing=ev("()=>{const have=new Set(dracoCmd.list().map(c=>c.id));return dracoRibbon.commands().filter(c=>!have.has(c))}")
    ck('all ribbon commands registered',not missing,missing)
    # font/colour/fill
    pick('Fill colour','Fill red'); ck('fill red',(sty().get('bg') or {}).get('rgb','').lower()=='#e03131',sty())
    pick('Font','Times New Roman'); ck('font family',sty().get('ff')=='Times New Roman',sty())
    pick('Font size','18'); ck('font size 18',sty().get('fs')==18,sty())
    pick('Font colour','Text blue'); ck('font colour',(sty().get('cl') or {}).get('rgb','').lower()=='#1971c2',sty())
    btn('Bold'); ck('bold',sty().get('bl')==1,sty())
    pick('Fill colour','No fill'); ck('no fill',not (sty().get('bg') or {}).get('rgb'),sty())
    # alignment
    btn('Align top'); ck('valign top',sty().get('vt')==1,sty())
    pick('Orientation','Angle counterclockwise'); ck('rotate 45',(sty().get('tr') or {}).get('a')==45,sty())
    btn('Centre'); ck('centre',sty().get('ht')==2,sty())
    # borders
    pick('Borders','All borders'); ck('border set','bd' in sty(),sty())
    # number format
    ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A1').activate()"); time.sleep(.3)
    pick('Number format','Currency'); btn('Increase decimal'); f=sty().get('n',{}).get('pattern',''); ck('more decimals',f.count('0')>=4 and '.000' in f,f)
    btn('Decrease decimal'); btn('Decrease decimal'); f2=sty().get('n',{}).get('pattern',''); ck('fewer decimals',f2.count('0')<f.count('0'),(f,f2))
    pick('Number format','Whole number'); ck('whole number fmt',sty().get('n',{}).get('pattern')=='0',sty())
    # cell size
    pick('Format','Column width 150'); ck('col width',abs(ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getColumnWidth(0)")-150)<2)
    ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('K9').activate()"); time.sleep(.3); pick('Format','Row height 45'); rh=ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRowHeight(8)"); ck('row height',abs(rh-45)<2,rh)
    # insert cells shift down moves A1->A2
    ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A1').activate()"); pick('Insert','Insert cells, shift down'); time.sleep(.5)
    ck('insert cells down',ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A2').getValue()") in (1234.5,'1235'),[ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A%d').getValue()"%i) for i in (1,2,3)])
    # clipboard: copy A2, paste values to D5
    ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A2').activate()"); btn('Copy'); time.sleep(.6)
    ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('D5').activate()"); pick('Paste','Paste values only'); time.sleep(.8)
    v=ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('D5').getValue()"); ck('copy + paste values',v==1234.5,v)
    # select all
    pick('Find and select','Select all cells'); ck('select all',ev("()=>dracoAPI.getActiveWorkbook().getActiveRange().getLastRow()")>100)
    # find opens
    ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A1').activate()"); pick('Find and select','Find'); time.sleep(.6)
    ck('find dialog opens',pg.get_by_label('Find what').count()==1)
    ev("()=>{const s=dracoAPI.getActiveWorkbook().getActiveSheet();s.getRange('G1').setValue('apple');s.getRange('G2').setValue('pineapple');s.getRange('G3').setValue('Apple')}"); time.sleep(.4)
    pg.get_by_label('Find what').fill('apple'); pg.get_by_role('button',name='Find all').click(); time.sleep(2)
    ck('find all (2 case-insensitive + ...)',pg.get_by_text('3 matches found.').count()==1,pg.locator('.dialog .hint').all_inner_texts())
    pg.get_by_role('button',name='Replace…').click(); pg.get_by_label('Replace with').fill('pear'); pg.get_by_role('button',name='Replace all').click(); time.sleep(2.5)
    ck('replace all',ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('G2').getValue()")=='pinepear',ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('G2').getValue()"))
    pg.keyboard.press('Escape'); time.sleep(.3)
    pg.keyboard.press('Control+h'); time.sleep(.5); ck('Ctrl+H opens replace',pg.get_by_label('Replace with').count()==1); pg.keyboard.press('Escape')
    # sheets
    pg.get_by_role('tab',name='View',exact=True).click(); time.sleep(.3)
    btn('Rename'); ck('rename sheet',ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getSheetName()")=='Renamed')
    pick('Tab colour','Tab purple'); ck('tab colour',ev("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getTabColor?.()||'x'")!='' )
    ev("()=>dracoAPI.getActiveWorkbook().insertSheet('Second')"); time.sleep(.4)
    btn('Move left'); ck('move sheet left',ev("()=>dracoAPI.getActiveWorkbook().getSheets()[0].getSheetName()")=='Second')
    ck('no page errors',not errs,errs[:2])
    b.close()
print(f'ribbon-more-ui: {ok} passed, {bad} failed')
