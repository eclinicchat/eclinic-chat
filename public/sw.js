self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: "Ai primit un mesaj nou." };
  }

  event.waitUntil(self.registration.showNotification(payload.title || "eClinic Chat", {
    body: payload.body || "Ai primit un mesaj nou.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "eclinic-message",
    renotify: true,
    silent: payload.silent === true,
    data: { url: payload.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(targetUrl);
  })());
});
