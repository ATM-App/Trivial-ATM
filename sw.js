self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open('trivial-atm-v1').then((cache) => {
            return cache.addAll([
                './',
                './index.html',
                './styles.css',
                './script.js',
                './manifest.json',
                './ESCUDO ATM.png',
                './icono_trivial.png'
            ]);
        })
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});