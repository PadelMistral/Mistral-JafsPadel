/**
 * Padeluminatis Service Worker
 * Handles push notifications and offline caching
 */

const CACHE_NAME = 'padeluminatis-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/home.html',
    '/calendario.html',
    '/imagenes/Logojafs.png',
    '/css/app.css',
    '/css/shared-utils.css'
];

// Install
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
    self.skipWaiting();
});

// Activate
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

// Fetch (Network first, fallback to cache)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// Push Notification (from server)
self.addEventListener('push', (event) => {
    const data = event.data?.json() || { title: 'Padeluminatis', body: 'Nueva notificación' };
    
    const options = {
        body: data.body,
        icon: '/imagenes/Logojafs.png',
        badge: '/imagenes/Logojafs.png',
        vibrate: [100, 50, 100],
        data: data.data || {},
        actions: data.actions || []
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Message from main app
self.addEventListener('message', (event) => {
    if (event.data.type === 'SHOW_NOTIFICATION') {
        self.registration.showNotification(event.data.title, event.data.options);
    }
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/home.html';
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('padeluminatis') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
