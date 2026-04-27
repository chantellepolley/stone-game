// STONE Service Worker — push notifications only
// v5 — removed all caching to prevent stale content issues

self.addEventListener('push', (event) => {
  let data = { title: 'STONE', body: 'Something happened in your game!' };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // If not JSON, use the text
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

// Handle notification click — open the app
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

// On install: immediately activate (don't wait for old SW to release)
self.addEventListener('install', (event) => {
  // Delete ALL old caches from previous versions
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.skipWaiting();
});

// On activate: claim all clients and clear any remaining caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// NO fetch handler — let the browser handle all requests normally
// This ensures users always get the latest version of the app
