// CarrinhoSmart service worker.
// Só intercepta assets estáticos (ícones, manifest e /assets/).
// Navegações e chamadas de API NUNCA são cacheadas — evitando servir
// HTML autenticado para usuários deslogados ou respostas obsoletas.
const CACHE = 'carrinhosmart-static-v1'

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon.svg',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-192.png',
  '/icons/maskable-512.png',
]

const STATIC_PREFIXES = ['/assets/', '/icons/']
const STATIC_FILES = new Set(PRECACHE_URLS)

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const isStatic =
    STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) ||
    STATIC_FILES.has(url.pathname)
  if (!isStatic) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
