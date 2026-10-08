// ==========================================================================
// IBNU MASYURF APP - SERVICE WORKER (PWA)
// Cache Version: v1.0.0
// ==========================================================================

const CACHE_NAME = 'ibnumasyurf-cache-v1.0.0';

// Core Application Shell Assets
const STATIC_ASSETS = [
  './',
  './index.html',
  './index.css',
  './app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './data/radios.js',
  './data/tvChannels.js',
  './data/kajianAudio.js',
  './data/kajianVideo.js',
  './data/dzikir.js'
];

// Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache assets gracefully (allow partial failure if an asset fails)
        return Promise.allSettled(
          STATIC_ASSETS.map((asset) => {
            return cache.add(asset).catch((err) => {
              console.warn(`[SW] Gagal pre-cache asset: ${asset}`, err);
            });
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name.startsWith('ibnumasyurf-')) {
            console.log('[SW] Menghapus cache lama:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event Strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Bypass non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 2. Bypass live radio audio streams, range requests, and external video players
  // Live streams are continuous and cannot be buffered into CacheStorage
  const isMediaStream = 
    url.pathname.endsWith('.mp3') ||
    url.search.includes('.mp3') ||
    url.hostname.includes('radioislam') ||
    url.hostname.includes('kajian.net') ||
    url.hostname.includes('youtube') ||
    url.hostname.includes('googlevideo') ||
    request.headers.get('range');

  if (isMediaStream) {
    // Network-only for live stream & large media
    event.respondWith(
      fetch(request).catch(() => {
        return new Response('Media stream saat ini tidak dapat diakses saat offline.', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
    );
    return;
  }

  // 3. For Google Fonts & Web Fonts: Stale-While-Revalidate
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 4. Stale-While-Revalidate for application assets (HTML, CSS, JS, JSON, Icons)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback if offline and request is navigation (HTML)
          if (request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Support manual skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
