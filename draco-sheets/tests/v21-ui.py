# Browser tests v1.2.0: Excel-style Tables (structured refs, auto-expand, total row, rename, slicers, dialog)
import time
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:4174/app'); pg.wait_for_function('window.dracoTables',timeout=60000); time.sleep(2); js=pg.evaluate
    def val(a): return js("(a)=>String(dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).getValue())",a)
    def fml(a): return js("(a)=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).getFormula()",a)
    def setf(a,f,r,c): js("([a,f,r,c])=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange(a).setFormula(f)}",[a,f,r,c]); time.sleep(.3); js("([r,c])=>dracoTables.onEdit('Sheet1',r,c)",[r,c]); time.sleep(1.2)
    js("""()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('A1:C6').setValues([['Region','Units','Net Amt'],['East',10,100],['West',20,200],['East',30,300],['North',40,400],['West',50,500]]); ws.getRange('A1:C6').activate();}""")
    time.sleep(.5)
    r=js("()=>dracoTables.create({name:'Sales'})"); ck('create table',r['ok'] and r['table']['name']=='Sales',r)
    ck('listed',len(js("()=>dracoTables.list()"))==1)
    r=js("()=>dracoTables.create({name:'Sales'})"); ck('overlap refused',not r['ok'] and 'overlaps' in r['message'],r)
    js("()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange('F1:F2').setValues([['x'],['y']]); dracoAPI.getActiveWorkbook().getActiveSheet().getRange('F1:F2').activate()"); r=js("()=>dracoTables.create({name:'Sales'})"); ck('duplicate name refused',not r['ok'] and 'already exists' in r['message'],r)
    setf('E1','=SUM(Sales[Units])',0,4); ck('SUM(Sales[Units]) = 150',val('E1')=='150',val('E1')); ck('stored as A1',fml('E1')=='=SUM($B$2:$B$6)',fml('E1'))
    setf('E2','=COUNTA(Sales[Region])',1,4); ck('COUNTA region = 5',val('E2')=='5')
    # auto-expand
    js("()=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A7:C7').setValues([['South',60,600]])}"); time.sleep(.3); js("()=>dracoTables.onEdit('Sheet1',6,1)"); time.sleep(1.5)
    t=js("()=>dracoTables.list()[0]"); ck('table grew to row 7 (r1=6)',t['r1']==6,t); ck('SUM follows growth = 210',val('E1')=='210',val('E1')); ck('formula re-resolved',fml('E1')=='=SUM($B$2:$B$7)',fml('E1'))
    # calculated column: header typed right of table, then [@Units]
    js("()=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange('D1').setValue('Double')}"); time.sleep(.3); js("()=>dracoTables.onEdit('Sheet1',0,3)"); time.sleep(1)
    t=js("()=>dracoTables.list()[0]"); ck('header right of table adds a column',t['c1']==3 and t['headers'][-1]=='Double',t)
    setf('D2','=[@Units]*2',1,3); ck('[@Units]*2 on row 2 = 20',val('D2')=='20',val('D2')); ck('resolved to cell ref',fml('D2')=='=$B$2*2',fml('D2'))
    js("()=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange('A8:B8').setValues([['North',70]])}"); time.sleep(.3); js("()=>dracoTables.onEdit('Sheet1',7,1)"); time.sleep(1.5)
    ck('row 8 absorbed',js("()=>dracoTables.list()[0]")['r1']==7); ck('calculated column filled down (D8 = 140)',val('D8')=='140',[val('D8'),fml('D8')])
    # bad refs
    setf('E3','=SUM(Sales[Nope])',2,4); ck('bad column does not crash',True)
    # total row
    r=js("()=>dracoTables.totalRow(dracoTables.list()[0].id,true)"); ck('total row on',r['ok'],r); time.sleep(1.5)
    t=js("()=>dracoTables.list()[0]"); ck('r1 moved to total row (r1=8)',t['r1']==8 and t['totalRow'],t)
    ck('Total label',val('A9')=='Total'); ck('Units total = 280 (sum)',val('B9')=='280',[val('B9'),fml('B9')]); ck('SUBTOTAL used',fml('B9').startswith('=SUBTOTAL(109'),fml('B9'))
    ck('E1 excludes total row (280)',val('E1')=='280',val('E1'))
    r=js("()=>dracoTables.totalFn(dracoTables.list()[0].id,1,'average')"); time.sleep(1.2); ck('switch to average = 40',r['ok'] and val('B9')=='40',val('B9'))
    # rename
    r=js("()=>dracoTables.rename(dracoTables.list()[0].id,'Orders')"); time.sleep(1.2); ck('rename ok',r['ok'],r); ck('formulas keep working after rename',val('E1')=='280',val('E1'))
    r=js("()=>dracoTables.rename(dracoTables.list()[0].id,'A1')"); ck('cell-like name refused',not r['ok'],r)
    # header rename
    js("()=>{dracoAPI.getActiveWorkbook().getActiveSheet().getRange('B1').setValue('Qty')}"); time.sleep(.3); js("()=>dracoTables.onEdit('Sheet1',0,1)"); time.sleep(1.5)
    ck('header renamed in table',js("()=>dracoTables.list()[0].headers[1]")=='Qty'); ck('formulas follow header rename',val('E1')=='280' and val('D3')=='40',[val('E1'),val('D3')])
    # slicer
    r=js("()=>dracoTables.addSlicer(dracoTables.list()[0].id,'Region')"); ck('slicer added',r['ok'],r); time.sleep(1)
    ck('slicer buttons rendered (4 regions)',pg.locator('.draco-slicer button[aria-pressed]').count()>=4,pg.locator('.draco-slicer button[aria-pressed]').count())
    tid=js("()=>dracoTables.list()[0].id"); js("(id)=>dracoTables.click(id,'Region','East',false)",tid); time.sleep(1)
    hid=js("()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); return [1,2,3,4,5,6,7].map(r=>(!ws.getSheet().getRowManager().getRowRawVisible(r)))}"); ck('only East rows visible (rows 2,4 shown)',hid==[False,True,False,True,True,True,True],hid)
    js("(id)=>dracoTables.click(id,'Region','*',false)",tid); time.sleep(1); ck('clear slicer shows all',not any(js("()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); return [1,2,3,4,5,6,7].map(r=>(!ws.getSheet().getRowManager().getRowRawVisible(r)))}")))
    r=js("(id)=>dracoTables.addSlicer(id,'Region')",tid); ck('duplicate slicer refused',not r['ok'],r)
    r=js("(id)=>dracoTables.addSlicer(id,'Nope')",tid); ck('unknown column refused',not r['ok'],r)
    # persistence round trip (registry rides in the saved snapshot)
    n=js("()=>dracoTables.saveLoad(false)"); ck('tables resource is saved with the workbook',len(n)==1 and n[0]>200,n)
    before=js("()=>dracoTables.list()[0]"); js("()=>dracoTables.saveLoad(true)"); after=js("()=>dracoTables.list()[0]")
    ck('table survives save/load',before==after,[before,after]); js("()=>dracoTables.refresh()"); time.sleep(.8); ck('structured formulas still resolve after load',val('E1')=='280',val('E1'))
    # resize + convert
    r=js("(id)=>dracoTables.update(id,{style:2,banded:false})",tid); ck('style change ok',r['ok'],r)
    r=js("(id)=>dracoTables.toRange(id)",tid); time.sleep(.8); ck('convert to range',r['ok'] and js("()=>dracoTables.list()")==[],r); ck('values survive conversion',val('E1')=='280',val('E1'))
    ck('slicer removed with table',pg.locator('.draco-slicer').count()==0)
    # dialog
    js("()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet(); ws.getRange('A12:B15').setValues([['Item','Cost'],['a',1],['b',2],['c',3]]); ws.getRange('A12:B15').activate()}"); time.sleep(.4)
    pg.evaluate("()=>dracoCmd.run('open.macros')"); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='Tables',exact=True).click(); time.sleep(.3)
    ck('Tables tab visible',pg.locator('input[aria-label="New table name"]').count()==1)
    pg.fill('input[aria-label="New table name"]','Costs'); pg.select_option('select[aria-label="New table style"]','2'); pg.get_by_role('button',name='Create table').click(); time.sleep(.8)
    ck('dialog created Costs',pg.locator('.dialog .okmsg').count()==1 and js("()=>dracoTables.list().map(t=>t.name)")==['Costs'],pg.locator('.dialog').inner_text()[-200:])
    ck('table manage section appears',pg.locator('select[aria-label="Choose table"]').count()==1 and pg.locator('input[aria-label="Table total row"]').count()==1)
    pg.locator('input[aria-label="Table total row"]').check(); time.sleep(1); ck('dialog total row on',js("()=>dracoTables.list()[0].totalRow")==True)
    ck('per-column total selector appears',pg.locator('select[aria-label="Total for Cost"]').count()==1)
    pg.fill('input[aria-label="Rename table"]','Expenses'); pg.locator('.dialog button:text-is("Rename")').last.click(); time.sleep(.8); ck('dialog rename',js("()=>dracoTables.list()[0].name")=='Expenses')
    pg.keyboard.press('Escape'); time.sleep(.3)
    ck('no page errors',not errs,errs[:2]); b.close()
print(f'v21-ui: {P} passed, {F} failed')
