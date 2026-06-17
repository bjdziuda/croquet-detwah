/* Croquet De-Twah service worker */
const CACHE = "croquet-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(["/", "/index.html", "/manifest.json"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

self.addEventListener("push", (e) => {
  let data = { title: "Croquet De-Twah", body: "New update from the league!" };
  try { data = e.data.json(); } catch {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "croquet",
      renotify: true,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((cs) => {
        const match = cs.find((c) => c.url.includes(self.location.origin));
        if (match) return match.focus();
        return clients.openWindow("/");
      })
  );
});
