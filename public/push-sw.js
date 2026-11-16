// Notificaciones PUSH con la app CERRADA (las envía Firebase Cloud Messaging).
// Se carga dentro del service worker de la app (vite.config.js → importScripts).
self.addEventListener('push', (event) => {
  let d = {};
  try {
    const j = event.data ? event.data.json() : {};
    d = j.data || j;
  } catch (e) {
    d = { body: event.data ? event.data.text() : '' };
  }
  const urgent = d.urgent === '1';
  event.waitUntil(
    self.registration.showNotification(d.title || 'Envia2 Express', {
      body: d.body || '',
      icon: 'icon-192.png',
      badge: 'icon-64.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      requireInteraction: urgent, // los importantes quedan en pantalla hasta tocarlos
      vibrate: urgent ? [800, 300, 800, 300, 800, 300, 800, 300, 800] : [300, 100, 300],
      data: { url: d.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
