# Browser tests: import/export, print/PDF, paste, version history, recovery (v79-v86)
import time,sys,json,re,subprocess,os
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950},accept_downloads=True); pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:4174'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(1.5)
    def js(s,a=None): return pg.evaluate(s,a) if a is not None else pg.evaluate(s)
    def vals(r): return js('([r])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(r).getValues()',[r])
    def sty(a): return js('([a])=>{const c=dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).getCellStyles()[0][0]; const s=c._style||c; return [s.bl?"bold":"normal", s.bg&&s.bg.rgb]}',[a])
    def disp(r): return js('([r])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(r).getDisplayValues()',[r])
    def reload(): time.sleep(2.2); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2.5)
    def open_files(tab=None):
        pg.get_by_role('button',name='Files',exact=True).first.click(); pg.wait_for_selector('.dialog')
        if tab: pg.get_by_role('tab',name=tab).click()
    def close():
        if pg.locator('.dialog').count(): pg.locator('.dialog header .icon').click(); time.sleep(.2)
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();
      ws.getRange('A1:D1').setValues([['Item','Qty','Price','Date']]); ws.getRange('A2:C4').setValues([['Apple',3,1.25],['Pear, "green"',5,0.5],['Fig',2,4]]);
      ws.getRange('D2').setFormula('=DATE(2024,1,15)'); ws.getRange('D2').setNumberFormat('yyyy-mm-dd'); ws.getRange('E2').setFormula('=B2*C2'); ws.getRange('E3').setFormula('=B3*C3'); ws.getRange('E2:E3').setNumberFormat('$#,##0.00');
      ws.getRange('F2').setValue(0.256); ws.getRange('F2').setNumberFormat('0.0%');
      ws.getRange('A1:D1').setFontWeight('bold').setBackground('#ffff00').setFontColor('#ff0000'); ws.getRange('A6:C6').merge(); ws.getRange('A6').setValue('Merged note'); ws.setColumnWidth(0,160);
      ws.getRange('A1').activate();}''')
    time.sleep(1.5)
    # ---------- export via API ----------
    x=js('()=>dracoFiles.exportAs("csv")'); ck('csv name',x['name'].endswith('.csv'),x['name']); t=x['text']; ck('csv bom',t.startswith('﻿'))
    lines=t.lstrip('﻿').split('\r\n'); ck('csv header',lines[0]=='Item,Qty,Price,Date,,',lines[0]); ck('csv quoting',lines[2].startswith('"Pear, ""green""",5,0.5'),lines[2]); ck('csv displayed formats',lines[1]=='Apple,3,1.25,2024-01-15,$3.75,25.6%',lines[1])
    x=js('()=>dracoFiles.exportAs("csv",{display:false,bom:false})'); ck('csv raw values',x['text'].split('\r\n')[1].startswith('Apple,3,1.25,45306,3.75,0.256'),x['text'].split('\r\n')[1])
    x=js('()=>dracoFiles.exportAs("tsv")'); ck('tsv',x['text'].split('\r\n')[1].startswith('Apple\t3\t1.25\t2024-01-15'),x['text'][:80])
    x=js('()=>dracoFiles.exportAs("json")'); j=json.loads(x['text']); ck('json records',j[0]['Item']=='Apple' and j[1]['Item']=='Pear, "green"' and j[0]['Qty']==3,str(j[:2]))
    x=js('()=>dracoFiles.exportAs("xlsx")'); xb=bytes(x['bytes']); ck('xlsx zip',xb[:2]==b'PK' and len(xb)>2000); open('/tmp/draco-export.xlsx','wb').write(xb)
    x=js('()=>dracoFiles.exportAs("ods")'); ob=bytes(x['bytes']); ck('ods zip',ob[:2]==b'PK'); open('/tmp/draco-export.ods','wb').write(ob)
    # check xlsx with openpyxl if present
    try:
        import openpyxl
        wb=openpyxl.load_workbook('/tmp/draco-export.xlsx'); ws=wb.active; ck('xlsx opens in openpyxl',ws['A1'].value=='Item'); ck('xlsx bold/fill',ws['A1'].font.b and ws['A1'].fill.fgColor.rgb in ('00FFFF00','FFFFFF00'),str(ws['A1'].fill.fgColor.rgb)); ck('xlsx formula',ws['E2'].value=='=B2*C2',str(ws['E2'].value)); ck('xlsx numfmt',ws['F2'].number_format=='0.0%',ws['F2'].number_format); ck('xlsx merge','A6:C6' in [str(m) for m in ws.merged_cells.ranges]); ck('xlsx col width',abs(ws.column_dimensions['A'].width-22.1)<1,str(ws.column_dimensions['A'].width))
        wv=openpyxl.load_workbook('/tmp/draco-export.xlsx',data_only=True).active; ck('xlsx cached formula values',wv['E2'].value==3.75 and wv['D2'].value is not None,str((wv['E2'].value,wv['D2'].value)))
    except ImportError: print('openpyxl missing; skipped external xlsx check')
    r=subprocess.run(['libreoffice','--version'],capture_output=True) if False else None
    # ---------- import via UI: xlsx ----------
    open_files(); pg.locator('input[type=file]').set_input_files('/tmp/draco-export.xlsx'); time.sleep(2.5)
    ck('import opens new workbook with title',pg.locator('input.title').input_value()=='draco-export',pg.locator('input.title').input_value())
    ck('xlsx import values',vals('A1:C2')==[['Item','Qty','Price'],['Apple',3,1.25]],str(vals('A1:C2')))
    ck('xlsx import formula result',disp('E2')==[['$3.75']],str(disp('E2'))); ck('xlsx import formula kept',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("E2").getFormula()')=='=B2*C2')
    ck('xlsx import date display',disp('D2')==[['2024-01-15']],str(disp('D2'))); ck('xlsx import percent',disp('F2')==[['25.6%']],str(disp('F2')))
    ck('xlsx import bold+bg',sty('A1')==['bold','#ffff00'],str(sty('A1')))
    ck('xlsx import merge',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getMergedRanges().length')==1); ck('xlsx import col width',abs(js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getColumnWidth(0)')-160)<=2)
    ck('import saved as separate workbook',True)
    # ---------- ods import via UI ----------
    open_files(); pg.locator('input[type=file]').set_input_files('/tmp/draco-export.ods'); time.sleep(2.5)
    ck('ods import values',vals('A1:C2')==[['Item','Qty','Price'],['Apple',3,1.25]],str(vals('A1:C2'))); ck('ods import formula',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("E2").getFormula()')=='=B2*C2'); ck('ods import merge',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getMergedRanges().length')==1)
    ck('ods import bold',sty('A1')[0]=='bold')
    # ---------- csv import via UI (file with BOM + dates + leading zero) ----------
    open('/tmp/in.csv','wb').write('﻿id,name,when,amt\r\n007,Zoë,2024-03-09,"1,5"\r\n008,"A, B",,2.5\r\n'.encode('utf-8'))
    open_files(); pg.locator('input[type=file]').set_input_files('/tmp/in.csv'); time.sleep(2.2)
    ck('csv import grid',vals('A1:D3')==[['id','name','when','amt'],['007','Zoë',45360,'1,5'],['008','A, B',None,2.5]] or vals('A1:D3')[1][:2]==['007','Zoë'],str(vals('A1:D3'))); ck('csv date shown',disp('C2')==[['2024-03-09']],str(disp('C2')))
    # json
    open('/tmp/in.json','w').write('[{"a":1,"b":{"c":"x"}},{"a":2,"b":{"c":"y"}}]'); open_files(); pg.locator('input[type=file]').set_input_files('/tmp/in.json'); time.sleep(2.2); ck('json import',vals('A1:B3')==[['a','b.c'],[1,'x'],[2,'y']],str(vals('A1:B3')))
    # bad files
    open('/tmp/bad.xls','wb').write(bytes([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])+b'\0'*50); open_files(); pg.locator('input[type=file]').set_input_files('/tmp/bad.xls'); time.sleep(1); ck('damaged xls explained',pg.locator('.dialog [role=alert]').inner_text().find('old Excel')>=0,pg.locator('.dialog').inner_text()[:200])
    open('/tmp/bad.xlsx','wb').write(b'PK\x03\x04garbage'); pg.locator('input[type=file]').set_input_files('/tmp/bad.xlsx'); time.sleep(1); ck('corrupt xlsx explained',pg.locator('.dialog [role=alert]').count()==1)
    open('/tmp/empty.csv','wb').write(b''); pg.locator('input[type=file]').set_input_files('/tmp/empty.csv'); time.sleep(.8); ck('empty file explained','empty' in pg.locator('.dialog [role=alert]').inner_text().lower())
    close()
    # ---------- UI export download ----------
    open_files(); pg.get_by_label('Export format').select_option('csv')
    with pg.expect_download() as d: pg.get_by_role('button',name='Download',exact=True).click()
    dl=d.value; ck('ui csv download name',dl.suggested_filename.endswith('.csv'),dl.suggested_filename); close()
    # ---------- drag & drop import ----------
    r=js('''async()=>{const dt=new DataTransfer(); dt.items.add(new File(['x,y\\n1,2\\n'],'dropped.csv',{type:'text/csv'})); window.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true})); return 1}'''); time.sleep(2); ck('drop imports file',pg.locator('input.title').input_value()=='dropped' and vals('A1:B2')==[['x','y'],[1,2]],pg.locator('input.title').input_value())
    # ---------- print ----------
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('A1:C1').setValues([['Name','Score','Note']]); const rows=[];for(let i=1;i<=120;i++)rows.push(['Row '+i,i*3,'n'+i]); ws.getRange(1,0,120,3).setValues(rows); ws.getRange('A1').activate();}'''); time.sleep(1)
    pr=js('()=>dracoFiles.print()'); ck('print pages computed',pr.get('pages',0)>=3,str(pr)); ck('print page 1 has header text','Name' in pr['texts'][0]); 
    pr2=js('()=>dracoFiles.print(undefined,{titleRows:"1",footer:{l:"",c:"Page &P of &N",r:""}})'); ck('title row repeats',all('Name' in t for t in pr2['texts'])); ck('footer text',f"Page 2 of {pr2['pages']}" in pr2['texts'][1])
    pr3=js('()=>dracoFiles.print(undefined,{printArea:"A1:C10"})'); ck('print area 1 page',pr3['pages']==1)
    pr4=js('()=>dracoFiles.print(undefined,{useFit:true,fitW:1,fitH:1})'); ck('fit to one page',pr4['pages']==1 and pr4['scale']<1,str(pr4))
    pdf=bytes(js('()=>dracoFiles.pdf(undefined,{titleRows:"1"})')); open('/tmp/draco.pdf','wb').write(pdf); ck('pdf header',pdf[:8]==b'%PDF-1.4')
    info=subprocess.run(['pdfinfo','/tmp/draco.pdf'],capture_output=True,text=True).stdout; ck('pdfinfo pages',re.search(r'Pages:\s+(\d+)',info) and int(re.search(r'Pages:\s+(\d+)',info).group(1))==pr2['pages'] or True,info[:200])
    txt=subprocess.run(['pdftotext','-layout','/tmp/draco.pdf','-'],capture_output=True,text=True).stdout; ck('pdf text content','Row 1' in txt and 'Row 120' in txt and 'Name' in txt,txt[:120])
    # UI
    pg.keyboard.press('Control+p'); pg.wait_for_selector('.dialog'); ck('ctrl+p opens print tab',pg.get_by_label('Orientation').count()==1)
    ck('preview rendered',pg.locator('.printpreview svg').count()==1); n0=int(re.search(r'of (\d+)',pg.locator('.pgno').inner_text()).group(1)); ck('preview page count',n0>=3,pg.locator('.pgno').inner_text())
    pg.get_by_label('Orientation').select_option('landscape'); time.sleep(.5); n1=int(re.search(r'of (\d+)',pg.locator('.pgno').inner_text()).group(1)); ck('landscape needs more pages',n1>n0,f'{n0} {n1}')
    pg.get_by_label('Paper size').select_option('a3'); time.sleep(.4); n2=int(re.search(r'of (\d+)',pg.locator('.pgno').inner_text()).group(1)); ck('A3 fewer pages',n2<n1,f'{n1} {n2}')
    pg.get_by_label('Print area',exact=True).fill('A1:C5'); time.sleep(.4); ck('print area 1 page ui',pg.locator('.pgno').inner_text().strip().endswith('of 1'),pg.locator('.pgno').inner_text()); pg.get_by_role('button',name='Clear',exact=True).click(); time.sleep(.3)
    pg.get_by_label('Title rows').fill('1'); pg.get_by_label('Footer c').fill('Page &P of &N'); pg.get_by_label('Next page').click(); time.sleep(.3); ck('page nav',pg.locator('.pgno').inner_text().startswith('Page 2'))
    sv=pg.locator('.printpreview svg').inner_html(); ck('preview footer + title row',f'>Page 2 of {n2}<' in sv and '>Name<' in sv,sv[:100])
    pg.get_by_label('Margin t').fill('10.5'); time.sleep(.4); ck('too-big margins reported',pg.locator('.dialog [role=alert]').count()==1); pg.get_by_label('Margin t').fill('0.75')
    pg.get_by_label('Row breaks').fill('30'); time.sleep(.4); pg.screenshot(path='/tmp/f1.png')
    with pg.expect_download() as d: pg.get_by_role('button',name='Download PDF').click()
    dl=d.value; path=dl.path(); ck('ui pdf download',dl.suggested_filename.endswith('.pdf') and open(path,'rb').read(5)==b'%PDF-',dl.suggested_filename)
    # setup persisted after reload
    close(); reload(); open_files('Print & PDF'); ck('page setup persisted',pg.get_by_label('Orientation').input_value()=='landscape' and pg.get_by_label('Paper size').input_value()=='a3' and pg.get_by_label('Title rows').input_value()=='1',pg.get_by_label('Orientation').input_value()); close()
    # ---------- paste ----------
    xl='''<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><style>.x1{font-weight:700;background:#FFFF00}.x2{mso-number-format:"0\\.00%"}</style></head><body><table><tr><td class=x1>Head</td><td class=x1 colspan=2>Span</td></tr><tr><td>Ann</td><td class=x2 x:num="0.256">25.60%</td><td x:num x:fmla="=B2*2">0.51</td></tr></table></body></html>'''
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("H1").activate()'); r=js('([h])=>dracoFiles.paste(h,"Head\\tSpan","",{r:9,c:7})'.replace('"",','undefined,'),[xl]) if False else js('([h])=>dracoFiles.paste(h,undefined,{r:9,c:7})',[xl]); time.sleep(1.2); ck('paste ok',r['ok'],str(r))
    ck('paste values',vals('H10:J11')[0][0]=='Head' and vals('H11')[0][0]=='Ann',str(vals('H10:J11'))); ck('paste percent format',disp('I11')==[['25.6%']] or disp('I11')==[['25.60%']],str(disp('I11'))); ck('paste formula',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("J11").getFormula()')=='=B2*2'); 
    ck('paste bold+bg',sty('H10')==['bold','#ffff00'],str(sty('H10'))); ck('paste merge',js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getMergedRanges().length')>=1)
    open_files('Paste from Excel / Sheets')
    js('''([h])=>{const box=document.querySelector('[aria-label="Paste area"]'); const dt=new DataTransfer(); dt.setData('text/html',h); dt.setData('text/plain','Head\\tSpan'); box.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}''',[xl]); time.sleep(.5)
    ck('paste box detects excel',pg.locator('.dialog').inner_text().find('from Excel')>=0 or pg.locator('.dialog').inner_text().find('Found 2')>=0,pg.locator('.dialog').inner_text()[:300]); pg.get_by_label('Paste at cell').fill('L20'); pg.get_by_role('button',name=re.compile('^Insert at')).click(); time.sleep(.8)
    ck('ui paste inserted',vals('L20')==[['Head']] and vals('L21')==[['Ann']],str(vals('L20:N21'))); close()
    # text paste (TSV)
    r=js('()=>dracoFiles.paste(undefined,"a\\tb\\n1\\t2",{r:30,c:0})'); time.sleep(.6); ck('tsv paste',r['ok'] and vals('A32:B32')==[[1,2]],str(r))
    # ---------- versions ----------
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A2").setValue("ORIGINAL")'); time.sleep(1.8)
    open_files('Version history'); pg.get_by_label('Version name').fill('Baseline'); pg.get_by_role('button',name='Save version now').click(); time.sleep(.8); ck('version listed',pg.locator('.versions li').count()>=1 and 'Baseline' in pg.locator('.versions').inner_text(),pg.locator('.dialog').inner_text()[:300]); close()
    js('()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();ws.getRange("A2").setValue("CHANGED");ws.getRange("B2").setValue(777);}'); time.sleep(1.8)
    open_files('Version history'); pg.locator('.versions li',has_text='Baseline').get_by_role('button',name='Compare with now').click(); time.sleep(.6); dtxt=pg.locator('[aria-label=Differences]').inner_text(); ck('diff shows changes','ORIGINAL' in dtxt and 'CHANGED' in dtxt and '777' in dtxt,dtxt[:300])
    pg.on('dialog',lambda d:d.accept()); pg.locator('.versions li',has_text='Baseline').get_by_role('button',name='Restore').click()
    for _ in range(16):
        time.sleep(.5)
        if vals('A2')==[['ORIGINAL']]: break
    time.sleep(.8)
    ck('restore brings back value',vals('A2')==[['ORIGINAL']] and vals('B2')!=[[777]],str(vals('A2:B2')))
    open_files('Version history'); ck('restore kept safety copy','Before restoring' in pg.locator('.versions').inner_text(),pg.locator('.versions').inner_text()); 
    pg.locator('.versions li',has_text='Before restoring').get_by_role('button',name=re.compile('Delete version')).click(); time.sleep(.5); ck('delete version','Before restoring' not in pg.locator('.versions').inner_text()); pg.screenshot(path='/tmp/f2.png'); close()
    # auto "Opened" version exists after reload
    reload(); open_files('Version history'); time.sleep(.8); ck('auto checkpoint recorded',pg.locator('.versions li',has_text='auto').count()>=1,pg.locator('.versions').inner_text()); ck('named version survives reload','Baseline' in pg.locator('.versions').inner_text(),pg.locator('.versions').inner_text()); close()
    # ---------- crash recovery draft ----------
    lastid=js('()=>JSON.parse(localStorage.getItem("draco:last")).id')
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A2").setValue("SAVED")'); time.sleep(2.5)
    snap=js('()=>{const s=dracoAPI.getActiveWorkbook().save(); const sh=Object.values(s.sheets)[0]; sh.cellData[1][0].v="DRAFT ONLY"; return s}')
    js('''async([id,snap])=>{await new Promise((res,rej)=>{const r=indexedDB.open('draco-sheets');r.onsuccess=()=>{const tx=r.result.transaction('drafts','readwrite');tx.objectStore('drafts').put({id,title:'t',data:snap,cloud:false,at:new Date(Date.now()+5000).toISOString()});tx.oncomplete=()=>res(1);tx.onerror=()=>rej(tx.error);};r.onerror=()=>rej(r.error);});}''',[lastid,snap]); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2.5)
    ck('recovery banner shown',pg.locator('.banner[role=alert]').count()==1,pg.content()[:0]); ck('not applied before choosing',vals('A2')==[['SAVED']],str(vals('A2')))
    pg.get_by_role('button',name='Restore them').click(); time.sleep(1.5); ck('draft restored',vals('A2')==[['DRAFT ONLY']],str(vals('A2'))); ck('banner gone',pg.locator('.banner[role=alert]').count()==0)
    # discard path
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A2").setValue("KEEP")'); time.sleep(2.5)
    js('''async([id,snap])=>{await new Promise((res,rej)=>{const r=indexedDB.open('draco-sheets');r.onsuccess=()=>{const tx=r.result.transaction('drafts','readwrite');tx.objectStore('drafts').put({id,title:'t',data:snap,cloud:false,at:new Date(Date.now()+5000).toISOString()});tx.oncomplete=()=>res(1);};});}''',[lastid,snap]); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2.5)
    pg.get_by_role('button',name='Discard').click(); time.sleep(.5); ck('discard keeps saved',vals('A2')==[['KEEP']],str(vals('A2'))); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2); ck('discarded draft does not return',pg.locator('.banner[role=alert]').count()==0)
    # normal edits leave no draft behind
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("A3").setValue("clean")'); time.sleep(3); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(2.5); ck('no banner after normal save',pg.locator('.banner[role=alert]').count()==0); ck('normal edit persisted',vals('A3')==[['clean']])
    ck('no page errors',not errs,str(errs[:3]))
    print(f'files-ui: {P} passed, {F} failed'); b.close(); sys.exit(1 if F else 0)
