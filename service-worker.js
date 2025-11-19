const CACHE_NAME = 'app-launcher-cache-v1';
const urlsToCache = [
    './',
    './index.html',
    './manifest.json',
    './icon-192x192.png',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;700&display=swap',
    // 雖然您的子網站是外部連結，但如果它們也是靜態的，可以考慮快取它們的主頁面
    './tra-search/index.html',
    './trip_planner/index.html',
    './cheatsheet/index.html',
    './MTG_Query/index.html',
    './icon-512x512.png'
];

// 安裝 Service Worker 並快取資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 1. 快取內部資源 (使用 cache.addAll)
      const internalCachePromise = cache.addAll(urlsToCache);
      
      // 2. 單獨快取跨域資源 (使用 fetch 配合 no-cors)
      const cdnCachePromise = fetch('https://cdn.tailwindcss.com/', { mode: 'no-cors' })
        .then(response => {
          // 由於是 no-cors，response.ok 可能是 false，但仍可以快取
          return cache.put('https://cdn.tailwindcss.com/', response);
        });

      // 等待所有快取完成
      return Promise.all([internalCachePromise, cdnCachePromise]);
    })
  );
});

// 攔截網路請求，優先從快取中回應
self.addEventListener('fetch', event => {
  // 忽略跨域的 API 請求，我們只快取靜態資源
  if (event.request.url.startsWith('https://tdx.transportdata.tw')) {
    return;
  }
  if (event.request.url.startsWith('https://api.scryfall.com') || event.request.url.includes('googleapis.com')) {
    // 讓 API 請求直接走網路
    return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 快取中有資源則直接回傳
        if (response) {
          return response;
        }
        // 快取中沒有則嘗試發出網路請求
        return fetch(event.request).then(
          (response) => {
            // 檢查回應是否有效
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 重要：複製回應，因為 stream 只能讀取一次
            const responseToCache = response.clone();

            // 將新請求到的資源加入快取 (背景更新)
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});

// 清理舊的快取
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
