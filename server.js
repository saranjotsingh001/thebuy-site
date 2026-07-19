const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'installs.json');

// ---- manifest.json and sw.js are served here directly, no separate files needed ----
// (defined before express.static so they always win, even if a stray file
// with the same name ever ends up in the public folder)

const MANIFEST = {
  name: "Instain — Grow Every Platform, On Autopilot",
  short_name: "Instain",
  description: "AI autopilot growth across six social platforms, one dashboard.",
  start_url: "/?source=pwa",
  scope: "/",
  display: "standalone",
  orientation: "portrait-primary",
  background_color: "#f7f8fc",
  theme_color: "#12b8ac",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};

app.get('/manifest.json', (req, res) => {
  res.type('application/json');
  res.json(MANIFEST);
});

const SW_CODE = `
const CACHE_NAME = 'instain-cache-v1';
const CORE_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) =>
        Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
`;

app.get('/sw.js', (req, res) => {
  res.type('application/javascript');
  res.send(SW_CODE);
});

// ---- install tracking (dedup by device id, falls back to IP) ----

function loadInstalls() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { ids: [] };
  }
}

function saveInstalls(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.post('/api/track-install', (req, res) => {
  const clientId = req.body && req.body.installId;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const dedupeKey = clientId || `ip:${ip}`;

  const data = loadInstalls();
  const alreadyCounted = data.ids.includes(dedupeKey);

  if (!alreadyCounted) {
    data.ids.push(dedupeKey);
    saveInstalls(data);
  }

  res.json({ ok: true, counted: !alreadyCounted, total: data.ids.length });
});

app.get('/api/install-count', (req, res) => {
  const data = loadInstalls();
  res.json({ total: data.ids.length });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`thebuy.site server running on port ${PORT}`);
});
