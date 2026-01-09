// sw.js
// Centralized Push Notifications handler for Padeluminatis

self.addEventListener('install', (event) => {
    console.log('[SW] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activated');
});

// Listen for Push events from Backend (FCM/WebPush)
self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch(e) {
            data = { title: 'Padeluminatis', message: event.data.text() };
        }
    }

    const title = data.title || '🎾 Padeluminatis';
    const options = {
        body: data.message || 'Tienes una nueva notificación.',
        icon: './imagenes/Logojafs.png',
        badge: './imagenes/Logojafs.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.link || './notificaciones.html'
        },
        actions: [
            { action: 'open', title: 'Ver ahora', icon: './imagenes/Logojafs.png' }
        ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Handle Notification Clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            const url = event.notification.data.url;
            
            // If horizontal tab is open, focus it
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            
            // Otherwise open a new tab
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
