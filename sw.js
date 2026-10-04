// Push通知を受け取った時の処理
self.addEventListener('push', (event) => {
  let data = { title: '糸でんわ', body: '着信があります！' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || '着信があります！',
    icon: '/icon.png',
    badge: '/icon.png',
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: {
      url: self.registration.scope
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '糸でんわ', options)
  );
});

// 通知をタップした時の処理
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});
