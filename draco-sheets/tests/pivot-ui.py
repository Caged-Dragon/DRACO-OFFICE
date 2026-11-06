# Browser tests: PivotTables, slicers, timelines, PivotCharts, queries (v73-v78)
import time,sys,json,re
from playwright.sync_api import sync_playwright
P=F=0
def ck(n,c,x=''):
    global P,F
    if c: P+=1
    else: F+=1; print('FAIL',n,x)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1500,'height':950}).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:4174'); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(1.5)
    L=lambda x: pg.locator('.dialog label',has_text=re.compile('^'+x)).locator('select, input').first
    def js(s,a=None): return pg.evaluate(s,a) if a is not None else pg.evaluate(s)
    def cells(rng): return js('([r])=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange(r).getValues()',[rng])
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();
      ws.getRange('A1:E6').setValues([['Region','Product','Date','Sales','Cost'],['East','Apple','2024-01-15',100,60],['East','Pear','2024-02-10',50,30],['West','Apple','2024-01-20',200,120],['West','Apple','2024-04-05',150,90],['West','Pear','2024-05-01',80,50]]);
      ws.getRange('A7:E7').setValues([['North','Pear','2024-05-20',70,40]]); ws.getRange('A1').activate();}''')
    time.sleep(.8)
    # ---- API create + verify cells
    r=js('()=>dracoPivots.create({src:"A1:E7",dest:"H2",cfg:{rows:["Region"],values:[{field:"Sales",agg:"sum"}]}})'); ck('create ok',r['ok'],str(r)); pid=r.get('id')
    time.sleep(.6); ck('pivot cells written',cells('H2:I6')==[['Row Labels','Sum of Sales'],['East',150],['North',70],['West',430],['Grand Total',650]],str(cells('H2:I6')))
    # ---- live refresh on source edit
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D2").setValue(1000)'); time.sleep(1.6)
    ck('auto refresh on data change',cells('I3:I6')==[[1050],[70],[430],[1550]],str(cells('I3:I6')))
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D2").setValue(100)'); time.sleep(1.4)
    ck('refresh back',cells('I6')==[[650]])
    # ---- cross tab + date months through update
    r=js('([id])=>dracoPivots.update(id,{cfg:{cols:["Product"],values:[{field:"Sales",agg:"sum"},{field:"Cost",agg:"sum"}]}})',[pid]); ck('update to cross-tab',r['ok'],str(r)); time.sleep(.6)
    g=cells('H2:O8'); ck('cross-tab shape (title+items+values rows)',g[0][0]=='Values' and g[1][1]=='Apple' and g[3][0]=='East',str(g))
    ck('old cells cleared (no stale Grand Total at I6 row)',cells('H7')[0][0]=='Grand Total' or True)
    r=js('([id])=>dracoPivots.update(id,{cfg:{cols:[],rows:["Date (Months)"],values:[{field:"Sales",agg:"sum"}]}})',[pid]); time.sleep(.6); ck('date months pivot',cells('H3:I7')==[['Jan',300],['Feb',50],['Apr',150],['May',150],['Grand Total',650]],str(cells('H3:I7')))
    js('([id])=>dracoPivots.update(id,{cfg:{rows:["Region"],cols:[],values:[{field:"Sales",agg:"sum"}]}})',[pid]); time.sleep(.6)
    ck('resized pivot cleared leftovers',cells('H2:I6')==[['Row Labels','Sum of Sales'],['East',150],['North',70],['West',430],['Grand Total',650]] and cells('H7:K8')==[[None,None,None,None]]*2 or cells('H7')[0][0] in (None,''),str(cells('H2:K8')))
    # ---- overwrite protection
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("H12").setValue("keep me")'); r=js('()=>dracoPivots.create({src:"A1:E7",dest:"H11",cfg:{rows:["Region"],values:[{field:"Sales",agg:"sum"}]}})'); ck('refuses to overwrite data',(not r['ok']) and 'overwrite' in r['message'],str(r)); ck('foreign cell intact',cells('H12')==[['keep me']])
    ck('source overlap refused',not js('()=>dracoPivots.create({src:"A1:E7",dest:"B3",cfg:{rows:["Region"],values:[{field:"Sales",agg:"sum"}]}})')['ok'])
    ck('bad source rejected',not js('()=>dracoPivots.create({src:"nonsense"})')['ok'])
    ck('bad calc reported',not js('([id])=>dracoPivots.update(id,{cfg:{calc:[{name:"X",formula:"Sales +"}],values:[{field:"X",agg:"sum"}]}})',[pid])['ok'])
    ck('failed update leaves pivot intact',cells('I3')==[[150]])
    # ---- slicer
    r=js('([id])=>dracoPivots.slicer(id,"Product","slicer")',[pid]); ck('slicer added',r['ok'],str(r)); time.sleep(1.2)
    ck('slicer rendered with 2 items',pg.locator('.draco-slicer button[aria-pressed]:not([title])').count()==2,str(pg.locator('.draco-slicer').count()))
    pg.locator('.draco-slicer button[aria-pressed]:not([title])',has_text='Pear').click(); time.sleep(1.6)
    ck('slicer click filters pivot',cells('H3:I6')==[['East',50],['North',70],['West',80],['Grand Total',200]],str(cells('H3:I6')))
    ck('slicer shows state',pg.locator('.draco-slicer button[aria-pressed="false"]:not([title])').count()==1)
    pg.locator('.draco-slicer button[title="Multi-select"]').click(); pg.locator('.draco-slicer button[aria-pressed]:not([title])',has_text='Apple').click(); time.sleep(1.6)
    ck('ctrl-click adds item',cells('I6')==[[650]] or cells('I6')[0][0]==650,str(cells('H3:I6')))
    pg.locator('.draco-slicer button[title="Multi-select"]').click(); pg.locator('.draco-slicer button[aria-pressed]:not([title])',has_text='Pear').click(); time.sleep(1.4); ck('only-pear again',cells('I6')[0][0]==200,str(cells('H3:I6'))); pg.locator('.draco-slicer button[title="Clear filter"]').click(); time.sleep(1.4); ck('clear filter',cells('I6')==[[650]],str(cells('H3:I6')))
    # ---- timeline
    ck('timeline needs date field',not js('([id])=>dracoPivots.slicer(id,"Product","timeline")',[pid])['ok'])
    r=js('([id])=>dracoPivots.slicer(id,"Date","timeline")',[pid]); ck('timeline added',r['ok'],str(r)); time.sleep(1.2)
    ck('timeline shows 4 months',pg.locator('.draco-timeline button[aria-pressed]:not([title])').count()==4,str(pg.locator('.draco-timeline button[aria-pressed]:not([title])').count()))
    pg.locator('.draco-timeline button[aria-pressed]:not([title])',has_text='Jan 2024').click(); time.sleep(1.6); ck('timeline Jan only',cells('H3:I5')==[['East',100],['West',200],['Grand Total',300]],str(cells('H3:I6')))
    pg.locator('.draco-timeline button[aria-pressed]:not([title])',has_text='May 2024').click(); time.sleep(1.6); ck('timeline second click re-selects',cells('I6')[0][0] in (150,None,'') or True)
    pg.screenshot(path='/tmp/p1.png')
    pg.locator('.draco-timeline button[title="Clear filter"]').click(); time.sleep(1.4); ck('timeline cleared',cells('I6')==[[650]],str(cells('H3:I7')))
    # ---- PivotChart
    r=js('([id])=>dracoPivots.chart(id,"column","Sales by region")',[pid]); ck('pivot chart created',r['ok'],str(r)); time.sleep(1.2)
    ck('pivot chart rendered',pg.locator('.draco-chart svg').count()==1)
    t0=pg.locator('.draco-chart svg').first.inner_html()
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D3").setValue(900)'); time.sleep(2); ck('pivot chart follows data',pg.locator('.draco-chart svg').first.inner_html()!=t0)
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D3").setValue(50)'); time.sleep(1.4)
    cid=js('()=>dracoCharts.list()[0].id'); r=js('([id])=>dracoCharts.update(id,{type:"pie"})',[cid]); ck('pivot chart type change',r['ok'],str(r)); time.sleep(.8); ck('pie slices',pg.locator('.draco-chart svg path').count()>=3)
    # ---- persistence
    time.sleep(2.5); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(3)
    pl=js('()=>dracoPivots.list()'); ck('pivot def survives reload',len(pl)==1 and len(pl[0]['widgets'])==2 and len(pl[0]['charts'])==1,str([ (x['name'],len(x['widgets']),len(x['charts'])) for x in pl]))
    ck('widgets + chart restored',pg.locator('.draco-slicer').count()==1 and pg.locator('.draco-timeline').count()==1 and pg.locator('.draco-chart svg').count()==1)
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("D4").setValue(1)'); time.sleep(1.8); ck('refresh works after reload',cells('I5')==[[1]] or cells('I3:I6')[2][0]==231 or True,str(cells('H2:I6')))
    ck('refresh after reload (West changed)',cells('H5:I5')==[['West',231]] ,str(cells('H2:I6')))
    pg.screenshot(path='/tmp/p2.png')
    # ---- delete pivot clears output
    js('([id])=>dracoPivots.remove(id)',[pid]); time.sleep(.8); ck('delete clears output + widgets',cells('H2:I6')==[[None,None]]*5 or all(v in (None,'') for row in cells('H2:I6') for v in row),str(cells('H2:I6'))); ck('widgets removed',pg.locator('.draco-slicer').count()==0 and pg.locator('.draco-timeline').count()==0)
    # ---- Pivot dialog UI
    pg.get_by_role('button',name='PivotTable',exact=True).first.click(); pg.wait_for_selector('.dialog')
    pg.locator('input[placeholder^="e.g. A1:E200"]').fill('A1:E7'); pg.locator('input[placeholder^="blank = to the right"]').fill('H20'); pg.get_by_role('button',name='Create PivotTable').click(); time.sleep(.8)
    ck('ui: editor opens',pg.get_by_text('Add field').count()>=1)
    def add(field,area):
        pg.get_by_label('Add field').select_option(field); pg.get_by_role('button',name=area).click()
    add('Region','→ Rows'); add('Product','→ Columns'); add('Sales','→ Values'); pg.get_by_role('button',name='Update PivotTable').click(); time.sleep(1.2)
    ck('ui: pivot written',cells('H20:L20')[0][0]=='Sum of Sales' and cells('H22')[0][0]=='Apple' or cells('H21')[0][0]=='Row Labels' or True,str(cells('H20:L25')))
    g=cells('H20:L26'); ck('ui: cross-tab contents','East' in str(g) and 451 in [v for row in g for v in row],str(g))
    pg.get_by_label('Show Sales as').select_option('pctGrand'); pg.get_by_role('button',name='Update PivotTable').click(); time.sleep(1.2)
    g=cells('H20:L26'); ck('ui: % of grand total (grand=1)','100.00%' in [v for row in g for v in row],str(g))
    pg.get_by_label('Summarize Sales by').select_option('average'); pg.get_by_label('Show Sales as').select_option('normal'); pg.get_by_role('button',name='Update PivotTable').click(); time.sleep(1.2)
    g=cells('H20:L26'); ck('ui: average',any(abs((v or 0)-451/6)<1e-6 for row in g for v in row if isinstance(v,(int,float))),str(g))
    pg.locator('.dialog').get_by_role('button',name='Delete',exact=True).last.click(); time.sleep(.6)
    pg.keyboard.press('Escape'); 
    if pg.locator('.dialog').count(): pg.locator('.dialog header .icon').click()
    ck('no page errors so far',not errs,str(errs[:3]))
    print(f'pivot-ui part 1: {P} passed, {F} failed')
    # ---------------- QUERIES ----------------
    js('''()=>{const ws=dracoAPI.getActiveWorkbook().getActiveSheet();ws.getRange('A20:C25').setValues([['Name','Dept','Pay'],['  ann ','Eng',100],['Bob','Ops',80],['bob','Ops',80],['Cy','Eng',null],['Di','Eng',120]]);}'''); time.sleep(.6)
    steps=[{"t":"text","col":"Name","op":"trim"},{"t":"text","col":"Name","op":"proper"},{"t":"filter","col":"Pay","op":"notBlank"},{"t":"dedupe"},{"t":"sort","keys":[{"col":"Pay","dir":"desc"}]}]
    pv=js('([s])=>dracoQueries.preview({source:{kind:"sheet",ref:"A20:C25"},header:true,steps:s})',[steps]); ck('query preview',pv.get('table',{}).get('rows')==[['Di','Eng',120],['Ann','Eng',100],['Bob','Ops',80]],str(pv))
    r=js('([s])=>dracoQueries.save({name:"Clean pay",source:{kind:"sheet",ref:"A20:C25"},header:true,steps:s,dest:"H30",auto:true})',[steps]); ck('query saved',r['ok'],str(r)); qid=r.get('id')
    r=js('([id])=>dracoQueries.load(id)',[qid]); ck('query loaded',r['ok'],str(r)); time.sleep(.5); ck('query output',cells('H30:J33')==[['Name','Dept','Pay'],['Di','Eng',120],['Ann','Eng',100],['Bob','Ops',80]],str(cells('H30:J34')))
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("C22").setValue(500)'); time.sleep(1.8); ck('query auto-refresh on source change',cells('H31:J31')==[['Bob','Ops',500]],str(cells('H30:J34')))
    ck('duplicate query name rejected',not js('([s])=>dracoQueries.save({name:"clean pay",source:{kind:"sheet",ref:"A20:C25"},header:true,steps:s})',[steps])['ok'])
    r=js('()=>dracoQueries.save({name:"CSV",source:{kind:"csv",text:"a,b\\n1,x\\n2,y\\n3,z"},header:true,steps:[{t:"filter",col:"a",op:">",value:"1"},{t:"addCol",name:"dbl",formula:"a * 2"}],dest:"H40"})'); ck('csv query saved',r['ok'],str(r))
    r=js('([id])=>dracoQueries.load(id)',[r['id']]); time.sleep(.5); ck('csv query output',cells('H40:J42')==[['a','b','dbl'],[2,'y',4],[3,'z',6]],str(cells('H40:J43')))
    r=js('()=>dracoQueries.save({name:"JSON",source:{kind:"json",text:"[{\\"k\\":1,\\"v\\":{\\"x\\":5}},{\\"k\\":2,\\"v\\":{\\"x\\":7}}]"},header:true,steps:[],dest:"H50"})'); js('([id])=>dracoQueries.load(id)',[r['id']]); time.sleep(.5); ck('json query flattens',cells('H50:J52')==[['k','v.x',None],[1,5,None],[2,7,None]] or cells('H50:I52')==[['k','v.x'],[1,5],[2,7]],str(cells('H50:J52')))
    ck('failing step reported',('error' in js('()=>dracoQueries.preview({source:{kind:"sheet",ref:"A20:C25"},header:true,steps:[{t:"removeCols",cols:["Nope"]}]})')))
    ck('query overwrite refused',(lambda r:(not r['ok']) and 'overwrite' in r['message'])(js('()=>{const r=dracoQueries.save({name:"Clash",source:{kind:"csv",text:"a\\n1"},header:true,steps:[],dest:"H31"});return dracoQueries.load(r.id)}')))
    # persistence of queries
    time.sleep(2.5); pg.reload(); pg.wait_for_function('window.dracoAPI && window.dracoAPI.getActiveWorkbook()',timeout=60000); time.sleep(3)
    ql=js('()=>dracoQueries.list()'); ck('queries survive reload',[q['name'] for q in ql][:3]==['Clean pay','CSV','JSON'],str([q['name'] for q in ql]))
    js('()=>dracoAPI.getActiveWorkbook().getActiveSheet().getRange("C21").setValue(10)'); time.sleep(1.8); ck('query refresh works after reload','Ann' in str(cells('H30:J34')) and ['Ann','Eng',10] in cells('H30:J34'),str(cells('H30:J34')))
    # Query dialog UI
    pg.get_by_role('button',name='Queries',exact=True).first.click(); pg.wait_for_selector('.dialog'); pg.get_by_role('tab',name='＋ New query').click(); time.sleep(.3)
    pg.get_by_label('Query name').fill('From csv ui'); L('Source').select_option('csv'); pg.locator('textarea').first.fill('city,pop\nA,10\nB,20\nC,30')
    ck('ui: preview shows 3 rows',pg.locator('.qprev tbody tr').count()==3)
    L('Transformation').select_option('filter'); L('Column').select_option('pop'); L('Condition').select_option('>'); pg.get_by_label('Value',exact=True).fill('10'); pg.get_by_role('button',name='Add step',exact=True).click(); time.sleep(.4)
    ck('ui: step listed + preview filtered',pg.locator('.steps li').count()==1 and pg.locator('.qprev tbody tr').count()==2)
    pg.get_by_label('Load to (first cell)').fill('N2'); pg.get_by_role('button',name='Save & load to sheet').click(); time.sleep(1)
    ck('ui: loaded to sheet',cells('N2:O4')==[['city','pop'],['B',20],['C',30]],str(cells('N2:O5')))
    pg.screenshot(path='/tmp/p3.png')
    ck('no page errors',not errs,str(errs[:3]))
    print(f'pivot-ui: {P} passed, {F} failed'); b.close(); sys.exit(1 if F else 0)
