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
    if (ЦВЕТА[к]) return null;   // «orange» без артикля — цвет, а не апельсин (die Orange — фото)
    var ф = слова[к];
    if (!ф) {  // «der Arzt» нет, а «Arzt» есть — или наоборот
      var б = к.replace(/^(der|die|das|ein|eine) /, '');
      ф = слова[б];
    }
    return ф ? база + 'img/slova/' + ф : null;
  }

  // 24.10.2026, врач: «если grün — табличка зелёная, если rot — красная»; у цветов фото нет — показываем сам цвет.
  // [фон, текст]: на светлых цветах текст тёмный.
  var ЦВЕТА = {
    'rot': ['#d32f2f', '#fff'], 'dunkelrot': ['#8b1a1a', '#fff'], 'hellrot': ['#ef6b6b', '#fff'],
    'blau': ['#1e5fd6', '#fff'], 'dunkelblau': ['#0f2a6b', '#fff'], 'hellblau': ['#8fcdf5', '#14213d'],
    'grün': ['#2e9d4a', '#fff'], 'dunkelgrün': ['#1b5e30', '#fff'], 'hellgrün': ['#9be27e', '#14213d'],
    'gelb': ['#f7d117', '#2b2100'], 'orange': ['#f57c00', '#fff'], 'braun': ['#7b4a2a', '#fff'],
    'beige': ['#e3d3b4', '#3a2c12'], 'weiß': ['#ffffff', '#1d1d1f'], 'schwarz': ['#111111', '#fff'],
    'grau': ['#8a8f98', '#fff'], 'hellgrau': ['#cfd2d6', '#1d1d1f'], 'dunkelgrau': ['#4a4e55', '#fff'],
    'rosa': ['#f7b3cb', '#3d1022'], 'pink': ['#ff3d9a', '#fff'], 'lila': ['#8e44ad', '#fff'],
    'violett': ['#6a2c91', '#fff'], 'türkis': ['#1abc9c', '#fff'], 'gold': ['#d4a017', '#2b2100'],
    'golden': ['#d4a017', '#2b2100'], 'silber': ['#c0c4ca', '#1d1d1f'], 'silbern': ['#c0c4ca', '#1d1d1f'],
    'bunt': ['linear-gradient(90deg,#d32f2f,#f57c00,#f7d117,#2e9d4a,#1e5fd6,#8e44ad)', '#fff']
  };
  function цвет(de) {
    var к = ключ(de);
    if (/^(der|die) /.test(к)) return null;        // die Orange — фрукт, das Gold — металл… кроме «das Rot»
    к = к.replace(/^das /, '');
    if (/^(gold|silber)$/.test(к) && /^das /.test(ключ(de))) return null;
    return ЦВЕТА[к] || null;
  }
  // квадрат цвета на месте фото (ЗУБР, игры)
  function образец(de, класс) {
    var ц = цвет(de);
    return ц ? '<div class="gd-цвет ' + (класс || '') + '" style="background:' + ц[0] + '"></div>' : '';
  }

  var стиль = document.createElement('style');
  стиль.textContent =
    '.gd-обложка{ margin:14px 0 18px; border-radius:18px; overflow:hidden; box-shadow:0 10px 28px rgba(30,40,90,.14); }' +
    '.gd-обложка img{ display:block; width:100%; aspect-ratio:16/9; object-fit:cover; }' +
    '.wcard .gd-фото{ width:58px; height:58px; flex:0 0 58px; border-radius:12px; object-fit:cover; margin-right:10px; cursor:zoom-in;' +
    '  background:#eceaf0; }' +
    '.gd-крупно{ position:fixed; inset:0; z-index:10000; background:rgba(10,12,25,.86); display:flex; align-items:center;' +
    '  justify-content:center; padding:16px; cursor:zoom-out; }' +
    '.gd-крупно img{ max-width:min(92vw,640px); max-height:86vh; border-radius:18px; }' +
    '.gd-окрашена{ border-color:rgba(0,0,0,.18) !important; }' +
    '.gd-окрашена .de, .gd-окрашена .tr, .gd-окрашена .ru{ color:inherit !important; }' +
    '.gd-окрашена .tr, .gd-окрашена .ru{ opacity:.85; }' +
    '.gd-окрашена .swatch{ display:none; }' +
    '.gd-фото-фраза{ width:46px; height:46px; flex:0 0 46px; border-radius:10px; object-fit:cover; margin-right:8px; cursor:zoom-in; background:#eceaf0; }' +
    '.pcard{ align-items:center; }' +
    '.gd-цвет{ border-radius:18px; box-shadow:inset 0 0 0 1px rgba(0,0,0,.12); }';
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
    // карточки слов в уроках бывают трёх видов: .wcard (почти везде), .color-card (урок 7), .mini-card (Даша 1)
    Array.prototype.forEach.call((корень || document).querySelectorAll('.wcard, .color-card, .mini-card'), function (к) {
      if (к.querySelector('.gd-фото') || к.classList.contains('gd-окрашена')) return;
      var de = к.querySelector('.de');
      var ц = de && цвет(de.innerHTML);
      if (ц) {   // карточка цвета — сама этого цвета
        к.classList.add('gd-окрашена');
        к.style.background = ц[0]; к.style.color = ц[1];
        return;
      }
      if (!к.classList.contains('wcard')) return;
      var url = de && путь(de.innerHTML);
      if (!url) return;
      var img = document.createElement('img');
      img.className = 'gd-фото'; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = url;
      img.onclick = function (e) { e.stopPropagation(); крупно(url); };
      img.onerror = function () { img.remove(); };
      к.insertBefore(img, к.firstChild);
    });
  }

  /* 27.10.2026, врач: «много названий не экранизированы» — фото и у фраз (.pcard), и у предложений домашки (.hwrow).
     Берём существительное с фото; в паре «вопрос? ответ» — из ответа (Sind Sie Ingenieur? Nein, ich bin Fernfahrer → Fernfahrer). */
  function фотоФразы(текст) {
    var т = String(текст || '').replace(/<[^>]+>/g, ' ');
    var части = т.split('?'), хвост = части.length > 1 ? части[части.length - 1] : '';
    function искать(кусок) {
      var слова = кусок.split(/\s+/);
      for (var i = 0; i < слова.length; i++) {
        var с = слова[i].replace(/[^A-Za-zÄÖÜäöüß-]/g, '');
        if (с.length < 3 || с[0] === с[0].toLowerCase() || /^(Sie|Ihr|Ihnen|Ihre|Ich|Wir|Er|Es)$/.test(с)) continue;
        var п = путь(с);
        if (п) return п;
      }
      return null;
    }
    return (хвост && искать(хвост)) || искать(т);
  }
  function фразы(корень) {
    Array.prototype.forEach.call((корень || document).querySelectorAll('.pcard, .hwrow'), function (к) {
      if (к.querySelector('.gd-фото, .hw-фото') || к.closest('.иг-экран')) return;
      var исх = к.classList.contains('hwrow') ? к.querySelector('.q') : к.querySelector('.de');
      if (!исх) return;
      var текст = исх.innerHTML.replace(/<span class="hw-tr"[\s\S]*?<\/span>/g, '').replace(/<input[^>]*>/g, ' ');
      var url = фотоФразы(текст);
      if (!url) return;
      var img = document.createElement('img');
      img.className = 'gd-фото gd-фото-фраза'; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.src = url;
      img.onclick = function (e) { e.stopPropagation(); крупно(url); };
      img.onerror = function () { img.remove(); };
      к.insertBefore(img, к.firstChild);
    });
  }

  var готово = Promise.all([
    fetch(база + 'img/slova.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }),
    fetch(база + 'img/sceny.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; })
  ]).then(function (о) { слова = о[0] || {}; сцены = о[1] || {}; });

  window.КАРТИНКИ = { готово: готово, путь: путь, крупно: крупно, карточки: карточки, фразы: фразы, фотоФразы: фотоФразы, цвет: цвет, образец: образец };

  function применить() { обложка(); карточки(); фразы(); }
  готово.then(function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', применить);
    else применить();
    // карточки слов рисует скрипт урока — бывает, позже нас
    window.addEventListener('load', function () { карточки(); фразы(); });
  });
})();
