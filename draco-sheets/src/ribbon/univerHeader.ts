import type { RibbonTab } from './types';
/** Univer draws its own tab strip + toolbar. Our tabs replace the strip; its toolbar (clipboard, font, alignment…) is shown on Home only. */
export function syncUniverHeader(tab: RibbonTab): void {
  const header = document.querySelector('main.grid header') as HTMLElement | null;
  if (header) { for (const ch of Array.from(header.children) as HTMLElement[]) ch.dataset.dracoU = ch.querySelector('[class*="univer-toolbar"]') ? 'toolbar' : 'strip'; header.dataset.dracoHome = tab === 'Home' ? '1' : '0'; }
  window.dispatchEvent(new Event('resize'));
}
