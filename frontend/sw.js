// Service worker: guarda o "casco" do site para abrir sem internet. Dados (/api) nunca ficam em cache aqui.
const V = 'vm-v16', SHELL = ['/', '/entrar.html', '/painel.html', '/css/base.css', '/css/home.css', '/css/app.css',
  '/js/home.js', '/js/entrar.js', '/js/painel.js', '/js/qrcode.js', '/manifest.webmanifest', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('/painel.html'))));
});
