"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const n = new URL("n/", self.registration.scope).href;
  if (!e.request.url.startsWith(n)) return;
  e.respondWith((async () => {
    const u = new URL(e.request.url);
    const c = await caches.open("pense-bete");
    const r = await c.match(u.origin + u.pathname);
    if (r) return r;
    return e.request.mode === "navigate" ? Response.redirect(self.registration.scope) : new Response("", { status: 404 });
  })());
});
