// Script minimal requis pour que l'appli puisse s'installer (écran d'accueil,
// plein écran). Aucune mise en cache : tout vient toujours du réseau, pour ne
// jamais afficher une ancienne version de l'appli.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
