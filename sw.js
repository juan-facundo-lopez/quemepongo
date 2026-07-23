'use strict';

const CACHE_NAME = 'qmp-shell-v21';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/index.css?v=20260723-wardrobe2',
  '/recommendations.js?v=20260723-wardrobe2',
  '/app.js?v=20260723-wardrobe2',
  '/auth.js?v=20260722-localpreview1',
  '/pwa.js?v=20260723-wardrobe2',
  '/manifest.json?v=20260721-pwa1',
  '/favicon.png?v=20260721-2',
  '/app-logo.png?v=20260721-1',
  '/icons/apple-touch-icon-180.png?v=20260721-pwa1',
  '/icons/icon-192.png?v=20260721-pwa1',
  '/icons/icon-512.png?v=20260721-pwa1'
];
const STATIC_PATHS = new Set([
  '/',
  '/index.html',
  '/index.css',
  '/recommendations.js',
  '/app.js',
  '/auth.js',
  '/pwa.js',
  '/manifest.json',
  '/favicon.png',
  '/app-logo.png',
  '/icons/apple-touch-icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('qmp-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.endsWith('.php')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', response.clone()));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (!STATIC_PATHS.has(url.pathname)) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      });
    })
  );
});
