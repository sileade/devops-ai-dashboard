// DevOps AI Dashboard - Service Worker for Push Notifications

const CACHE_NAME = 'devops-ai-dashboard-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {
    title: 'DevOps Alert',
    body: 'New infrastructure alert',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'devops-alert',
    data: {}
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    tag: data.tag || 'devops-alert',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: data.type === 'critical',
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            // Navigate to notifications page if viewing details
            if (event.action === 'view' && event.notification.data?.alertId) {
              client.postMessage({
                type: 'NAVIGATE_TO_ALERT',
                alertId: event.notification.data.alertId
              });
            }
            return;
          }
        }
        // Open new window if none exists
        if (clients.openWindow) {
          const url = event.action === 'view' ? '/notifications' : '/';
          return clients.openWindow(url);
        }
      })
  );
});

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, alertType, alertId, resource } = event.data;
    
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `alert-${alertId}`,
      data: { alertId, alertType, resource },
      vibrate: alertType === 'critical' ? [200, 100, 200, 100, 200] : [200, 100, 200],
      requireInteraction: alertType === 'critical',
      actions: [
        { action: 'view', title: 'View Details' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    });
  }
});
