// Safarr Service Worker
// Strategy: Network-first (always fresh from GitHub/server)
// No caching of app files to ensure latest code always loads

const SW_VERSION = 'safarr-sw-v1';

// ─── Install ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Safarr SW');
    // Skip waiting to activate immediately
    self.skipWaiting();
});

// ─── Activate ──────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Safarr SW');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Delete ALL old caches - always fresh
                    console.log('[SW] Deleting cache:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ─── Fetch: Network-First, No Caching ──────────────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Always bypass SW for Supabase API calls (let them through)
    if (url.hostname.includes('supabase.co') ||
        url.hostname.includes('anthropic.com') ||
        url.hostname.includes('api.')) {
        return; // Don't intercept
    }

    // For HTML/JS/CSS: always fetch fresh from network
    // Add cache-busting headers
    event.respondWith(
        fetch(event.request, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        }).catch((err) => {
            console.warn('[SW] Network fetch failed:', err);
            // Only serve offline fallback for navigation requests
            if (event.request.mode === 'navigate') {
                return new Response(
                    `<!DOCTYPE html>
          <html>
          <head><title>Safarr - Offline</title>
          <style>
            body { font-family: sans-serif; display:flex; align-items:center; 
                   justify-content:center; height:100vh; margin:0; 
                   background:#fff; color:#0a1628; }
            .box { text-align:center; padding:2rem; }
            h1 { font-size:2rem; margin-bottom:0.5rem; }
            p { color:#666; margin-bottom:1.5rem; }
            button { background:#0a1628; color:#fff; border:none; 
                     padding:0.75rem 2rem; border-radius:8px; 
                     cursor:pointer; font-size:1rem; }
          </style>
          </head>
          <body>
            <div class="box">
              <h1>🚗 Safarr</h1>
              <p>You're offline. Please check your internet connection.</p>
              <button onclick="location.reload()">Try Again</button>
            </div>
          </body>
          </html>`,
                    { headers: { 'Content-Type': 'text/html' } }
                );
            }
            return new Response('Network error', { status: 503 });
        })
    );
});

// ─── Push Notifications ────────────────────────────────────
self.addEventListener('push', (event) => {
    let data = { title: 'Safarr', body: 'New notification' };
    try {
        data = event.data.json();
    } catch (e) {
        data.body = event.data ? event.data.text() : 'New notification';
    }

    const options = {
        body: data.body,
        icon: 'auto.jpg',
        badge: 'auto.jpg',
        vibrate: [200, 100, 200],
        data: data,
        actions: [
            { action: 'accept', title: '✅ Accept', icon: 'auto.jpg' },
            { action: 'decline', title: '❌ Decline', icon: 'auto.jpg' }
        ],
        requireInteraction: true,
        tag: 'ride-request'
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Safarr', options)
    );
});

// ─── Notification Click ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'accept') {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (const client of clientList) {
                    if (client.url.includes('auto.html') && 'focus' in client) {
                        client.postMessage({ type: 'RIDE_ACCEPTED', data: event.notification.data });
                        return client.focus();
                    }
                }
                return clients.openWindow('/auto.html?action=accept&ride=' + (event.notification.data?.rideId || ''));
            })
        );
    } else {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (const client of clientList) {
                    if ('focus' in client) return client.focus();
                }
                return clients.openWindow('/auto.html');
            })
        );
    }
});

// ─── Message from app ─────────────────────────────────────
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, {
            body: event.data.body,
            icon: 'auto.jpg',
            badge: 'auto.jpg',
            vibrate: [200, 100, 200],
            tag: event.data.tag || 'safarr',
            data: event.data.data || {}
        });
    }

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});