// Service worker minimal : uniquement présent pour rendre l'espace admin installable en PWA
// (Chrome/Edge exigent un service worker actif avec un gestionnaire "fetch" pour ça) — aucune
// mise en cache hors-ligne volontairement, un panel admin doit toujours refléter des données à
// jour, jamais une version mise en cache.
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', () => { /* laisse passer au réseau, pas de cache */ });
