const CACHE_VERSION = 'fibro-v18'

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
              const res = await fetch(req)
              if (res.ok) cache.put(req, res.clone())
                return res
          })
        )
        return
      }
      // Al het andere (HTML, afbeeldingen): browser regelt het zelf
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
