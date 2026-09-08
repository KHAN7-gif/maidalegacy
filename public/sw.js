// ================================================================
//  MDE Finance Pro — Service Worker
//  Maida Legacy · PS Gaming Centre
//  Versi: 3.0
//
//  PERUBAHAN PENTING BERBANDING v2.0:
//  1. index.html kini NETWORK-FIRST — versi baharu yang di-deploy
//     SENTIASA digunakan. (v2.0 cache-first, jadi app tak pernah
//     dikemas kini walaupun fail baharu sudah naik ke GitHub.)
//  2. Permintaan Firebase dilepaskan SECARA JELAS — tiada risiko SW
//     mengganggu penyegerakan data.
//  3. Fallback offline dibaiki (v2.0 boleh pulangkan 'undefined'
//     yang menyebabkan ralat rangkaian palsu).
// ================================================================

const SW_VERSION = 'mde-sw-v4';
const CACHE_NAME = 'mde-cache-v4';

// Hanya aset statik yang jarang berubah
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap',
];

// ================================================================
//  INSTALL
// ================================================================
self.addEventListener('install', event => {
  console.log('[SW] Memasang', SW_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CACHE_FILES).catch(err => {
        console.warn('[SW] Cache gagal (tidak kritikal):', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ================================================================
//  ACTIVATE — buang cache lama (termasuk mde-cache-v2)
// ================================================================
self.addEventListener('activate', event => {
  console.log('[SW] Diaktifkan', SW_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ================================================================
//  FETCH
//  - Firebase & semua silang-domain (kecuali fonts) → JANGAN sentuh
//  - HTML / navigasi  → NETWORK-FIRST (app sentiasa terkini)
//  - Fonts & aset lain → CACHE-FIRST (laju & jimat data)
// ================================================================
self.addEventListener('fetch', event => {
  const req = event.request;

  // 1) Hanya GET. Semua PUT/PATCH/DELETE (tulisan Firebase) dilepaskan.
  if (req.method !== 'GET') return;

  const url = req.url;
  const samaOrigin = url.startsWith(self.location.origin);
  const adalahFont = url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');

  // 2) Lepaskan SECARA JELAS semua trafik pangkalan data / API.
  //    (Perlindungan berganda — supaya SW tidak sekali-kali mengganggu sync.)
  //    Backend kini sama-origin (/api/*) sejak berpindah dari Firebase ke
  //    Hostinger — WAJIB dilepaskan di sini, atau SW akan cache respons
  //    polling dan app akan nampak data lapuk.
  if (new URL(url).pathname.startsWith('/api/')) return;
  if (url.includes('firebasedatabase.app') ||
      url.includes('firebaseio.com') ||
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('firebasestorage')) {
    return;
  }

  // 3) Silang-domain lain (bukan font) — jangan sentuh.
  if (!samaOrigin && !adalahFont) return;

  // 4) HTML / navigasi → NETWORK-FIRST.
  //    Inilah pembetulan utama: versi baharu sentiasa digunakan.
  const mintaHTML = req.mode === 'navigate' ||
                    (req.headers.get('accept') || '').includes('text/html');

  if (mintaHTML && samaOrigin) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const salinan = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, salinan)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          // Offline — guna cache kalau ada
          const cached = await caches.match(req);
          return cached || caches.match('./index.html')
                 || new Response('<h1>Tiada sambungan</h1><p>Sila cuba lagi bila internet kembali.</p>',
                                 { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        })
    );
    return;
  }

  // 5) Aset lain (fonts, ikon, dsb.) → CACHE-FIRST, kemudian rangkaian.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const salinan = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, salinan)).catch(() => {});
        return res;
      }).catch(() => cached || Response.error());  // v2.0 pulangkan undefined di sini
    })
  );
});

// ================================================================
//  TIMER STORAGE
// ================================================================
const timers = new Map();    // bkId → { timeoutEnd, timeout5min }

// ================================================================
//  MESSAGE HANDLER
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
  else if (type === 'SKIP_WAITING') {   // benarkan app paksa kemas kini serta-merta
    self.skipWaiting();
  }
});

// ================================================================
//  SCHEDULE FUNCTIONS
// ================================================================
function scheduleTimer(bkId, stationId, stationName, endTime, amtRm) {
  cancelTimer(bkId);
  const msLeft = endTime - Date.now();
  if (msLeft <= 0) return;

  const timer = {};

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
    broadcastToClients({ type: 'TIMER_END', stationId, bkId });
  }, msLeft);

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
  console.log(`[SW] Timer ditetapkan untuk booking #${bkId} — ${Math.round(msLeft/60000)} minit lagi`);
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
    console.warn('[SW] Notifikasi gagal:', e);
  }
}

// ================================================================
//  NOTIFICATION CLICK
// ================================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'NOTIFICATION_TAP', data });
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html#ps_booking');
      }
    })
  );
});

// ================================================================
//  NOTIFICATION CLOSE
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
//  PERIODIC SYNC
// ================================================================
self.addEventListener('periodicsync', event => {
  if (event.tag === 'mde-timer-check') {
    event.waitUntil(broadcastToClients({ type: 'REQUEST_TIMER_SYNC' }));
  }
});

console.log('[SW] MDE Finance Pro Service Worker dimuat —', SW_VERSION);
