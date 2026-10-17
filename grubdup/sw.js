// Grub’dup offline support: keeps a copy of the app on the phone so it opens with no signal.
// Change VERSION whenever you upload a new index.html so phones pick up the update.
const VERSION = "grubdup-2026-10-17c";
const CORE = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // The page itself: try the network first so updates come through, fall back to the saved copy offline.
  const isPage = req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"));
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(m => m || caches.match("index.html")))
    );
    return;
  }

  // Icons, manifest and fonts: use the saved copy, fetch and save it if we don't have it yet.
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(m => m || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
