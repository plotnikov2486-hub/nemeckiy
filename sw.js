/* Офлайн для всего сайта.

   Страницы берём сначала из сети — иначе новый урок или правка движка
   будут месяцами не долетать до телефона. Если сети нет, отдаём копию
   из кэша. Звук, словари и картинки, наоборот, из кэша сразу: они
   тяжёлые и почти не меняются.  */

const ВЕРСИЯ = 'nemeckiy-v17';
const ОСНОВА = [
  './',
  './index.html',
  './zubr.html',
  './trenazhyor.html',
  './stat.html',
  './manifest.json',
  './words/индекс.json',
  './words/zubr.json',
  './icons/icon-192.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(ВЕРСИЯ)
      .then(к => Promise.allSettled(ОСНОВА.map(п => к.add(п))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(имена => Promise.all(имена.filter(и => и !== ВЕРСИЯ).map(и => caches.delete(и))))
      .then(() => self.clients.claim())
  );
});

function этоТяжёлое(url) {
  return /\.(mp3|png|jpg|jpeg|svg|woff2?|pdf)$/i.test(url.pathname) ||
         url.pathname.includes('/words/');
}

self.addEventListener('fetch', e => {
  const запрос = e.request;
  if (запрос.method !== 'GET') return;

  const url = new URL(запрос.url);
  // переводчик ходит в чужие домены — их не трогаем совсем
  if (url.origin !== self.location.origin) return;

  if (этоТяжёлое(url)) {
    // сначала кэш: звук и словари меняются редко, а весят много
    e.respondWith(
      caches.match(запрос).then(готовое => готовое || fetch(запрос).then(ответ => {
        if (ответ.ok) {
          const копия = ответ.clone();
          caches.open(ВЕРСИЯ).then(к => к.put(запрос, копия));
        }
        return ответ;
      }))
    );
    return;
  }

  // страницы: сначала сеть, чтобы правки долетали сразу
  e.respondWith(
    fetch(запрос).then(ответ => {
      if (ответ.ok) {
        const копия = ответ.clone();
        caches.open(ВЕРСИЯ).then(к => к.put(запрос, копия));
      }
      return ответ;
    }).catch(() => caches.match(запрос).then(готовое => готовое ||
        caches.match('./index.html')))
  );
});
