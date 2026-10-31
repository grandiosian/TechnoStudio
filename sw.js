/* TechnoStudio — service worker : l'appli s'ouvre et fonctionne sans réseau.
   Seuls les fichiers de l'appli (même origine) sont mis en cache : la Centrale et le serveur
   de compilation passent toujours par le réseau. */
const CACHE = 'technostudio-v3.3.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './ateliers.json', './css/app.css', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/core.js', './js/gift.js', './js/descriptor.js', './js/passerelle.js', './js/activities.js', './js/circuit.js', './js/blocks.js', './js/sheet.js', './js/code.js', './js/demos.js', './js/demos2.js', './js/flash.js', './js/centrale.js', './js/panels.js', './js/editor.js', './js/editor2.js', './js/app.js',
  './vendor/pdf.min.js', './vendor/pdf.worker.min.js', './vendor/esptool/esptool.js',
  './vendor/blockly/blockly_compressed.js', './vendor/blockly/blocks_compressed.js', './vendor/blockly/python_compressed.js', './vendor/blockly/fr.js',
  './vendor/blockly/media/sprites.png', './vendor/blockly/media/sprites.svg'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.includes('/api/')) return;
  if (url.origin !== location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  // polices et ressources externes : cache d'abord, puis réseau
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((r) => {
      if (r && (r.ok || r.type === 'opaque')) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined));
    return hit ? (net.catch(() => hit), hit) : net;
  }));
});
