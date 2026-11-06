// Kill switch: earlier versions registered a service worker here. This replacement removes itself and its caches
// so returning visitors stop seeing a cached old build. Safe to leave in place.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  try { for (const k of await caches.keys()) await caches.delete(k); } catch (_) {}
  try { await self.registration.unregister(); } catch (_) {}
  try { for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url); } catch (_) {}
})()));
