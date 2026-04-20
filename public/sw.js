// STONE Service Worker — handles push notifications

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
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app is already open, focus it
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Otherwise open new window
      return clients.openWindow(urlToOpen);
    })
  );
});

// Cache static assets for offline support
const CACHE_NAME = 'stone-v1';
const STATIC_ASSETS = [
  '/',
  '/logo.png',
  '/app-icon.png',
  '/jester.png',
  '/jester-dice.png',
  '/stone-bg.jpg',
  '/favicon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network-first for API calls, cache-first for assets
  if (event.request.url.includes('supabase.co') || event.request.method !== 'GET') {
    return; // Don't cache API calls
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});

// Periodic background sync (if supported) to check for turn changes
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-notifications') {
    event.waitUntil(checkForNotifications());
  }
});

async function checkForNotifications() {
  // This runs in the background — check if it's the user's turn
  // Limited by browser support, but helps on Android
  try {
    const SUPABASE_URL = 'https://tabsvmsnkdltuzenhgkw.supabase.co';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhYnN2bXNua2RsdHV6ZW5oZ2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMDgzMTYsImV4cCI6MjA5MTg4NDMxNn0.jHLlIj_u998taHN-Qo4zp_ivjQi6UDA11kiKeqQ48Rc';

    // Check for pending game invites
    const inviteRes = await fetch(
      `${SUPABASE_URL}/rest/v1/game_invites?status=eq.pending&select=id&limit=1`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    const invites = await inviteRes.json();
    if (invites.length > 0) {
      self.registration.showNotification('STONE', {
        body: 'You have a game invite waiting!',
        icon: '/app-icon.png',
        tag: 'bg-invite',
        data: { url: '/' },
      });
    }
  } catch (e) {
    // Silently fail in background
  }
}
