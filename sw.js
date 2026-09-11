const CACHE = "dayz-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./data/recipes.json",
  "./data/items.json",
  "./data/roads.json",
  "./js/router.js",
  "./js/app.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.map((x) => x !== CACHE && caches.delete(x))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
