// Service Worker CVC Maintenance – Argosynergie
// Rôle : mettre l'appli en cache pour qu'elle s'ouvre même sans réseau.
// Stratégie : "network-first" pour index.html (on prend la version à jour si le
// réseau répond, sinon on sert la version en cache). Cache-first pour le reste.

var CACHE_NOM = 'cvc-maintenance-v1';
var FICHIERS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Installation : on met en cache les fichiers de base
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NOM).then(function(cache) {
      return cache.addAll(FICHIERS).catch(function(){ /* certains fichiers peuvent manquer, pas grave */ });
    })
  );
  self.skipWaiting();
});

// Activation : on nettoie les anciens caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(cles) {
      return Promise.all(cles.map(function(cle) {
        if (cle !== CACHE_NOM) return caches.delete(cle);
      }));
    })
  );
  self.clients.claim();
});

// Interception des requêtes
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  // On ne touche pas aux requêtes vers Supabase / CDN (elles doivent aller au réseau)
  if (url.indexOf('supabase') !== -1 || url.indexOf('jsdelivr') !== -1 || url.indexOf('cdn') !== -1) {
    return; // laisser le navigateur gérer normalement
  }

  // Pour la navigation (index.html) : network-first, fallback cache
  if (e.request.mode === 'navigate' || url.indexOf('index.html') !== -1 || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).then(function(reponse) {
        // Mettre à jour le cache avec la version fraîche
        var copie = reponse.clone();
        caches.open(CACHE_NOM).then(function(cache) { cache.put(e.request, copie); });
        return reponse;
      }).catch(function() {
        // Pas de réseau → on sert la version en cache
        return caches.match(e.request).then(function(c) {
          return c || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Pour le reste (icônes, manifest) : cache-first
  e.respondWith(
    caches.match(e.request).then(function(c) {
      return c || fetch(e.request).then(function(reponse) {
        var copie = reponse.clone();
        caches.open(CACHE_NOM).then(function(cache) { cache.put(e.request, copie); });
        return reponse;
      });
    }).catch(function(){ return caches.match('./index.html'); })
  );
});
