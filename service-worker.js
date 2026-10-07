// fibro-v28: supabase.js laadt nu supabase-lib.js uit de eigen repo. Een nieuwe
// CACHE_VERSION gooit alle oude scriptkopieen weg, zodat iedereen de nieuwe ophaalt.
// v30 (zonder nieuwe CACHE_VERSION): html-pagina's worden ook bewaard, voor als er
// geen internet is. Zie hieronder bij 'Html-pagina's'.
// fibro-v30: supabase.js wacht zonder internet niet meer op een verlopen inlogpas.
// supabase.js wordt bijna overal geladen (?v=95); een nieuwe CACHE_VERSION zorgt dat
// iedereen de nieuwe ophaalt. kastvullen.js vult de kast daarna vanzelf weer aan.
const CACHE_VERSION = 'fibro-v30'

self.addEventListener('install', function(event) {
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(keys =>
    Promise.all(keys
    .filter(key => key !== CACHE_VERSION)
    .map(key => caches.delete(key)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', function(event) {
  const req = event.request
  if (req.method !== 'GET') return

    const url = new URL(req.url)
    // Supabase, TURN en andere domeinen: niet aanraken
    if (url.origin !== self.location.origin) return

      // Scripts en CSS met ?v=: direct uit de cache
      if (url.searchParams.has('v') && /\.(js|css)$/.test(url.pathname)) {
        event.respondWith(
          caches.open(CACHE_VERSION).then(async function(cache) {
            const hit = await cache.match(req)
            if (hit) return hit
              const res = await fetch(req, { cache: 'no-cache' }) // niet uit de browsercache: altijd de echte nieuwste
              if (res.ok) cache.put(req, res.clone())
                return res
          })
        )
        return
      }
      // Lettertypebestanden (v118): veranderen nooit, dus ook direct uit de cache
      if (/\/lettertypen\/[a-z0-9-]+\.woff2$/.test(url.pathname)) {
        event.respondWith(
          caches.open(CACHE_VERSION).then(async function(cache) {
            const hit = await cache.match(req)
            if (hit) return hit
              const res = await fetch(req)
              if (res.ok) cache.put(req, res.clone())
                return res
          })
        )
        return
      }
      // Html-pagina's (v30): eerst van internet, zodat je online altijd de nieuwste
      // versie krijgt. Lukt internet niet, dan de laatst bewaarde kopie: zo opent Fibro
      // ook zonder internet. Een kopie wordt bewaard zonder ?vriend=... e.d. (die leest
      // de pagina zelf uit het adres) en verdwijnt met een nieuwe CACHE_VERSION, samen
      // met de scripts waar ze bij hoort.
      if (req.mode === 'navigate' && /(\/|\.html)$/.test(url.pathname)) {
        const sleutel = url.origin + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : '')
        event.respondWith((async function() {
          let res
          try {
            res = await fetch(req)
          } catch (fout) {
            const hit = await caches.open(CACHE_VERSION).then(c => c.match(sleutel)).catch(() => null)
            if (hit) return hit
            throw fout
          }
          // Bewaren mag nooit de pagina zelf in de weg zitten
          try {
            if (res.ok && res.type === 'basic') {
              const kopie = res.clone()
              event.waitUntil(caches.open(CACHE_VERSION).then(c => c.put(sleutel, kopie)).catch(() => {}))
            }
          } catch (e) {}
          return res
        })())
        return
      }
      // Al het andere (afbeeldingen e.d.): browser regelt het zelf
})
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Fibro'
  const isBuzz = data.type === 'buzz'
  const options = {
    body: data.body || 'Je hebt een nieuw bericht',
    icon: isBuzz ? '/Fibro/icon-buzz.png' : '/Fibro/icon-192.png',
    badge: '/Fibro/icon-192.png',
    vibrate: isBuzz ? [300, 80, 300, 80, 300, 80, 500] : [200, 100, 200],
    tag: isBuzz ? 'buzz' : undefined,
    renotify: isBuzz,
    data: { url: data.url || '/chat.html' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
});
