// Minimal precache service worker (module type).  The file list and
// CACHE_VERSION come from web/tools/build.mjs.
//
// Module workers need Chrome/Edge 91+ or Firefox 111+.  On older browsers the
// registration in main.js just rejects (caught and ignored) and the game runs
// online-only -- fine for the Chromebook target.

import PRECACHE from "./js/sw-precache.generated.js";

const CACHE = `pysycache-${PRECACHE.CACHE_VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE.FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match("./index.html"))),
  );
});
