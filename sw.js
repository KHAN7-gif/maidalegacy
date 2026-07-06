// ================================================================
//  MDE Finance Pro — Service Worker
//  Maida Legacy · PS Gaming Centre
//  Versi: 2.0
// ================================================================

const SW_VERSION = 'mde-sw-v2';
const CACHE_NAME = 'mde-cache-v2';

// Files to cache for offline use
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap',
];

// ================================================================
//  INSTALL — Cache static assets
// ================================================================
self.addEventListener('install', event => {
  console.log('[SW] Installing', SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CACHE_FILES).catch(err => {
        console.warn('[SW] Cache failed (non-critical):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ================================================================
//  ACTIVATE — Clean old caches
// ================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Activated', SW_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ================================================================
//  FETCH — Serve from cache, fallback to network
// ================================================================
self.addEventListener('fetch', event => {
  // Only cache same-origin GET requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin) &&
      !event.request.url.includes('fonts.googleapis.com') &&
      !event.request.url.includes('fonts.gstatic.com')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => cached); // fallback to cache on network error
    })
  );
});

// ================================================================
//  TIMER STORAGE — Track scheduled timers
// ================================================================
const timers = new Map();    // bkId → { timeoutEnd, timeout5min }

// ================================================================
//  MESSAGE HANDLER — Receive commands from main app
// ================================================================
self.addEventListener('message', event => {
  const { type, bkId, stationId, stationName, endTime, fireAt, amtRm } = event.data || {};

  if (type === 'SCHEDULE_TIMER') {
    scheduleTimer(bkId, stationId, stationName, endTime, amtRm);
  }
  else if (type === 'SCHEDULE_WARNING') {
    scheduleWarning(bkId, stationId, stationName, fireAt, amtRm);
  }
  else if (type === 'CANCEL_TIMER') {
    cancelTimer(bkId);
  }
  else if (type === 'PING') {
    event.source?.postMessage({ type: 'PONG', version: SW_VERSION });
  }
});

// ================================================================
//  SCHEDULE FUNCTIONS
// ================================================================
function scheduleTimer(bkId, stationId, stationName, endTime, amtRm) {
  cancelTimer(bkId); // Clear existing
  const msLeft = endTime - Date.now();
  if (msLeft <= 0) return;

  const timer = {};

  // End-of-session notification
  timer.timeoutEnd = setTimeout(async () => {
    await showNotification({
      title: `⏰ ${stationName} — MASA TAMAT!`,
      body: `Sesi telah tamat. Sila kutip bayaran RM ${Number(amtRm).toFixed(2)}.`,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: `ps-end-${bkId}`,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 400],
      actions: [
        { action: 'open', title: '🎮 Buka App' },
        { action: 'dismiss', title: 'OK' }
      ],
      data: { bkId, stationId, type: 'end' }
    });
    // Notify main thread
    broadcastToClients({ type: 'TIMER_END', stationId, bkId });
  }, msLeft);

  // 5-minute warning
  const warn5 = msLeft - 300000;
  if (warn5 > 0) {
    timer.timeout5min = setTimeout(async () => {
      await showNotification({
        title: `⚠️ ${stationName} — 5 Minit Lagi!`,
        body: `Sesi akan tamat dalam 5 minit. Sila maklumkan pelanggan.`,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: `ps-warn-${bkId}`,
        vibrate: [300, 100, 300],
        actions: [
          { action: 'open', title: '🎮 Buka App' }
        ],
        data: { bkId, stationId, type: 'warning' }
      });
    }, warn5);
  }

  timers.set(bkId, timer);
  console.log(`[SW] Timer set for booking #${bkId} — ${Math.round(msLeft/60000)} minit lagi`);
}

function scheduleWarning(bkId, stationId, stationName, fireAt, amtRm) {
  const msLeft = fireAt - Date.now();
  if (msLeft <= 0) return;
  const existing = timers.get(bkId) || {};
  if (existing.timeout5min) clearTimeout(existing.timeout5min);
  existing.timeout5min = setTimeout(async () => {
    await showNotification({
      title: `⚠️ ${stationName} — 5 Minit Lagi!`,
      body: `Sesi akan tamat dalam 5 minit.`,
      icon: './icon-192.png',
      tag: `ps-warn-${bkId}`,
      vibrate: [300, 100, 300],
      data: { bkId, stationId, type: 'warning' }
    });
  }, msLeft);
  timers.set(bkId, existing);
}

function cancelTimer(bkId) {
  const t = timers.get(bkId);
  if (!t) return;
  if (t.timeoutEnd) clearTimeout(t.timeoutEnd);
  if (t.timeout5min) clearTimeout(t.timeout5min);
  timers.delete(bkId);
}

// ================================================================
//  SHOW NOTIFICATION HELPER
// ================================================================
async function showNotification(opts) {
  if (Notification.permission !== 'granted') return;
  const { title, ...options } = opts;
  try {
    await self.registration.showNotification(title, {
      ...options,
      timestamp: Date.now(),
      silent: false,
    });
  } catch(e) {
    console.warn('[SW] Notification failed:', e);
  }
}

// ================================================================
//  NOTIFICATION CLICK — Open app when notification tapped
// ================================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app already open, focus it
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_TAP', data });
          return;
        }
      }
      // Else open new window
      if (clients.openWindow) {
        return clients.openWindow('./index.html#ps_booking');
      }
    })
  );
});

// ================================================================
//  NOTIFICATION CLOSE — Track dismissed
// ================================================================
self.addEventListener('notificationclose', event => {
  console.log('[SW] Notifikasi ditutup:', event.notification.tag);
});

// ================================================================
//  BROADCAST TO ALL CLIENTS
// ================================================================
async function broadcastToClients(msg) {
  const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  clientList.forEach(client => client.postMessage(msg));
}

// ================================================================
//  PERIODIC SYNC — Re-check timers every hour (if supported)
// ================================================================
self.addEventListener('periodicsync', event => {
  if (event.tag === 'mde-timer-check') {
    event.waitUntil(broadcastToClients({ type: 'REQUEST_TIMER_SYNC' }));
  }
});

console.log('[SW] MDE Finance Pro Service Worker loaded —', SW_VERSION);
