/*  Service worker: lets SOMA open as a phone app and start without a connection.

    "Network first, cache as a fallback": always try the real files so you get the
    latest version, and if the phone is offline, use the last copy that worked.
    The crew data lives on the device in the demo, so the app works offline.

    Change CACHE to make every phone throw away its old copy.  */

const CACHE = 'soma-v1'

// Saved the first time the app is opened, so it can start offline.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // One missing file should not stop the install.
        await Promise.allSettled(SHELL.map((url) => cache.add(url)))
        // Also the app's own code and styles named in the page, so it starts offline
        // even if it was only opened once. Other files are saved as they are used.
        const page = await cache.match('/index.html')
        const html = page ? await page.text() : ''
        const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1])
        await Promise.allSettled(assets.map((url) => cache.add(url)))
      })
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // Only page and file loads from this site. The server's /api/ answers are never stored.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        // ignoreVary: a saved file still counts when the browser asks for it a little differently.
        const hit = await caches.match(request, { ignoreVary: true })
        if (hit) return hit
        // Any page with nothing stored still gets the app, so it opens offline.
        if (request.mode === 'navigate') {
          const shell = (await caches.match('/index.html', { ignoreVary: true })) ?? (await caches.match('/', { ignoreVary: true }))
          if (shell) return shell
        }
        return Response.error()
      }),
  )
})
