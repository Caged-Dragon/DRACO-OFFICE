"""Performance benchmark: fill N rows x 10 cols, add formulas, measure main-thread responsiveness."""
import sys, json
from playwright.sync_api import sync_playwright
N = int(sys.argv[1]) if len(sys.argv) > 1 else 50000
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1440, "height": 900})
    pg.goto("http://localhost:4174/", wait_until="networkidle")
    pg.wait_for_function("window.dracoAPI && window.dracoAPI.getActiveWorkbook()"); pg.wait_for_timeout(1000)
    r = pg.evaluate("""async (N) => {
      const api = window.dracoAPI, sh = api.getActiveWorkbook().getActiveSheet();
      sh.setRowCount?.(N + 10);
      const t0 = performance.now();
      const vals = Array.from({length:N}, (_, i) => Array.from({length:10}, (_, c) => (i*7 + c*13) % 1000));
      sh.getRange(0,0,N,10).setValues(vals);
      const tFill = performance.now() - t0;
      // formulas in col L: running ops over each row
      const t1 = performance.now();
      const f = Array.from({length:N}, (_, i) => ['=SUM(A'+(i+1)+':J'+(i+1)+')*2']);
      sh.getRange(0,11,N,1).setFormulas(f);
      const tSet = performance.now() - t1;
      // main-thread jank probe: how long until a rAF tick fires while worker calculates?
      let maxGap = 0, last = performance.now(); const t2 = performance.now();
      await new Promise(res => { function tick(){ const n = performance.now(); maxGap = Math.max(maxGap, n-last); last = n; if (n - t2 < 2500) requestAnimationFrame(tick); else res(); } requestAnimationFrame(tick); });
      await new Promise(x => setTimeout(x, 1500));
      const last_val = sh.getRange(N-1, 11).getValue();
      const expect = ((N-1)*7*10 + (0+13+26+39+52+65+78+91+104+117)) ;
      return { N, fillMs: Math.round(tFill), formulaSetMs: Math.round(tSet), maxFrameGapMs: Math.round(maxGap), lastValue: last_val, firstValue: sh.getRange(0,11).getValue() };
    }""", N)
    print(json.dumps(r))
    b.close()
