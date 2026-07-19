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

// ---- app icons, embedded as base64 so no image files are needed on disk ----

const ICON_192 = Buffer.from(
  "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",
  'base64'
);
const ICON_512 = Buffer.from(
  "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",
  'base64'
);

app.get('/icons/icon-192.png', (req, res) => {
  res.type('image/png');
  res.send(ICON_192);
});

app.get('/icons/icon-512.png', (req, res) => {
  res.type('image/png');
  res.send(ICON_512);
});


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
