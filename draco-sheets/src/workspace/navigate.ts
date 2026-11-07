/** Client-side navigation between the site pages and the editor (the site router listens for popstate). */
export function goTo(path: string): void { history.pushState(null, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
