// Safarr Driver Service Worker
const SW_VERSION = 'safarr-driver-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => caches.delete(cacheName))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isSameOrigin = url.origin === self.location.origin;

    // Skip: Supabase API/storage, external APIs — let them pass through natively
    if (!isSameOrigin) {
        // Do NOT call event.respondWith() for cross-origin requests
        // Adding custom headers to cross-origin fetches breaks CORS preflight
        return;
    }

    // Same-origin requests: serve fresh, no cache
    event.respondWith(
        fetch(event.request, { cache: 'no-store' }).catch(() => {
            if (event.request.mode === 'navigate') {
                return new Response(`<html><body style="font-family:sans-serif;text-align:center;padding:100px;"><h1>🛺 Safarr Driver</h1><p>You're offline. Check your connection.</p><button onclick="location.reload()">Retry</button></body></html>`, { headers: { 'Content-Type': 'text/html' } });
            }
            // Always return a valid Response to avoid TypeError
            return new Response('', { status: 503, statusText: 'Service Unavailable' });
        })
    );
});

self.addEventListener('push', (event) => {
    let data = { title: '🔔 New Ride Request!', body: 'A passenger is looking for an auto nearby.' };
    try { data = event.data.json(); } catch (e) {}

    const options = {
        body: data.body,
        icon: 'auto.jpg',
        badge: 'auto.jpg',
        image: data.image || undefined,
        data: { url: data.url || './index.html', rideId: data.rideId },
        actions: [
            { action: 'view',    title: '✅ View Request' },
            { action: 'dismiss', title: '✗ Dismiss'       }
        ],
        requireInteraction: true,
        vibrate: [300, 100, 300, 100, 300], // Stronger vibration for driver alerts
        tag: 'ride-' + (data.rideId || Date.now()),
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification(data.title || '🔔 New Ride Request!', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    // Do nothing if dismissed
    if (event.action === 'dismiss') return;
    
    const url = event.notification.data?.url || './index.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                // If app is already open, focus it and you can even send a message via postMessage here if needed
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // If app was closed, open it
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
