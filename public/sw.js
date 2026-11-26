/* Kayden Chiew app service worker.
 * Rules:
 * - Pages (navigations): network first. Page HTML is NEVER stored, because it can
 *   contain signed-in user data. If the network fails, show the static /offline.html.
 * - /api/* and anything not on this origin: never touched or stored.
 * - Only public, fingerprinted static assets (/_next/static, /icons, fonts) are cached.
 */
const VERSION = "kc-pwa-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/apple-touch-icon.png",
];

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/apple-touch-icon.png" ||
    /\.(?:woff2?|ttf|otf)$/.test(url.pathname)
  );
}

function classify(request, origin) {
  if (request.method !== "GET") return "bypass";
  const url = new URL(request.url);
  if (url.origin !== origin) return "bypass";
  if (url.pathname.startsWith("/api/")) return "bypass";
  if (request.mode === "navigate") return "page";
  if (isStaticAsset(url)) return "static";
  return "bypass";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function pageResponse(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function staticResponse(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const kind = classify(event.request, self.location.origin);
  if (kind === "page") event.respondWith(pageResponse(event.request));
  else if (kind === "static") event.respondWith(staticResponse(event.request));
  // "bypass": do nothing, so the browser handles it normally and nothing is stored.
});

if (typeof module !== "undefined") {
  module.exports = { classify, isStaticAsset, VERSION, STATIC_CACHE, OFFLINE_URL, PRECACHE };
}
