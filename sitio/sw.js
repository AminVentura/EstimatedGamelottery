'use strict';
const CACHE_NAME = 'plv1-cache-v2';
const PRECACHE = [
  '/',
  '/styles.css',
  '/app.js',
  '/sports-dashboard.js',
  '/lottery-algorithms.js',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Never cache Firebase Functions or API calls
  if (url.hostname.includes('cloudfunctions.net') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebaseio.com')) return;
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }))
      .catch(() => caches.match('/'))
  );
});
