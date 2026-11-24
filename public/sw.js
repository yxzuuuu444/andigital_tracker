// Minimal service worker: enables installability. Network-first passthrough;
// no caching of user data (financial data must never be served stale or cross-user).
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
