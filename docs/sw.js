// Offline cache. The build stamps a new version on every change, which clears the old cache.
const CACHE = "pocket-trainer-0e0d1a6100";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
// Voice clips are named by their words, so they never change: kept across versions.
const VOICE = "pocket-trainer-voice";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache, so a new version never installs a stale page.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== VOICE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache first so the app opens instantly with no signal; refresh the copy in the background.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.endsWith(".m4a")) {
    e.respondWith(caches.open(VOICE).then(async (c) => {
      const hit = await c.match(url.pathname); if (hit) return hit;
      const res = await fetch(req); if (res.status === 200) c.put(url.pathname, res.clone()); return res;
    }));
    return;
  }
  if (!sameOrigin && !FONT_HOSTS.includes(url.host)) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: sameOrigin });
    const net = fetch(sameOrigin ? new Request(req, { cache: "no-cache" }) : req)
      .then((res) => { if (res.ok || res.type === "opaque") cache.put(req, res.clone()); return res; })
      .catch(() => hit || (req.mode === "navigate" ? cache.match("./index.html") : Response.error()));
    return hit || net;
  }));
});
