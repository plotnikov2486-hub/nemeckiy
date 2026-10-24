/* Картинки GlobalDoc на страницах уроков (24.10.2026). Публикуется как kartinki.js, подключается блоком игр.
   Врач: «вставляй везде — в уроки, в домашку, в ЗУБР». Картинки сгенерированы Nano Banana, сжаты в webp
   (картинки/картинки_на_сайт.py) и лежат в img/slova/*.webp и img/sceny/*.webp; что к чему — img/slova.json, img/sceny.json.

   Что делает сам, без правки уроков:
     • обложка урока — сцена из img/sceny.json по имени страницы (urok12 → 013.webp) сразу под заголовком;
     • маленькая картинка в каждой карточке слова (.wcard), если для слова есть фото; нажатие — крупно;
   и даёт другим (игры, домашка, ЗУБР):
     КАРТИНКИ.готово      — Promise, когда указатели загружены;
     КАРТИНКИ.путь(de)    — адрес картинки к немецкому слову/фразе или null («der Teller, die Teller» → der_Teller.webp);
     КАРТИНКИ.крупно(url) — показать картинку на весь экран.
   Новые уроки получают всё это сами: достаточно, чтобы слово/сцена были в указателях. */
(function () {
  if (window.КАРТИНКИ) return;
  var база = (function () {
    var s = document.currentScript && document.currentScript.getAttribute('src') || '';
    return s.indexOf('../') === 0 ? '../' : '';
  })();
  var слова = {}, сцены = {};

  function ключ(t) {
    return String(t || '').replace(/<[^>]+>/g, ' ').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
      .split(/[,;·•/]| — | – /)[0].replace(/[.!?:«»"„“]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function путь(de) {
    var к = ключ(de);
    if (!к) return null;
    var ф = слова[к];
    if (!ф) {  // «der Arzt» нет, а «Arzt» есть — или наоборот
      var б = к.replace(/^(der|die|das|ein|eine) /, '');
      ф = слова[б];
    }
    return ф ? база + 'img/slova/' + ф : null;
  }

  var стиль = document.createElement('style');
  стиль.textContent =
    '.gd-обложка{ margin:14px 0 18px; border-radius:18px; overflow:hidden; box-shadow:0 10px 28px rgba(30,40,90,.14); }' +
    '.gd-обложка img{ display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }' +
    '.wcard .gd-фото{ width:58px; height:58px; flex:0 0 58px; border-radius:12px; object-fit:cover; margin-right:10px; cursor:zoom-in;' +
    '  background:#eceaf0; }' +
    '.gd-крупно{ position:fixed; inset:0; z-index:10000; background:rgba(10,12,25,.86); display:flex; align-items:center;' +
    '  justify-content:center; padding:16px; cursor:zoom-out; }' +
    '.gd-крупно img{ max-width:min(92vw,640px); max-height:86vh; border-radius:18px; }';
  document.head.appendChild(стиль);

  function крупно(url) {
    var о = document.createElement('div'); о.className = 'gd-крупно';
    о.innerHTML = '<img alt="">'; о.firstChild.src = url;
    о.onclick = function () { о.remove(); };
    document.body.appendChild(о);
  }

  function обложка() {
    var имя = (location.pathname.split('/').pop() || '').replace('_interactive.html', '').replace('.html', '');
    var ф = сцены[имя];
    if (!ф || document.querySelector('.gd-обложка')) return;
    var h1 = document.querySelector('.lp h1, main h1, h1');
    if (!h1) return;
    var после = h1.nextElementSibling && h1.nextElementSibling.classList.contains('lede') ? h1.nextElementSibling : h1;
    var ф2 = document.createElement('figure'); ф2.className = 'gd-обложка';
    ф2.innerHTML = '<img alt="" fetchpriority="high" decoding="async">';  // обложка вверху — грузим сразу
    ф2.firstChild.src = база + 'img/sceny/' + ф;
    после.parentNode.insertBefore(ф2, после.nextSibling);
  }

  function карточки(корень) {
    Array.prototype.forEach.call((корень || document).querySelectorAll('.wcard'), function (к) {
      if (к.querySelector('.gd-фото')) return;
      var de = к.querySelector('.de');
      var url = de && путь(de.innerHTML);
      if (!url) return;
      var img = document.createElement('img');
      img.className = 'gd-фото'; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = url;
      img.onclick = function (e) { e.stopPropagation(); крупно(url); };
      img.onerror = function () { img.remove(); };
      к.insertBefore(img, к.firstChild);
    });
  }

  var готово = Promise.all([
    fetch(база + 'img/slova.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    fetch(база + 'img/sceny.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (о) { слова = о[0] || {}; сцены = о[1] || {}; });

  window.КАРТИНКИ = { готово: готово, путь: путь, крупно: крупно, карточки: карточки };

  function применить() { обложка(); карточки(); }
  готово.then(function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', применить);
    else применить();
    // карточки слов рисует скрипт урока — бывает, позже нас
    window.addEventListener('load', function () { карточки(); });
  });
})();
