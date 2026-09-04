const CACHE_VERSION = 'fibro-v11'

self.addEventListener('install', function(event) {
  self.skipWaiting()
})

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    ).then(() => clients.claim())
  )
})

self.addEventListener('fetch', function(event) {
  if (event.request.url.includes('supabase.co')) return;
  event.respondWith(fetch(event.request));
});

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
