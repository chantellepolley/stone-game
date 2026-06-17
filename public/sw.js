// STONE Service Worker — push notifications + offline app shell cache
// v6 — cache app shell for offline AI play

const CACHE_NAME = 'stone-v6';
const SHELL_URLS = [
  '/',
  '/stone-bg.jpg',
  '/logo.png',
  '/jester.png',
  '/jester-dice.png',
  '/app-icon.png',
  '/favicon.png',
];

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'STONE', body: 'Something happened in your game!' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/app-icon.png',
    badge: '/favicon.png',
    tag: data.tag || 'stone-notification',
    data: {
      url: data.url || '/',
    },
    vibrate: [100, 50, 150],
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options).then(() => {
      if (self.navigator && self.navigator.setAppBadge) {
        self.navigator.setAppBadge().catch(() => {});
      }
    })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (self.navigator && self.navigator.setAppBadge) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Listen for skip-waiting message from page
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// On install: cache app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// On activate: clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch handler: network-first with cache fallback
// JS/CSS files always go to network (Vite hashes them for cache busting)
// Static assets fall back to cache when offline
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // For navigation (HTML) — network first, cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then((response) => {
        // Cache the latest HTML
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put('/', clone));
        return response;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // For static assets (images, fonts) — cache first, network fallback
  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) =>
        cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
      )
    );
    return;
  }

  // Everything else (JS bundles, API calls) — network only
});
