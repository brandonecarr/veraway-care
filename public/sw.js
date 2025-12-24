// Service Worker for Push Notifications
// Version: 2.0.0 - Desktop/Tablet fix

const SW_VERSION = '2.0.0';

self.addEventListener('install', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Installing...`);
  // Force the waiting service worker to become the active service worker
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Activating...`);
  // Take control of all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clear any old caches if needed
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('push-')) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ]).then(() => {
      console.log(`Service Worker v${SW_VERSION}: Activated and controlling all clients`);
    })
  );
});

self.addEventListener('push', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Push event received`);
  
  // Ensure we have permission
  if (Notification.permission !== 'granted') {
    console.warn('Service Worker: Notification permission not granted');
    return;
  }

  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
      console.log('Service Worker: Push data parsed:', data);
    }
  } catch (e) {
    console.error('Service Worker: Failed to parse push data:', e);
    // Try to get as text if JSON fails
    try {
      const text = event.data?.text() || '';
      console.log('Service Worker: Push data as text:', text);
    } catch (textError) {
      console.error('Service Worker: Failed to read push data as text:', textError);
    }
  }

  const title = data.title || 'Care Coordination Alert';
  
  // Desktop browsers may not support all notification options
  // Use a minimal options object for better compatibility
  const options = {
    body: data.body || data.message || 'You have a new notification',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: data.tag || `care-coordination-${Date.now()}`,
    data: {
      url: data.url || '/dashboard',
      issueId: data.issueId,
      notificationId: data.notificationId,
      timestamp: Date.now(),
    },
    // requireInteraction keeps notification visible on desktop until user interacts
    requireInteraction: data.priority === 'urgent' || data.priority === 'critical',
    // Silent option - set to false to ensure notification sound on desktop
    silent: false,
  };

  // Add vibrate only if supported (mainly mobile)
  if ('vibrate' in navigator) {
    options.vibrate = data.priority === 'urgent' || data.priority === 'critical' ? [200, 100, 200] : [100];
  }

  // Add actions only if supported (not all browsers support this)
  // Check if we can add actions - some desktop browsers don't support them
  try {
    options.actions = [
      {
        action: 'view',
        title: 'View',
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
      },
    ];
  } catch (e) {
    console.log('Service Worker: Actions not supported');
  }

  // Use waitUntil to ensure the notification is shown
  const notificationPromise = self.registration.showNotification(title, options)
    .then(() => {
      console.log(`Service Worker v${SW_VERSION}: Notification displayed successfully`);
    })
    .catch((error) => {
      console.error(`Service Worker v${SW_VERSION}: Failed to show notification:`, error);
      // Fallback: try with minimal options if the full options fail
      return self.registration.showNotification(title, {
        body: data.body || 'You have a new notification',
        icon: '/icon-192.svg',
        tag: `care-coordination-fallback-${Date.now()}`,
      });
    });

  event.waitUntil(notificationPromise);
});

self.addEventListener('notificationclick', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Notification clicked`, event.action);
  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/dashboard';
  const fullUrl = new URL(urlToOpen, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        console.log(`Service Worker v${SW_VERSION}: Found ${clientList.length} clients`);
        
        // Check if there's already a window open with our app
        for (const client of clientList) {
          // Check if the client URL is from our domain
          if (client.url.startsWith(self.location.origin)) {
            // Navigate the existing window and focus it
            return client.navigate(fullUrl).then((navigatedClient) => {
              if (navigatedClient) {
                return navigatedClient.focus();
              }
            }).catch(() => {
              // If navigate fails, just focus the existing window
              return client.focus();
            });
          }
        }
        
        // No existing window found, open a new one
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
      .catch((error) => {
        console.error(`Service Worker v${SW_VERSION}: Error handling notification click:`, error);
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Notification closed`);
});

// Handle push subscription change (important for desktop browsers)
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log(`Service Worker v${SW_VERSION}: Push subscription changed`);
  
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription?.options?.applicationServerKey
    })
    .then((subscription) => {
      console.log(`Service Worker v${SW_VERSION}: Resubscribed to push`);
      // Note: In a production app, you'd want to send this new subscription to your server
      return fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
        credentials: 'include'
      });
    })
    .catch((error) => {
      console.error(`Service Worker v${SW_VERSION}: Failed to resubscribe:`, error);
    })
  );
});
