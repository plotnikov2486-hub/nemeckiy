/* ЯДРО ИГР — один движок на все игры немецкого.
   Живёт одним файлом igry.js в корне сайта: правится в одном месте,
   подключается и в уроки, и на страницу «Поиграем», и (позже) в кабинет.

   Как звать:
     ИГРЫ.старт({ корень: узел, слова: [...], урок: 'polya12', база: '../' });

   слова — тот же массив, что кормит ЗУБР (words/<урок>.json):
     [ид, немецкое, транскрипция, перевод, ...]

   Игры сами решают, хватает ли им материала: где нет — не показываются.
   Никакой ручной подготовки к уроку не нужно.                            */
(function () {
'use strict';

/* ───────────────────────── мелочи ───────────────────────── */

function экр(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function перемешать(a) {
  a = a.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/* Отрезаем пояснения: «der Tisch → die Tische» и «(что-то)» */
function чисто(s) {
  return String(s || '').split(/\s+[—–→]\s+/)[0]
    .replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Та же строгость сверки, что в ЗУБРе: прощаем регистр, знаки и ae/oe/ue/ss */
function норм(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[.,!?;:()«»"'’\-–—/]/g, ' ').replace(/\s+/g, ' ').trim();
}

function слова_(s) { return чисто(s).split(/\s+/).filter(Boolean); }

/* Расстояние Левенштейна — для подсказки «почти, проверь написание» (с 15.10.2026, как на ZUM) */
function левенштейн(a, b) {
  a = String(a); b = String(b);
  var d = [], i, j;
  for (i = 0; i <= a.length; i++) d[i] = [i];
  for (j = 0; j <= b.length; j++) d[0][j] = j;
  for (i = 1; i <= a.length; i++)
    for (j = 1; j <= b.length; j++)
    {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // перестановка соседних букв (Ärtzin ↔ Ärztin) — одна опечатка, а не две
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}
/* «Ärtzin» вместо «Ärztin» — опечатка, а не незнание: 1 ошибка на короткое слово, 2 — на длинное */
function опечатка(ввод, верно) {
  var a = String(ввод || '').trim(), b = String(верно || '').trim();
  if (!a || a === b) return false;
  // разница только в окончании (jenen/jenem, der/dem, sint/sind) — это падеж или форма, а не опечатка
  var x = a.toLowerCase(), y = b.toLowerCase(), общ = 0;
  while (общ < Math.min(x.length, y.length) && x[общ] === y[общ]) общ++;
  if (общ >= Math.min(x.length, y.length) - 2 && Math.abs(x.length - y.length) <= 2) return false;
  var н = левенштейн(x, y);
  return н > 0 && н <= (b.length >= 7 ? 2 : 1);
}
window.ИГРЫ_ОПЕЧАТКА = опечатка;   // домашка тоже пользуется

/* Настоящие предложения (с точкой/вопросом), а не строчки словаря «die Wolke, die Wolken» */
function предложения(д, макс) {
  var п = д.фразы.filter(function (ф) { return /[.!?]["»]?\s*$/.test(ф.de) && ф.н <= (макс || 12); });
  return п.length >= 4 ? п : д.фразы.filter(function (ф) { return ф.н <= (макс || 12); });
}

function распознавание() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

/* Фразы урока группами по началу ид (bs1…bs18 — одна группа): в группе порядок как в уроке */
function группы(д) {
  var г = {}, порядок = [];
  д.фразы.forEach(function (ф) {
    var к = String(ф.ид || '').replace(/\d+$/, '');
    if (!к) return;
    if (!г[к]) { г[к] = []; порядок.push(к); }
    г[к].push(ф);
  });
  return порядок.map(function (к) { return г[к]; });
}

/* слово без обрамляющих знаков: «dick,» → «dick» */
function голое(с) {
  return String(с || '').replace(/^[«»"'(\[]+/, '').replace(/[.,!?;:«»"')\]]+$/, '');
}

function звук(верно) {
  try {
    if (localStorage.getItem('nemeckiy_zvuk_выкл') === '1') return;
    var имя = верно ? (localStorage.getItem('nemeckiy_zvuk_верно') || 'верно2')
                    : (localStorage.getItem('nemeckiy_zvuk_мимо') || 'мимо2');
    new Audio(ИГРЫ.база + 'zvuk/otvet/' + имя + '.mp3').play().catch(function () {});
  } catch (e) {}
}

function профиль() {
  try { return localStorage.getItem('nemeckiy_profile') || 'grigoriy'; } catch (e) { return 'grigoriy'; }
}

/* ───────────────────────── стиль ───────────────────────── */

var СТИЛЬ = ''
+ '.игры{ margin:40px 0 0; font-family:-apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif; }'
+ '.иг-карта{ background:var(--surface,#fff); color:var(--ink,#1c2242); border:1px solid var(--line,#e4e6ef);'
+ '  border-radius:18px; padding:20px 18px; box-shadow:var(--shadow,0 8px 24px rgba(40,50,110,.10)); }'
+ '.иг-верх{ display:flex; align-items:center; gap:12px; margin-bottom:4px; }'
+ '.иг-знак{ width:44px; height:44px; border-radius:13px; flex:0 0 auto; font-size:22px; display:flex;'
+ '  align-items:center; justify-content:center; background:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); }'
+ '.иг-карта h2{ font-size:20px; font-weight:800; margin:0; font-family:inherit; letter-spacing:-.01em; }'
+ '.иг-карта p.иг-под{ font-size:13.5px; color:var(--ink-muted,#5b615c); margin:2px 0 16px; line-height:1.45; }'
+ '.иг-меню{ display:grid; gap:10px; }'
+ '.иг-кн{ display:flex; align-items:center; gap:12px; width:100%; text-align:left; cursor:pointer;'
+ '  background:var(--surface-2,#f3f4fa); color:inherit; border:1px solid var(--line,#e4e6ef);'
+ '  border-radius:14px; padding:13px 15px; font:inherit; font-size:15px; font-weight:700; min-height:56px; }'
+ '.иг-кн:active{ transform:scale(.99); }'
+ '.иг-кн i{ font-style:normal; font-size:22px; }'
+ '.иг-кн span{ flex:1; }'
+ '.иг-кн small{ display:block; font-weight:500; font-size:12.5px; color:var(--ink-muted,#5b615c); margin-top:2px; }'
+ '.иг-кн b.иг-рекорд{ font-size:12.5px; font-weight:700; color:var(--accent,#1f5f5b); white-space:nowrap; }'
+ '.иг-шапка{ display:flex; align-items:center; gap:10px; margin-bottom:14px; }'
+ '.иг-шапка .иг-назад{ background:none; border:none; font:inherit; font-size:14px; cursor:pointer;'
+ '  color:var(--ink-muted,#5b615c); padding:6px 8px 6px 0; }'
+ '.иг-полоса{ flex:1; height:8px; border-radius:99px; background:var(--surface-2,#eceef6); overflow:hidden; }'
+ '.иг-полоса i{ display:block; height:100%; background:var(--accent,#1f5f5b); transition:width .25s ease; }'
+ '.иг-счёт{ font-size:13px; font-weight:700; color:var(--ink-muted,#5b615c); white-space:nowrap; }'
+ '.иг-ру{ font-size:17px; font-weight:700; line-height:1.35; margin:0 0 4px; }'
+ '.иг-де{ font-family:Georgia,"Iowan Old Style",serif; font-size:19px; font-weight:700; margin:0 0 4px; }'
+ '.иг-тр{ font-size:13px; color:var(--tr,#8a2be2); margin:0 0 10px; }'
+ '.иг-подсказ{ font-size:13px; color:var(--ink-muted,#5b615c); margin:0 0 12px; }'
+ '.иг-строка{ min-height:52px; display:flex; flex-wrap:wrap; gap:7px; align-content:flex-start;'
+ '  padding:9px; border-radius:13px; border:2px dashed var(--line,#dde0d9); margin-bottom:12px; }'
+ '.иг-плитки{ display:flex; flex-wrap:wrap; gap:7px; margin-bottom:14px; }'
+ '.иг-плитка{ font:inherit; font-family:Georgia,"Iowan Old Style",serif; font-size:16px; font-weight:600;'
+ '  padding:10px 13px; border-radius:11px; cursor:pointer; min-height:44px;'
+ '  background:var(--surface-2,#f3f4fa); color:inherit; border:1px solid var(--line,#e4e6ef); }'
+ '.иг-плитка:active{ transform:scale(.97); }'
+ '.иг-плитка.взята{ opacity:.28; pointer-events:none; }'
+ '.иг-верно{ background:var(--accent,#1f5f5b)!important; color:var(--accent-ink,#fff)!important;'
+ '  border-color:var(--accent,#1f5f5b)!important; }'
+ '.иг-мимо{ background:var(--warn-bg,#fbeae6)!important; color:var(--warn,#b3402a)!important;'
+ '  border-color:var(--warn,#b3402a)!important; }'
+ '.иг-варианты{ display:grid; gap:9px; margin-bottom:12px; }'
+ '.иг-вариант{ font:inherit; font-size:16px; font-weight:600; padding:13px 15px; border-radius:13px; cursor:pointer;'
+ '  text-align:left; min-height:50px; background:var(--surface-2,#f3f4fa); color:inherit;'
+ '  border:1px solid var(--line,#e4e6ef); font-family:Georgia,"Iowan Old Style",serif; }'
+ '.иг-роды{ display:grid; grid-template-columns:repeat(3,1fr); gap:9px; margin-bottom:12px; }'
+ '.иг-род{ font:inherit; font-size:17px; font-weight:800; padding:15px 6px; border-radius:13px; cursor:pointer;'
+ '  border:2px solid var(--line,#e4e6ef); background:var(--surface-2,#f3f4fa); min-height:58px; }'
+ '.иг-род[data-род="der"]{ color:var(--der,#1f6f8b); }'
+ '.иг-род[data-род="die"]{ color:var(--die,#a03060); }'
+ '.иг-род[data-род="das"]{ color:var(--das,#8a6d1a); }'
+ '.иг-табло{ display:flex; gap:7px; flex-wrap:wrap; font-size:12.5px; color:var(--ink-muted,#5b615c); margin-bottom:10px; }'
+ '.иг-табло span{ padding:3px 9px; border-radius:99px; background:var(--surface-2,#f3f4fa); }'
+ '.иг-сцена{ position:relative; border-radius:14px; overflow:hidden; margin-bottom:12px;'
+ '  border:1px solid var(--line,#e4e6ef); }'
+ '.иг-сцена svg{ display:block; width:100%; height:auto; }'
+ '.иг-точка{ cursor:pointer; fill:rgba(31,95,91,.001); stroke:rgba(31,95,91,.35); stroke-width:1.5;'
+ '  stroke-dasharray:4 4; }'
+ '.иг-точка:active{ fill:rgba(31,95,91,.15); }'
+ '.иг-точка.готова{ fill:rgba(31,95,91,.18); stroke:var(--accent,#1f5f5b); stroke-dasharray:none; }'
+ '.иг-точка.ошиблись{ fill:rgba(179,64,42,.22); stroke:#b3402a; stroke-dasharray:none; }'
+ '.иг-звук{ font:inherit; font-size:13px; font-weight:700; cursor:pointer; padding:7px 12px; min-height:38px;'
+ '  border-radius:99px; border:1px solid var(--line,#e4e6ef); background:var(--surface-2,#f3f4fa); color:inherit; }'
+ '.иг-низ{ display:flex; gap:9px; flex-wrap:wrap; }'
+ '.иг-главная{ font:inherit; font-size:15px; font-weight:700; padding:13px 20px; border-radius:13px; cursor:pointer;'
+ '  border:none; background:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); min-height:48px; flex:1; }'
+ '.иг-тихая{ font:inherit; font-size:15px; font-weight:600; padding:13px 18px; border-radius:13px; cursor:pointer;'
+ '  border:1px solid var(--line,#e4e6ef); background:transparent; color:inherit; min-height:48px; }'
+ '.иг-ответ{ font-size:14px; line-height:1.45; padding:11px 13px; border-radius:12px; margin-bottom:12px; }'
+ '.иг-ответ.верно{ background:rgba(31,95,91,.10); }'
+ '.иг-ответ.мимо{ background:var(--warn-bg,#fbeae6); color:var(--warn,#b3402a); }'
+ '.иг-ответ .де{ font-family:Georgia,"Iowan Old Style",serif; font-weight:700; }'
+ '.иг-итог{ text-align:center; padding:6px 0 14px; }'
+ '.иг-итог .число{ font-size:44px; font-weight:900; line-height:1.1; color:var(--accent,#1f5f5b); }'
+ '.иг-итог .строка{ font-size:14.5px; margin-top:4px; color:var(--ink-muted,#5b615c); }'
+ '.иг-разбор{ text-align:left; margin:14px 0 4px; }'
+ '.иг-разбор h3{ font-size:13.5px; margin:0 0 8px; font-family:inherit; }'
+ '.иг-разбор div{ font-size:13.5px; padding:8px 11px; border-radius:11px; margin-bottom:6px;'
+ '  background:var(--warn-bg,#fbeae6); line-height:1.4; }'
+ '.иг-пары{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:10px 0 4px; }'
+ '.иг-пара{ font:inherit; font-size:13.5px; font-weight:600; min-height:66px; padding:8px 6px; cursor:pointer;'
+ '  border-radius:13px; border:1px solid var(--line,#e4e6ef); background:var(--accent,#1f5f5b);'
+ '  color:var(--accent-ink,#fff); line-height:1.25; word-break:break-word; }'
+ '.иг-пара.открыта{ background:var(--surface-2,#f3f4fa); color:var(--ink,#1c2242);'
+ '  font-family:Georgia,"Iowan Old Style",serif; }'
+ '.иг-пара.нашлась{ background:rgba(31,95,91,.14); color:var(--ink,#1c2242); border-color:var(--accent,#1f5f5b);'
+ '  font-family:Georgia,"Iowan Old Style",serif; cursor:default; }'
+ '.иг-колесо{ min-height:104px; display:flex; align-items:center; justify-content:center; text-align:center;'
+ '  font-family:Georgia,"Iowan Old Style",serif; font-size:24px; font-weight:700; padding:14px 12px;'
+ '  border-radius:16px; background:var(--surface-2,#f3f4fa); border:2px dashed var(--line,#dde0d9);'
+ '  margin:8px 0 12px; transition:opacity .2s ease; }'
+ '.иг-колесо.крутится{ opacity:.25; }'
+ '.иг-вдомашке{ margin-top:18px; padding:14px 15px; border-radius:14px; border:1px dashed var(--accent,#1f5f5b);'
+ '  background:rgba(31,95,91,.06); }'
+ '.иг-вдомашке b{ font-size:15px; }'
+ '.иг-вдомашке p{ font-size:13px; color:var(--ink-muted,#5b615c); margin:4px 0 10px; line-height:1.45; }'
+ '.иг-вдомашке-кн{ display:flex; flex-wrap:wrap; gap:8px; }'
+ '.иг-вдомашке-кн button{ font:inherit; font-size:13.5px; font-weight:600; padding:9px 14px; min-height:42px;'
+ '  cursor:pointer; border-radius:11px; border:1px solid var(--line,#e4e6ef);'
+ '  background:var(--surface,#fff); color:var(--ink,#1c2242); }'
+ '.иг-вдомашке-кн button:active{ transform:scale(.98); }'
+ '.иг-вкладки{ display:flex; gap:7px; margin-bottom:10px; }'
+ '.иг-мини{ font:inherit; font-size:12.5px; font-weight:600; padding:7px 13px; min-height:36px; cursor:pointer;'
+ '  border-radius:999px; border:1px solid var(--line,#e4e6ef); background:var(--surface-2,#f3f4fa); color:inherit; }'
+ '.иг-мини.вкл{ background:var(--accent,#1f5f5b); border-color:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); }'
+ '.иг-стена{ display:grid; grid-template-columns:repeat(auto-fill,minmax(92px,1fr)); gap:7px; margin:8px 0 6px; }'
+ '.иг-плита{ font:inherit; position:relative; min-height:78px; padding:8px 5px 7px; cursor:pointer; border-radius:12px;'
+ '  border:2px solid var(--line,#e4e6ef); background:var(--surface,#fff); color:var(--ink,#1c2242);'
+ '  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; line-height:1.2;'
+ '  font-size:12.5px; font-weight:600; overflow-wrap:anywhere; hyphens:auto; transition:transform .12s ease; }'
+ '.иг-плита:active{ transform:scale(.96); }'
+ '.иг-плита i{ font-style:normal; font-size:26px; line-height:1; }'
+ '.иг-плита.де{ font-family:Georgia,"Iowan Old Style",serif; }'
+ '.иг-плита.ц0{ border-color:#5aa9e6; } .иг-плита.ц1{ border-color:#7bc47f; } .иг-плита.ц2{ border-color:#f2a541; }'
+ '.иг-плита.ц3{ border-color:#e36f8f; } .иг-плита.ц4{ border-color:#b28dd6; } .иг-плита.ц5{ border-color:#e8c547; }'
+ '.иг-плита.убрана{ visibility:hidden; }'
+ '.иг-панель{ display:flex; flex-wrap:wrap; gap:7px; margin:6px 0 2px; }'
+ '.иг-зум{ display:flex; align-items:center; gap:8px; margin:6px 0 10px; }'
+ '.иг-зум .иг-стрелка{ font:inherit; font-size:24px; width:42px; min-height:120px; border-radius:12px; cursor:pointer;'
+ '  border:1px solid var(--line,#e4e6ef); background:var(--surface-2,#f3f4fa); color:inherit; flex:0 0 auto; }'
+ '.иг-зум .иг-стрелка:disabled{ opacity:.3; cursor:default; }'
+ '.иг-большая{ flex:1; min-height:190px; border-radius:18px; border:3px solid var(--accent,#1f5f5b); cursor:pointer;'
+ '  background:var(--surface,#fff); display:flex; flex-direction:column; align-items:center; justify-content:center;'
+ '  gap:8px; padding:16px 12px; text-align:center; transition:transform .25s ease; user-select:none; touch-action:pan-y; }'
+ '.иг-большая.оборот{ background:var(--surface-2,#f3f4fa); }'
+ '.иг-большая.вертится{ transform:rotateY(90deg); }'
+ '.иг-большая i{ font-style:normal; font-size:54px; line-height:1; }'
+ '.иг-большая b{ font-size:23px; line-height:1.25; }'
+ '.иг-большая b.де{ font-family:Georgia,"Iowan Old Style",serif; }'
+ '.иг-большая small{ font-size:13px; color:var(--ink-muted,#5b615c); }'
+ '.иг-время{ font-variant-numeric:tabular-nums; font-weight:700; }'
+ '.иг-полка{ position:sticky; top:0; z-index:3; display:flex; flex-wrap:wrap; gap:7px; padding:10px;'
+ '  margin:0 0 12px; border-radius:14px; background:var(--surface-2,#f3f4fa); border:1px solid var(--line,#e4e6ef); min-height:58px; }'
+ '.иг-полка.пусто::after{ content:"все книжки расставлены — жми «Проверить»"; font-size:13px; color:var(--ink-muted,#5b615c); align-self:center; }'
+ '.иг-книга{ font:inherit; font-family:Georgia,"Iowan Old Style",serif; font-size:15.5px; font-weight:700; cursor:grab;'
+ '  padding:8px 12px 8px 14px; min-height:40px; border-radius:6px 10px 10px 6px; border:1px solid var(--line,#e4e6ef);'
+ '  border-left:6px solid #5aa9e6; background:var(--surface,#fff); color:var(--ink,#1c2242); touch-action:none;'
+ '  user-select:none; -webkit-user-select:none; box-shadow:0 2px 0 rgba(0,0,0,.08); }'
+ '.иг-книга.ц1{ border-left-color:#7bc47f; } .иг-книга.ц2{ border-left-color:#f2a541; } .иг-книга.ц3{ border-left-color:#e36f8f; }'
+ '.иг-книга.ц4{ border-left-color:#b28dd6; } .иг-книга.ц5{ border-left-color:#e8c547; }'
+ '.иг-книга.выбрана{ outline:3px solid var(--accent,#1f5f5b); outline-offset:2px; }'
+ '.иг-книга.летит{ position:fixed; z-index:9999; pointer-events:none; opacity:.92; transform:rotate(-3deg) scale(1.05);'
+ '  box-shadow:0 10px 24px rgba(0,0,0,.25); }'
+ '.иг-книга.тень{ opacity:.3; }'
+ '.иг-текст{ display:grid; gap:4px; margin-bottom:14px; }'
+ '.иг-текст .ряд{ font-family:Georgia,"Iowan Old Style",serif; font-size:17px; line-height:2.3; padding:2px 0;'
+ '  border-bottom:1px dashed var(--line,#e4e6ef); }'
+ '.иг-текст .ряд small{ display:block; font-family:-apple-system,"SF Pro Text",Arial,sans-serif; font-size:12.5px;'
+ '  line-height:1.3; color:var(--ink-muted,#5b615c); margin:-4px 0 4px; }'
+ '.иг-дырка{ display:inline-flex; align-items:center; justify-content:center; min-width:84px; min-height:38px;'
+ '  vertical-align:middle; margin:0 3px; border-radius:8px; border:2px dashed var(--line,#c9ccd8);'
+ '  background:var(--surface-2,#f3f4fa); cursor:pointer; padding:0 2px; }'
+ '.иг-дырка.цель{ border-color:var(--accent,#1f5f5b); background:rgba(31,95,91,.10); }'
+ '.иг-дырка .иг-книга{ margin:2px 0; font-size:15px; min-height:32px; padding:4px 10px 4px 12px; }'
+ '.иг-дырка.да{ border:2px solid var(--accent,#1f5f5b); background:rgba(31,95,91,.12); }'
+ '.иг-дырка.нет{ border:2px solid var(--warn,#b3402a); background:var(--warn-bg,#fbeae6); }'
+ '.иг-дырка.нет .иг-книга{ text-decoration:line-through; opacity:.75; }'
+ '.иг-дырка .знак{ font-family:-apple-system,Arial,sans-serif; font-size:15px; font-weight:900; margin:0 4px; }'
+ '.иг-дырка.да .знак{ color:var(--accent,#1f5f5b); } .иг-дырка.нет .знак{ color:var(--warn,#b3402a); }'
+ '.иг-дырка .верн{ font-weight:800; color:var(--accent,#1f5f5b); margin:0 6px; }'
+ '.иг-табличка{ text-align:center; border-radius:16px; border:2px solid var(--accent,#1f5f5b); padding:14px 12px; margin:0 0 14px;'
+ '  background:var(--surface,#fff); }'
+ '.иг-табличка b{ display:block; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-muted,#5b615c); }'
+ '.иг-табличка .два{ display:flex; justify-content:center; gap:32px; margin:6px 0 10px; }'
+ '.иг-табличка .два div{ font-size:30px; font-weight:900; color:var(--accent,#1f5f5b); line-height:1.1; }'
+ '.иг-табличка .два small{ display:block; font-size:12px; font-weight:600; color:var(--ink-muted,#5b615c); }'
+ '.иг-мик{ font:inherit; font-size:17px; font-weight:800; padding:16px 22px; border-radius:99px; cursor:pointer; border:none;'
+ '  background:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); min-height:56px; }'
+ '.иг-мик.слушает{ background:var(--warn,#b3402a); animation:игПульс 1s infinite; }'
+ '@keyframes игПульс{ 0%{ box-shadow:0 0 0 0 rgba(179,64,42,.5);} 100%{ box-shadow:0 0 0 14px rgba(179,64,42,0);} }'
+ '.иг-слова{ font-family:Georgia,"Iowan Old Style",serif; font-size:17px; line-height:1.9; margin:8px 0 12px; }'
+ '.иг-слова .ок{ color:var(--accent,#1f5f5b); font-weight:700; } .иг-слова .нет{ color:var(--warn,#b3402a); text-decoration:underline wavy; }'
+ '.иг-слова .почти{ color:#c07a00; font-weight:700; }'
+ '.иг-поле{ width:100%; box-sizing:border-box; font:inherit; font-family:Georgia,"Iowan Old Style",serif; font-size:17px;'
+ '  padding:12px 13px; border-radius:12px; border:1px solid var(--line,#e4e6ef); background:var(--surface-2,#f3f4fa); color:inherit; margin-bottom:12px; }'
+ '.иг-метки{ display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 14px; }'
+ '.иг-метка{ font:inherit; font-family:Georgia,"Iowan Old Style",serif; font-size:16px; padding:8px 10px; border-radius:10px; cursor:pointer;'
+ '  border:1px solid var(--line,#e4e6ef); background:var(--surface,#fff); color:inherit; min-height:42px; }'
+ '.иг-метка.выбрана{ background:rgba(31,95,91,.16); border-color:var(--accent,#1f5f5b); font-weight:700; }'
+ '.иг-метка.нейтр{ cursor:default; opacity:.85; border-style:dashed; }'
+ '.иг-метка.пропущена{ outline:3px solid #c07a00; }'
+ '.иг-строки{ display:grid; gap:7px; margin-bottom:12px; }'
+ '.иг-строчка{ font:inherit; text-align:left; padding:10px 12px; border-radius:12px; cursor:pointer; border:1px solid var(--line,#e4e6ef);'
+ '  background:var(--surface-2,#f3f4fa); color:inherit; line-height:1.4; }'
+ '.иг-строчка b{ font-family:Georgia,"Iowan Old Style",serif; font-size:16px; } .иг-строчка small{ display:block; color:var(--ink-muted,#5b615c); font-size:12.5px; }'
+ '.иг-строчка .ном{ display:inline-block; min-width:22px; font-weight:800; color:var(--accent,#1f5f5b); }'
+ '.иг-карточка{ border-radius:18px; border:3px solid var(--accent,#1f5f5b); padding:18px 14px; text-align:center; margin:6px 0 12px; background:var(--surface,#fff); }'
+ '.иг-карточка .кто{ font-size:12.5px; color:var(--ink-muted,#5b615c); text-transform:uppercase; letter-spacing:.06em; }'
+ '.иг-карточка .реплика{ font-family:Georgia,"Iowan Old Style",serif; font-size:20px; font-weight:700; margin:6px 0; }'
+ '.иг-карточка .перев{ font-size:14px; color:var(--ink-muted,#5b615c); }'
+ '@media (max-width:420px){ .иг-кн{ font-size:14.5px; } .иг-де{ font-size:17px; } .иг-текст .ряд{ font-size:16px; }'
+ '  .иг-пара{ font-size:12.5px; min-height:60px; } .иг-колесо{ font-size:21px; }'
+ '  .иг-стена{ grid-template-columns:repeat(3,1fr); } .иг-большая b{ font-size:20px; } }';

function стиль() {
  if (document.getElementById('иг-стиль')) return;
  var s = document.createElement('style');
  s.id = 'иг-стиль'; s.textContent = СТИЛЬ;
  document.head.appendChild(s);
}

/* ───────────────────────── картинки для «подпиши» ───────────────────────── */
/* Рисунки свои, простые: так их можно печатать, красить под тему и не
   зависеть от чужих картинок с их лицензиями.                           */

var СЦЕНЫ = {
  кухня: {
    имя: 'Кухня',
    рисунок:
      '<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Кухня">' +
      '<rect width="400" height="260" fill="#f2ede5"/>' +
      '<rect y="205" width="400" height="55" fill="#e0d6c6"/>' +
      /* верхние шкафы */
      '<rect x="18" y="22" width="80" height="58" rx="4" fill="#cfd8d3" stroke="#9aa8a2"/>' +
      '<rect x="104" y="22" width="76" height="58" rx="4" fill="#cfd8d3" stroke="#9aa8a2"/>' +
      '<rect x="262" y="22" width="52" height="58" rx="4" fill="#cfd8d3" stroke="#9aa8a2"/>' +
      /* вытяжка */
      '<path d="M188 22 h66 v24 l-12 14 h-42 l-12-14 z" fill="#b9c3c8" stroke="#7d8a90"/>' +
      '<rect x="206" y="60" width="30" height="6" fill="#8e9aa0"/>' +
      /* столешница */
      '<rect x="14" y="140" width="300" height="12" rx="3" fill="#8d6e52"/>' +
      /* тумбы */
      '<rect x="18" y="152" width="62" height="53" fill="#dde3e0" stroke="#9aa8a2"/>' +
      '<rect x="84" y="152" width="62" height="53" fill="#dde3e0" stroke="#9aa8a2"/>' +
      '<rect x="150" y="152" width="46" height="53" fill="#dde3e0" stroke="#9aa8a2"/>' +
      '<rect x="156" y="162" width="34" height="5" rx="2" fill="#9aa8a2"/>' +
      '<rect x="156" y="178" width="34" height="5" rx="2" fill="#9aa8a2"/>' +
      /* духовка */
      '<rect x="200" y="152" width="58" height="53" fill="#5b6265" stroke="#3f4548"/>' +
      '<rect x="207" y="162" width="44" height="26" rx="3" fill="#2e3335"/>' +
      '<rect x="207" y="194" width="44" height="5" rx="2" fill="#aab2b5"/>' +
      /* плита (конфорки на столешнице) */
      '<rect x="200" y="128" width="58" height="14" rx="3" fill="#3f4548"/>' +
      '<circle cx="214" cy="135" r="4.5" fill="#8d9598"/><circle cx="230" cy="135" r="4.5" fill="#8d9598"/>' +
      '<circle cx="246" cy="135" r="4.5" fill="#8d9598"/>' +
      /* мойка и кран */
      '<rect x="92" y="126" width="46" height="16" rx="3" fill="#b8c0c4" stroke="#8b9498"/>' +
      '<path d="M112 126 v-16 a9 9 0 0 1 18 0" fill="none" stroke="#8b9498" stroke-width="4"/>' +
      /* посудомойка */
      '<rect x="18" y="152" width="62" height="53" fill="none" stroke="#7d8a90" stroke-dasharray="3 3"/>' +
      '<rect x="30" y="160" width="38" height="5" rx="2" fill="#9aa8a2"/>' +
      '<circle cx="66" cy="196" r="3" fill="#9aa8a2"/>' +
      /* холодильник */
      '<rect x="326" y="40" width="58" height="165" rx="6" fill="#d8dcde" stroke="#9aa2a6"/>' +
      '<line x1="326" y1="112" x2="384" y2="112" stroke="#9aa2a6"/>' +
      '<rect x="374" y="70" width="4" height="26" rx="2" fill="#8b9498"/>' +
      '<rect x="374" y="126" width="4" height="26" rx="2" fill="#8b9498"/>' +
      /* чайник */
      '<path d="M268 140 v-18 h20 v18 z" fill="#8d9598" stroke="#6d7578"/>' +
      '<path d="M288 126 q8 4 0 9" fill="none" stroke="#6d7578" stroke-width="3"/>' +
      /* кофемашина */
      '<rect x="296" y="112" width="26" height="28" rx="3" fill="#4a4f52"/>' +
      '<rect x="301" y="132" width="16" height="6" rx="2" fill="#9aa2a6"/>' +
      '</svg>',
    точки: [
      { de: 'die Dunstabzugshaube', x: 221, y: 40, r: 26 , ru: 'вытяжка' },
      { de: 'der Herd',             x: 229, y: 134, r: 18 , ru: 'плита' },
      { de: 'der Backofen',         x: 229, y: 180, r: 22 , ru: 'духовка' },
      { de: 'die Spüle',            x: 115, y: 136, r: 18 , ru: 'кухонная мойка' },
      { de: 'der Wasserhahn',       x: 121, y: 112, r: 12 , ru: 'кран' },
      { de: 'die Spülmaschine',     x: 49,  y: 180, r: 24 , ru: 'посудомоечная машина' },
      { de: 'die Schublade',        x: 173, y: 178, r: 20 , ru: 'выдвижной ящик' },
      { de: 'der Kühlschrank',      x: 355, y: 120, r: 30 , ru: 'холодильник' },
      { de: 'der Wasserkocher',     x: 278, y: 130, r: 13 , ru: 'электрочайник' },
      { de: 'die Kaffeemaschine',   x: 309, y: 125, r: 14 , ru: 'кофемашина' }
    ]
  },

  комната: {
    имя: 'Комната',
    рисунок:
      '<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Комната">' +
      '<rect width="400" height="260" fill="#f4f1ea"/>' +
      '<rect y="200" width="400" height="60" fill="#dfd3c3"/>' +
      /* шкаф */
      '<rect x="14" y="66" width="62" height="134" rx="4" fill="#c8b39a" stroke="#9c866c"/>' +
      '<line x1="45" y1="66" x2="45" y2="200" stroke="#9c866c"/>' +
      '<circle cx="40" cy="134" r="3" fill="#6f5c48"/><circle cx="50" cy="134" r="3" fill="#6f5c48"/>' +
      /* кровать */
      '<rect x="86" y="150" width="88" height="50" rx="5" fill="#b6c7d6" stroke="#8399ab"/>' +
      '<rect x="86" y="132" width="14" height="68" rx="4" fill="#9c866c"/>' +
      '<rect x="104" y="156" width="30" height="16" rx="5" fill="#fbfaf7" stroke="#8399ab"/>' +
      /* лампа */
      '<line x1="205" y1="0" x2="205" y2="26" stroke="#7a7268" stroke-width="3"/>' +
      '<path d="M185 54 l20-28 l20 28 z" fill="#e8c96a" stroke="#b79b3f"/>' +
      /* картина */
      '<rect x="238" y="52" width="48" height="36" rx="3" fill="#fbfaf7" stroke="#9c866c" stroke-width="3"/>' +
      '<path d="M244 82 l12-14 l9 10 l7-8 l10 12 z" fill="#8fae86"/>' +
      /* часы */
      '<circle cx="322" cy="62" r="19" fill="#fbfaf7" stroke="#6f5c48" stroke-width="3"/>' +
      '<line x1="322" y1="62" x2="322" y2="50" stroke="#6f5c48" stroke-width="2.5"/>' +
      '<line x1="322" y1="62" x2="331" y2="66" stroke="#6f5c48" stroke-width="2.5"/>' +
      /* диван */
      '<rect x="196" y="150" width="92" height="42" rx="7" fill="#cf9f8a" stroke="#a87763"/>' +
      '<rect x="196" y="138" width="92" height="18" rx="7" fill="#dcb19c" stroke="#a87763"/>' +
      '<rect x="196" y="150" width="12" height="42" rx="6" fill="#c08f79"/>' +
      '<rect x="276" y="150" width="12" height="42" rx="6" fill="#c08f79"/>' +
      /* стол */
      '<rect x="312" y="150" width="74" height="8" rx="3" fill="#9c866c"/>' +
      '<rect x="318" y="158" width="6" height="42" fill="#9c866c"/>' +
      '<rect x="374" y="158" width="6" height="42" fill="#9c866c"/>' +
      /* стул */
      '<rect x="300" y="168" width="26" height="6" rx="2" fill="#7d6a55"/>' +
      '<rect x="300" y="140" width="6" height="30" rx="2" fill="#7d6a55"/>' +
      '<rect x="302" y="174" width="5" height="26" fill="#7d6a55"/>' +
      '<rect x="320" y="174" width="5" height="26" fill="#7d6a55"/>' +
      /* ковёр */
      '<ellipse cx="196" cy="228" rx="86" ry="22" fill="#c3b4d4" stroke="#a091b8"/>' +
      '</svg>',
    точки: [
      { de: 'der Schrank',  x: 45,  y: 130, r: 28 , ru: 'шкаф' },
      { de: 'das Bett',     x: 132, y: 172, r: 26 , ru: 'кровать' },
      { de: 'die Lampe',    x: 205, y: 40,  r: 20 , ru: 'лампа' },
      { de: 'das Bild',     x: 262, y: 70,  r: 20 , ru: 'картина' },
      { de: 'die Uhr',      x: 322, y: 62,  r: 19 , ru: 'часы' },
      { de: 'das Sofa',     x: 242, y: 166, r: 26 , ru: 'диван' },
      { de: 'der Tisch',    x: 349, y: 154, r: 20 , ru: 'стол' },
      { de: 'der Stuhl',    x: 312, y: 158, r: 14 , ru: 'стул' },
      { de: 'der Teppich',  x: 180, y: 232, r: 30 , ru: 'ковёр' }
    ]
  }
};

/* ───────────────────────── разбор словаря ───────────────────────── */

function разобрать(сырое) {
  var карточки = [];
  for (var i = 0; i < сырое.length; i++) {
    var c = сырое[i];
    if (!c || !c[1]) continue;
    var de = чисто(c[1]);
    if (!de || de.indexOf('/') >= 0) continue;          // «der Verkäufer / die Verkäuferin»
    карточки.push({
      ид: c[0], de: de, тр: c[2] || '',
      ru: чисто(String(c[3] || '').split(/\s+→\s+/)[0]),
      н: слова_(de).length
    });
  }
  var существительные = [], фразы = [];
  var видели = {};
  for (var j = 0; j < карточки.length; j++) {
    var к = карточки[j], ч = слова_(к.de);
    var род = ч[0] ? ч[0].toLowerCase() : '';
    if (ч.length === 2 && (род === 'der' || род === 'die' || род === 'das')
        && /^[A-ZÄÖÜ]/.test(ч[1]) && !видели[ч[1]]) {
      видели[ч[1]] = 1;
      существительные.push({ ид: к.ид, род: род, слово: ч[1], ru: к.ru, тр: к.тр, de: к.de });
    }
    if (к.н >= 3 && к.н <= 9 && к.ru) фразы.push(к);
  }
  return { все: карточки, существительные: существительные, фразы: фразы };
}

/* ───────────────────────── само ядро ───────────────────────── */

var ИГРЫ = {
  база: '',
  СЦЕНЫ: СЦЕНЫ,

  старт: function (наст) {
    стиль();
    ИГРЫ.база = наст.база == null ? '' : наст.база;

    var корень = наст.корень;
    var урок = наст.урок || '';
    var д = разобрать(наст.слова || []);
    var сцены, список;
    if (наст.сцена && СЦЕНЫ[наст.сцена]) {
      var есть = {};
      д.все.forEach(function (к) { есть[норм(к.de)] = к; });
      сцены = [{ код: наст.сцена, сцена: СЦЕНЫ[наст.сцена], есть: есть }];
      список = [КАРТИНКА];
    } else {
      сцены = подходящиеСцены(д);
      список = доступные(д, сцены);
    }

    if (!список.length) { корень.style.display = 'none'; return false; }

    корень.classList.add('игры');
    корень.innerHTML = '<div class="иг-карта" id="игКарта"></div>';
    var карта = корень.querySelector('#игКарта');

    /* ---------- общие кусочки ---------- */

    function рекордКлюч(код) { return 'nemeckiy_igra_' + профиль() + '_' + (урок || 'общий') + '_' + код; }
    function рекорд(код) {
      try { return JSON.parse(localStorage.getItem(рекордКлюч(код)) || 'null'); } catch (e) { return null; }
    }
    function записатьРекорд(код, процент, верных, всего) {
      var было = рекорд(код);
      if (было && было.процент >= процент) return;
      try {
        localStorage.setItem(рекордКлюч(код), JSON.stringify(
          { процент: процент, верных: верных, всего: всего, когда: Date.now() }));
      } catch (e) {}
    }

    // ЗУБР хранит клипы иначе, чем уроки, поэтому он передаёт свою
    // функцию наст.звук(ид) → путь к mp3. Где её нет — старое правило.
    var свойЗвук = typeof наст.звук === 'function' ? наст.звук : null;
    function голос(ид, de) {
      try {
        if (localStorage.getItem('nemeckiy_zvuk_выкл') === '1') return;
        var путь = свойЗвук ? свойЗвук(ид) : (ид && урок ? ИГРЫ.база + 'zvuk/' + урок + '/' + ид + '.mp3' : '');
        if (путь) new Audio(путь).play().catch(function () { системныйГолос(de); });
        else системныйГолос(de);
      } catch (e) {}
    }
    function системныйГолос(de) {
      try {
        if (!window.speechSynthesis || !de) return;
        var р = new SpeechSynthesisUtterance(de);
        р.lang = 'de-DE'; р.rate = .9;
        speechSynthesis.cancel(); speechSynthesis.speak(р);
      } catch (e) {}
    }

    function меню() {
      var кнопки = список.map(function (и) {
        var р = рекорд(и.код);
        return '<button class="иг-кн" data-код="' + и.код + '">' +
          '<i>' + и.значок + '</i>' +
          '<span>' + экр(и.имя) + '<small>' + экр(и.под) + '</small></span>' +
          (р ? '<b class="иг-рекорд">' + р.процент + '%</b>' : '') +
          '</button>';
      }).join('');
      карта.innerHTML =
        '<div class="иг-верх"><div class="иг-знак">🎮</div>' +
        '<div><h2>Поиграем</h2></div></div>' +
        '<p class="иг-под">Те же слова, что в уроке, — только их надо не читать, а собирать, ' +
        'раскладывать и находить. Быстрее запоминается.</p>' +
        '<div class="иг-меню">' + кнопки + '</div>';
      Array.prototype.forEach.call(карта.querySelectorAll('.иг-кн'), function (к) {
        к.onclick = function () {
          var код = к.getAttribute('data-код');
          for (var i = 0; i < список.length; i++) if (список[i].код === код) запустить(список[i]);
        };
      });
    }

    /* ---------- каркас раунда ---------- */

    function итогПростой(игра, процент, подпись) {
      записатьРекорд(игра.код, процент, 0, 0);
      карта.innerHTML =
        '<div class="иг-верх"><div class="иг-знак">' + игра.значок + '</div><div><h2>' + экр(игра.имя) + '</h2></div></div>' +
        '<div class="иг-итог"><div class="число">' + процент + '%</div>' +
        '<div class="строка">' + экр(подпись || '') + '</div></div>' +
        '<div class="иг-низ"><button class="иг-главная" id="игЕщё">Ещё раз</button>' +
        '<button class="иг-тихая" id="игДругая">Другая игра</button></div>';
      карта.querySelector('#игЕщё').onclick = function () { запустить(игра); };
      карта.querySelector('#игДругая').onclick = меню;
    }

    function запустить(игра) {
      // игры вроде «парочек» и «колеса» живут не раундами, а одним полем —
      // им ядро даёт холст и кнопку «назад», остальное они делают сами
      if (игра.сама) {
        return игра.экран({
          игра: игра, голос: голос, данные: д,
          рисовать: function (нутро) {
            карта.innerHTML =
              '<div class="иг-шапка"><button class="иг-назад" id="игНазад">‹ Игры</button>' +
              '<div class="иг-счёт">' + экр(игра.имя) + '</div></div>' + нутро;
            var н = карта.querySelector('#игНазад');
            if (н) н.onclick = меню;
          },
          звукОтвета: звук,
          рекорд: function (процент, верных, всего) { записатьРекорд(игра.код, процент, верных, всего); },
          меню: меню,
          конец: function (процент, подпись) { итогПростой(игра, процент, подпись); }
        });
      }
      var задания = игра.задания(д, сцены);
      if (!задания.length) { меню(); return; }
      var i = 0, верных = 0, ошибки = [];

      function шапка() {
        return '<div class="иг-шапка">' +
          '<button class="иг-назад" id="игНазад">‹ Игры</button>' +
          '<div class="иг-полоса"><i style="width:' + Math.round(i / задания.length * 100) + '%"></i></div>' +
          '<div class="иг-счёт">' + (i + 1) + ' / ' + задания.length + ' · ' + верных + ' ✓</div></div>';
      }

      var ход = {
        игра: игра, голос: голос,
        рисовать: function (нутро) {
          карта.innerHTML = шапка() + нутро;
          var н = карта.querySelector('#игНазад');
          if (н) н.onclick = меню;
        },
        задание: function () { return задания[i]; },
        ответ: function (верно, разбор) {
          if (верно) верных++; else if (разбор) ошибки.push(разбор);
          звук(верно);
          var с = карта.querySelector('.иг-счёт');
          if (с) с.textContent = (i + 1) + ' / ' + задания.length + ' · ' + верных + ' ✓';
        },
        дальше: function () {
          i++;
          if (i >= задания.length) итог(); else игра.раунд(ход);
        }
      };

      function итог() {
        var процент = Math.round(верных / задания.length * 100);
        записатьРекорд(игра.код, процент, верных, задания.length);
        var слово = процент === 100 ? 'Идеально!' :
                    процент >= 80 ? 'Хорошо.' :
                    процент >= 50 ? 'Половина есть — ещё разок.' : 'Пока тяжело. Вернись к словам урока.';
        var разбор = ошибки.length
          ? '<div class="иг-разбор"><h3>Над чем поработать:</h3>' + ошибки.map(function (о) {
              return '<div><span class="де">' + экр(о.de) + '</span> — ' + экр(о.ru) + '</div>';
            }).join('') + '</div>'
          : '';
        карта.innerHTML =
          '<div class="иг-верх"><div class="иг-знак">' + игра.значок + '</div><div><h2>' + экр(игра.имя) + '</h2></div></div>' +
          '<div class="иг-итог"><div class="число">' + процент + '%</div>' +
          '<div class="строка">' + верных + ' из ' + задания.length + ' · ' + слово + '</div></div>' +
          разбор +
          '<div class="иг-низ"><button class="иг-главная" id="игЕщё">Ещё раз</button>' +
          '<button class="иг-тихая" id="игДругая">Другая игра</button></div>';
        карта.querySelector('#игЕщё').onclick = function () { запустить(игра); };
        карта.querySelector('#игДругая').onclick = меню;
      }

      игра.раунд(ход);
    }

    // домашка и другие блоки страницы могут позвать игру напрямую:
    // ИГРЫ.запустить('анаграмма') — прокрутит сюда и сразу начнёт
    ИГРЫ.запустить = function (код) {
      for (var i = 0; i < список.length; i++) {
        if (список[i].код === код) {
          корень.scrollIntoView({ block: 'start' });
          запустить(список[i]);
          return true;
        }
      }
      корень.scrollIntoView({ block: 'start' });
      return false;
    };
    ИГРЫ.какиеЕсть = function () { return список.map(function (и) { return и.код; }); };

    меню();
    return true;
  }
};

/* ───────────────────────── сами игры ───────────────────────── */

function подходящиеСцены(д) {
  var есть = {};
  д.все.forEach(function (к) { есть[норм(к.de)] = к; });
  var годные = [];
  for (var код in СЦЕНЫ) {
    var с = СЦЕНЫ[код], совпало = 0;
    с.точки.forEach(function (т) { if (есть[норм(т.de)]) совпало++; });
    if (совпало >= Math.max(4, Math.ceil(с.точки.length * 0.6))) {
      годные.push({ код: код, сцена: с, есть: есть });
    }
  }
  return годные;
}

/* 1. Собери фразу — порядок слов */
var ПОРЯДОК = {
  код: 'порядок', имя: 'Собери фразу', значок: '🧩',
  под: 'Слова рассыпались — поставь их в правильном порядке',
  хватает: function (д) { return д.фразы.length >= 4; },
  задания: function (д) { return перемешать(д.фразы).slice(0, 6); },
  раунд: function (ход) {
    var з = ход.задание();
    var части = слова_(з.de);
    ход.рисовать(
      '<p class="иг-ру">' + экр(з.ru) + '</p>' +
      '<p class="иг-подсказ">Нажимай слова по порядку. Нажми на слово в строке — вернётся назад.</p>' +
      '<div class="иг-строка" id="игСтрока"></div>' +
      '<div class="иг-плитки" id="игПлитки"></div>' +
      '<div class="иг-низ"><button class="иг-главная" id="игПроверить">Проверить</button>' +
      '<button class="иг-тихая" id="игСдаюсь">Не знаю</button></div>');

    var строка = document.getElementById('игСтрока');
    var поле = document.getElementById('игПлитки');
    var взятые = [];
    var плитки = перемешать(части.map(function (с, к) { return { с: с, к: к }; }));

    function рисоватьПлитки() {
      поле.innerHTML = плитки.map(function (п, i) {
        return '<button class="иг-плитка' + (взятые.indexOf(i) >= 0 ? ' взята' : '') +
               '" data-i="' + i + '">' + экр(п.с) + '</button>';
      }).join('');
      Array.prototype.forEach.call(поле.querySelectorAll('.иг-плитка'), function (к) {
        к.onclick = function () { взятые.push(+к.getAttribute('data-i')); рисовать(); };
      });
    }
    function рисоватьСтроку() {
      строка.innerHTML = взятые.map(function (i, поз) {
        return '<button class="иг-плитка" data-поз="' + поз + '">' + экр(плитки[i].с) + '</button>';
      }).join('');
      Array.prototype.forEach.call(строка.querySelectorAll('.иг-плитка'), function (к) {
        к.onclick = function () { взятые.splice(+к.getAttribute('data-поз'), 1); рисовать(); };
      });
    }
    function рисовать() { рисоватьПлитки(); рисоватьСтроку(); }
    рисовать();

    function показать(верно) {
      var ответ = взятые.map(function (i) { return плитки[i].с; }).join(' ');
      ход.ответ(верно, верно ? null : з);
      строка.innerHTML = '';
      поле.innerHTML = '';
      var шкала = document.createElement('div');
      шкала.className = 'иг-ответ ' + (верно ? 'верно' : 'мимо');
      шкала.innerHTML = верно
        ? '✓ <span class="де">' + экр(з.de) + '</span>'
        : 'Правильно так: <span class="де">' + экр(з.de) + '</span>' +
          (ответ ? '<br>Ты собрал: ' + экр(ответ) : '');
      строка.parentNode.insertBefore(шкала, строка);
      var низ = document.querySelector('.иг-низ');
      низ.innerHTML = '<button class="иг-главная" id="игДальше">Дальше</button>' +
        '<button class="иг-тихая" id="игЗвук">🔊 Послушать</button>';
      document.getElementById('игДальше').onclick = ход.дальше;
      document.getElementById('игЗвук').onclick = function () { ход.голос(з.ид, з.de); };
      ход.голос(з.ид, з.de);
    }

    document.getElementById('игПроверить').onclick = function () {
      if (взятые.length !== части.length) return;
      var ответ = взятые.map(function (i) { return плитки[i].с; }).join(' ');
      показать(норм(ответ) === норм(з.de));
    };
    document.getElementById('игСдаюсь').onclick = function () { показать(false); };
  }
};

/* 2. der, die, das — сортировка по родам */
var РОДЫ = {
  код: 'роды', имя: 'der, die, das', значок: '🗂',
  под: 'Разложи слова урока по родам — самая полезная привычка',
  хватает: function (д) {
    var р = {};
    д.существительные.forEach(function (с) { р[с.род] = 1; });
    return д.существительные.length >= 6 && Object.keys(р).length >= 2;
  },
  задания: function (д) { return перемешать(д.существительные).slice(0, 12); },
  раунд: function (ход) {
    var з = ход.задание();
    ход.рисовать(
      '<p class="иг-де">' + экр(з.слово) + '</p>' +
      '<p class="иг-ру" style="font-size:15px;font-weight:600">' + экр(з.ru) + '</p>' +
      (з.тр ? '<p class="иг-тр">' + экр(з.тр) + '</p>' : '') +
      '<div class="иг-роды">' +
      ['der', 'die', 'das'].map(function (р) {
        return '<button class="иг-род" data-род="' + р + '">' + р + '</button>';
      }).join('') + '</div>' +
      '<div id="игОтвет"></div>');

    var кнопки = карта_кнопки('.иг-род');
    кнопки.forEach(function (к) {
      к.onclick = function () {
        var выбор = к.getAttribute('data-род'), верно = выбор === з.род;
        кнопки.forEach(function (д) {
          д.onclick = null;
          if (д.getAttribute('data-род') === з.род) д.classList.add('иг-верно');
          else if (д === к) д.classList.add('иг-мимо');
        });
        ход.ответ(верно, верно ? null : { de: з.de, ru: з.ru });
        var о = document.getElementById('игОтвет');
        о.innerHTML = '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
          (верно ? '✓ ' : '✗ Правильно: ') + '<span class="де">' + экр(з.род + ' ' + з.слово) + '</span></div>' +
          '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше</button></div>';
        document.getElementById('игДальше').onclick = ход.дальше;
        ход.голос(з.ид, з.de);
      };
    });
  }
};

/* 3. Вставь слово — пропуск во фразе */
var ПРОПУСК = {
  код: 'пропуск', имя: 'Вставь слово', значок: '✏️',
  под: 'Во фразе пропало слово — выбери, какое там стояло',
  хватает: function (д) { return д.фразы.length >= 4; },
  задания: function (д) {
    /* Знаки препинания в вариантах выглядели мусором («dick,», «Besenreiser.»),
       поэтому варианты даём голыми словами, а знаки оставляем в самой строке. */
    var банк = {};
    д.фразы.forEach(function (ф) {
      слова_(ф.de).forEach(function (с) {
        var г = голое(с);
        if (г.length >= 3) банк[г] = 1;
      });
    });
    банк = Object.keys(банк);
    return перемешать(д.фразы).slice(0, 6).map(function (ф) {
      var части = слова_(ф.de);
      var годные = [];
      for (var i = 1; i < части.length; i++) if (голое(части[i]).length >= 3) годные.push(i);
      if (!годные.length) годные = [части.length - 1];
      var поз = годные[Math.floor(Math.random() * годные.length)];
      var целое = части[поз], верное = голое(целое);
      var слева = целое.slice(0, целое.indexOf(верное));
      var справа = целое.slice(целое.indexOf(верное) + верное.length);
      var чужие = перемешать(банк.filter(function (с) {
        return норм(с) !== норм(верное) && части.map(голое).indexOf(с) < 0;
      })).slice(0, 3);
      return {
        ф: ф, поз: поз, верное: верное,
        варианты: перемешать([верное].concat(чужие)),
        строка: части.map(function (с, i) {
          return i === поз ? слева + '_____' + справа : с;
        }).join(' ')
      };
    });
  },
  раунд: function (ход) {
    var з = ход.задание();
    ход.рисовать(
      '<p class="иг-де">' + экр(з.строка) + '</p>' +
      '<p class="иг-ру" style="font-size:15px;font-weight:600">' + экр(з.ф.ru) + '</p>' +
      '<div class="иг-варианты">' + з.варианты.map(function (в) {
        return '<button class="иг-вариант" data-в="' + экр(в) + '">' + экр(в) + '</button>';
      }).join('') + '</div><div id="игОтвет"></div>');

    var кнопки = карта_кнопки('.иг-вариант');
    кнопки.forEach(function (к) {
      к.onclick = function () {
        var верно = норм(к.getAttribute('data-в')) === норм(з.верное);
        кнопки.forEach(function (д) {
          д.onclick = null;
          if (норм(д.getAttribute('data-в')) === норм(з.верное)) д.classList.add('иг-верно');
          else if (д === к) д.classList.add('иг-мимо');
        });
        ход.ответ(верно, верно ? null : { de: з.ф.de, ru: з.ф.ru });
        document.getElementById('игОтвет').innerHTML =
          '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
          '<span class="де">' + экр(з.ф.de) + '</span></div>' +
          '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше</button></div>';
        document.getElementById('игДальше').onclick = ход.дальше;
        ход.голос(з.ф.ид, з.ф.de);
      };
    });
  }
};

/* 4. Подпиши картинку */
var КАРТИНКА = {
  код: 'картинка', имя: 'Подпиши картинку', значок: '🖼',
  под: 'Показываю слово — ткни в него на картинке',
  хватает: function (д, сцены) { return сцены.length > 0; },
  задания: function (д, сцены) {
    var с = сцены[0];
    var точки = с.сцена.точки.map(function (т, i) {
      var к = с.есть[норм(т.de)];
      return { i: i, de: т.de, ru: (к && к.ru) || т.ru || '', ид: к ? к.ид : '', тр: к ? к.тр : '' };
    });
    return перемешать(точки).map(function (т) { return { сцена: с.сцена, точка: т }; });
  },
  раунд: function (ход) {
    var з = ход.задание(), с = з.сцена;
    ход.рисовать(
      '<p class="иг-де">' + экр(з.точка.de) + '</p>' +
      '<p class="иг-ру" style="font-size:15px;font-weight:600">' + экр(з.точка.ru) + '</p>' +
      '<div class="иг-сцена" id="игСцена">' + с.рисунок + '</div>' +
      '<div id="игОтвет"></div>');

    var svg = document.querySelector('#игСцена svg');
    с.точки.forEach(function (т, i) {
      var круг = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      круг.setAttribute('cx', т.x); круг.setAttribute('cy', т.y); круг.setAttribute('r', т.r);
      круг.setAttribute('class', 'иг-точка'); круг.setAttribute('data-i', i);
      svg.appendChild(круг);
    });

    var круги = Array.prototype.slice.call(svg.querySelectorAll('.иг-точка'));
    круги.forEach(function (к) {
      к.addEventListener('click', function () {
        var верно = +к.getAttribute('data-i') === з.точка.i;
        круги.forEach(function (д) {
          д.style.pointerEvents = 'none';
          if (+д.getAttribute('data-i') === з.точка.i) д.setAttribute('class', 'иг-точка готова');
          else if (д === к) д.setAttribute('class', 'иг-точка ошиблись');
        });
        ход.ответ(верно, верно ? null : { de: з.точка.de, ru: з.точка.ru });
        document.getElementById('игОтвет').innerHTML =
          '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
          (верно ? '✓ Верно' : '✗ Вот где это') + ' — <span class="де">' + экр(з.точка.de) + '</span>' +
          (з.точка.тр ? ' · ' + экр(з.точка.тр) : '') + '</div>' +
          '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше</button></div>';
        document.getElementById('игДальше').onclick = ход.дальше;
        ход.голос(з.точка.ид, з.точка.de);
      });
    });
  }
};

/* 5. Анаграмма — собрать слово из букв */
var АНАГРАММА = {
  код: 'анаграмма', имя: 'Собери слово', значок: '🔤',
  под: 'Буквы перепутались — верни слово на место',
  слова: function (д) {
    return д.все.filter(function (к) {
      var г = к.de.replace(/^(der|die|das)\s+/i, '');
      return к.ru && /^[A-Za-zÄÖÜäöüß-]{4,12}$/.test(г);
    });
  },
  хватает: function (д) { return АНАГРАММА.слова(д).length >= 4; },
  задания: function (д) { return перемешать(АНАГРАММА.слова(д)).slice(0, 8); },
  раунд: function (ход) {
    var з = ход.задание();
    var слово = з.de.replace(/^(der|die|das)\s+/i, '');
    var артикль = (з.de.match(/^(der|die|das)\s+/i) || [''])[0].trim();
    var буквы = перемешать(слово.split(''));
    // если случайно вышло исходное слово — мешаем ещё раз
    if (буквы.join('') === слово) буквы = перемешать(буквы);
    var взятые = [];

    ход.рисовать(
      '<p class="иг-ру">' + экр(з.ru) + '</p>' +
      (артикль ? '<p class="иг-подсказ">артикль: <b>' + экр(артикль) + '</b> · букв: ' + слово.length + '</p>'
               : '<p class="иг-подсказ">букв: ' + слово.length + '</p>') +
      '<div class="иг-строка" id="игСлово"></div>' +
      '<div class="иг-плитки" id="игБуквы"></div>' +
      '<div class="иг-низ"><button class="иг-главная" id="игПроверить">Проверить</button>' +
      '<button class="иг-тихая" id="игСдаюсь">Не знаю</button></div>' +
      '<div id="игОтвет"></div>');

    var поле = document.getElementById('игБуквы'), строка = document.getElementById('игСлово');
    function рисовать() {
      поле.innerHTML = буквы.map(function (б, i) {
        return '<button class="иг-плитка' + (взятые.indexOf(i) >= 0 ? ' взята' : '') +
               '" data-i="' + i + '">' + экр(б) + '</button>';
      }).join('');
      Array.prototype.forEach.call(поле.querySelectorAll('.иг-плитка'), function (к) {
        к.onclick = function () { взятые.push(+к.getAttribute('data-i')); рисовать(); };
      });
      строка.innerHTML = взятые.map(function (i, поз) {
        return '<button class="иг-плитка" data-поз="' + поз + '">' + экр(буквы[i]) + '</button>';
      }).join('');
      Array.prototype.forEach.call(строка.querySelectorAll('.иг-плитка'), function (к) {
        к.onclick = function () { взятые.splice(+к.getAttribute('data-поз'), 1); рисовать(); };
      });
    }
    рисовать();

    function показать(верно) {
      ход.ответ(верно, верно ? null : з);
      document.getElementById('игОтвет').innerHTML =
        '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
        (верно ? '✓ ' : 'Правильно: ') + '<span class="де">' + экр(з.de) + '</span>' +
        (з.тр ? ' · ' + экр(з.тр) : '') + '</div>' +
        '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше</button></div>';
      document.getElementById('игДальше').onclick = ход.дальше;
      ход.голос(з.ид, з.de);
    }
    document.getElementById('игПроверить').onclick = function () {
      if (взятые.length !== слово.length) return;
      показать(взятые.map(function (i) { return буквы[i]; }).join('').toLowerCase() === слово.toLowerCase());
    };
    document.getElementById('игСдаюсь').onclick = function () { показать(false); };
  }
};

/* 6. Парочки — память: немецкое к русскому */
var ПАРОЧКИ = {
  код: 'парочки', имя: 'Парочки', значок: '🃏', сама: true,
  под: 'Открывай плитки парами: слово и перевод',
  слова: function (д) {
    return д.все.filter(function (к) { return к.ru && к.н <= 3 && к.de.length <= 24 && к.ru.length <= 28; });
  },
  хватает: function (д) { return ПАРОЧКИ.слова(д).length >= 6; },
  экран: function (х) {
    var пары = перемешать(ПАРОЧКИ.слова(х.данные)).slice(0, 6);
    var плитки = [];
    пары.forEach(function (к, i) {
      плитки.push({ пара: i, текст: к.de, сторона: 'de', к: к });
      плитки.push({ пара: i, текст: к.ru, сторона: 'ru', к: к });
    });
    плитки = перемешать(плитки);
    var открыто = [], найдено = 0, ошибок = 0, занято = false;

    function рисовать() {
      х.рисовать(
        '<p class="иг-подсказ">Найди пару: немецкое слово и его перевод. Пар: 6 · ошибок: ' + ошибок + '</p>' +
        '<div class="иг-пары" id="игПоле">' + плитки.map(function (п, i) {
          var видно = п.открыта || п.нашлась;
          return '<button class="иг-пара' + (п.нашлась ? ' нашлась' : видно ? ' открыта' : '') +
                 '" data-i="' + i + '">' + (видно ? экр(п.текст) : '?') + '</button>';
        }).join('') + '</div>');
      Array.prototype.forEach.call(document.querySelectorAll('#игПоле .иг-пара'), function (к) {
        к.onclick = function () { нажали(+к.getAttribute('data-i')); };
      });
    }

    function нажали(i) {
      var п = плитки[i];
      if (занято || п.нашлась || п.открыта) return;
      п.открыта = true;
      открыто.push(i);
      рисовать();
      if (открыто.length < 2) return;
      занято = true;
      var a = плитки[открыто[0]], b = плитки[открыто[1]];
      if (a.пара === b.пара && a.сторона !== b.сторона) {
        a.нашлась = b.нашлась = true;
        найдено++;
        х.звукОтвета(true);
        х.голос(a.к.ид, a.к.de);
        открыто = []; занято = false;
        рисовать();
        if (найдено === пары.length) {
          var процент = Math.max(0, Math.round(пары.length / (пары.length + ошибок) * 100));
          setTimeout(function () {
            х.конец(процент, 'Все пары найдены, ошибок: ' + ошибок);
          }, 500);
        }
      } else {
        ошибок++;
        х.звукОтвета(false);
        setTimeout(function () {
          a.открыта = b.открыта = false;
          открыто = []; занято = false;
          рисовать();
        }, 800);
      }
    }
    рисовать();
  }
};

/* 7. Колесо — устная практика: крутанул и назвал */
var КОЛЕСО = {
  код: 'колесо', имя: 'Колесо слов', значок: '🎡', сама: true,
  под: 'Крутишь — называешь вслух, потом проверяешь себя',
  хватает: function (д) { return д.все.filter(function (к) { return к.ru; }).length >= 8; },
  экран: function (х) {
    var слова = перемешать(х.данные.все.filter(function (к) { return к.ru; }));
    var i = -1, знал = 0, всего = 0, сНемецкого = true;

    function рисовать(состояние) {
      var к = слова[i] || null;
      var лицо = !к ? '' : (сНемецкого ? к.de : к.ru);
      var изнанка = !к ? '' : (сНемецкого ? к.ru : к.de);
      х.рисовать(
        '<div class="иг-вкладки"><button class="иг-мини' + (сНемецкого ? ' вкл' : '') + '" id="игСторонаDe">с немецкого</button>' +
        '<button class="иг-мини' + (сНемецкого ? '' : ' вкл') + '" id="игСторонаRu">с русского</button></div>' +
        '<p class="иг-подсказ">Слов пройдено: ' + всего + ' · знал: ' + знал + '</p>' +
        '<div class="иг-колесо' + (состояние === 'крутится' ? ' крутится' : '') + '" id="игКолесо">' +
        (к ? экр(лицо) : 'Крути!') + '</div>' +
        (состояние === 'ответ'
          ? '<div class="иг-ответ верно"><span class="де">' + экр(изнанка) + '</span>' +
            (к && к.тр && сНемецкого ? ' · ' + экр(к.тр) : '') + '</div>' +
            '<div class="иг-низ"><button class="иг-главная" id="игЗнал">Знал</button>' +
            '<button class="иг-тихая" id="игНеЗнал">Не знал</button></div>'
          : '<div class="иг-низ"><button class="иг-главная" id="игКрутить">' +
            (к ? 'Показать ответ' : 'Крутить') + '</button>' +
            (к ? '<button class="иг-тихая" id="игЗвук">🔊</button>' : '') +
            '<button class="иг-тихая" id="игХватит">Хватит</button></div>'));

      var dE = document.getElementById('игСторонаDe'), dR = document.getElementById('игСторонаRu');
      if (dE) dE.onclick = function () { сНемецкого = true; рисовать(состояние); };
      if (dR) dR.onclick = function () { сНемецкого = false; рисовать(состояние); };
      var кр = document.getElementById('игКрутить');
      if (кр) кр.onclick = function () {
        if (!к) { крутить(); } else { рисовать('ответ'); if (сНемецкого) х.голос(к.ид, к.de); }
      };
      var зв = document.getElementById('игЗвук');
      if (зв && к) зв.onclick = function () { х.голос(к.ид, к.de); };
      var хв = document.getElementById('игХватит');
      if (хв) хв.onclick = закончить;
      var зн = document.getElementById('игЗнал');
      if (зн) зн.onclick = function () { знал++; всего++; х.звукОтвета(true); крутить(); };
      var нз = document.getElementById('игНеЗнал');
      if (нз) нз.onclick = function () { всего++; х.звукОтвета(false); крутить(); };
    }

    function крутить() {
      if (i + 1 >= слова.length) { закончить(); return; }
      рисовать('крутится');
      setTimeout(function () { i++; рисовать(''); }, 420);
    }
    function закончить() {
      if (!всего) { х.конец(0, 'Ни одного слова не пройдено'); return; }
      х.конец(Math.round(знал / всего * 100), 'Знал ' + знал + ' из ' + всего);
    }
    рисовать('');
  }
};

/* 8. Расставь по порядку — готовые последовательности */
var СПИСКИ = [
  { имя: 'Дни недели', ряд: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] },
  { имя: 'Месяцы', ряд: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'] },
  { имя: 'Числа', ряд: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'] },
  { имя: 'Времена года', ряд: ['Frühling', 'Sommer', 'Herbst', 'Winter'] },
  { имя: 'Время суток', ряд: ['der Morgen', 'der Vormittag', 'der Mittag', 'der Nachmittag', 'der Abend', 'die Nacht'] }
];

function подходящиеСписки(д) {
  var есть = {};
  д.все.forEach(function (к) {
    есть[норм(к.de)] = к;
    есть[норм(к.de.replace(/^(der|die|das)\s+/i, ''))] = к;
  });
  return СПИСКИ.filter(function (с) {
    var совпало = 0;
    с.ряд.forEach(function (э) { if (есть[норм(э)]) совпало++; });
    return совпало >= Math.max(3, Math.ceil(с.ряд.length * 0.6));
  }).map(function (с) { return { с: с, есть: есть }; });
}

var ПОСЛЕДОВАТЕЛЬНОСТЬ = {
  код: 'порядоксписка', имя: 'Расставь по порядку', значок: '🔢',
  под: 'Дни, месяцы, числа — в правильном порядке',
  хватает: function (д) { return подходящиеСписки(д).length > 0; },
  задания: function (д) {
    return подходящиеСписки(д).map(function (п) {
      var ряд = п.с.ряд.slice();
      // длинные ряды режем на кусок из семи — иначе на телефоне не влезает
      if (ряд.length > 7) {
        var старт = Math.floor(Math.random() * (ряд.length - 7 + 1));
        ряд = ряд.slice(старт, старт + 7);
      }
      return { имя: п.с.имя, ряд: ряд, есть: п.есть };
    });
  },
  раунд: function (ход) {
    var з = ход.задание();
    var плитки = перемешать(з.ряд.map(function (э, к) { return { э: э, к: к }; }));
    var взятые = [];
    ход.рисовать(
      '<p class="иг-ру">' + экр(з.имя) + '</p>' +
      '<p class="иг-подсказ">Нажимай по порядку. Нажми в строке — вернётся назад.</p>' +
      '<div class="иг-строка" id="игСтрока"></div>' +
      '<div class="иг-плитки" id="игПлитки"></div>' +
      '<div class="иг-низ"><button class="иг-главная" id="игПроверить">Проверить</button>' +
      '<button class="иг-тихая" id="игСдаюсь">Не знаю</button></div>' +
      '<div id="игОтвет"></div>');
    var поле = document.getElementById('игПлитки'), строка = document.getElementById('игСтрока');
    function рисовать() {
      поле.innerHTML = плитки.map(function (п, i) {
        return '<button class="иг-плитка' + (взятые.indexOf(i) >= 0 ? ' взята' : '') +
               '" data-i="' + i + '">' + экр(п.э) + '</button>';
      }).join('');
      Array.prototype.forEach.call(поле.querySelectorAll('.иг-плитка'), function (к) {
        к.onclick = function () { взятые.push(+к.getAttribute('data-i')); рисовать(); };
      });
      строка.innerHTML = взятые.map(function (i, поз) {
        return '<button class="иг-плитка" data-поз="' + поз + '">' + экр(плитки[i].э) + '</button>';
      }).join('');
      Array.prototype.forEach.call(строка.querySelectorAll('.иг-плитка'), function (к) {
        к.onclick = function () { взятые.splice(+к.getAttribute('data-поз'), 1); рисовать(); };
      });
    }
    рисовать();
    function показать(верно) {
      ход.ответ(верно, верно ? null : { de: з.ряд.join(' · '), ru: з.имя });
      document.getElementById('игОтвет').innerHTML =
        '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
        (верно ? '✓ ' : 'Правильный порядок: ') + '<span class="де">' + экр(з.ряд.join(' · ')) + '</span></div>' +
        '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше</button></div>';
      document.getElementById('игДальше').onclick = ход.дальше;
      var первое = з.есть[норм(з.ряд[0])];
      if (первое) ход.голос(первое.ид, первое.de);
    }
    document.getElementById('игПроверить').onclick = function () {
      if (взятые.length !== з.ряд.length) return;
      var собрано = взятые.map(function (i) { return плитки[i].э; }).join('|');
      показать(собрано === з.ряд.join('|'));
    };
    document.getElementById('игСдаюсь').onclick = function () { показать(false); };
  }
};

/* 9. Плитки — как «Перевернуть плитки» на Wordwall (12.10.2026).
   Стена из плиток. Нажал — плитка увеличивается, её можно перевернуть
   (на обороте другая сторона и голос), листать соседние, убрать со стены
   выученную. «Случайная», «Перетасовать», «Вернуть убранные», таймер.
   Картинок чужих нет: на лице — перевод и значок профессии, если он есть. */
var ЗНАЧКИ = {
  arzt: '🩺', ärztin: '🩺', tierarzt: '🐾', tierärztin: '🐾', krankenschwester: '💉', krankenpfleger: '💉',
  pfleger: '💉', arzthelfer: '🩹', arzthelferin: '🩹', apotheker: '💊', apothekerin: '💊', psychiater: '🧠',
  masseur: '💆', lehrer: '👩‍🏫', lehrerin: '👩‍🏫', professor: '🎓', schüler: '🎒', schülerin: '🎒',
  erzieher: '🧸', erzieherin: '🧸', kindergärtner: '🧸', kindergärtnerin: '🧸', koch: '👨‍🍳', köchin: '👩‍🍳',
  kellner: '🍽', kellnerin: '🍽', bäcker: '🥐', bäckerin: '🥐', fleischer: '🥩', kassierer: '🛒',
  kassiererin: '🛒', verkäufer: '🏷', verkäuferin: '🏷', hausmann: '🏠', hausfrau: '🏠', putzhilfe: '🧹',
  hausmeister: '🔑', friseur: '💇', friseurin: '💇', frisör: '💇', optiker: '👓', optikerin: '👓',
  schneider: '🧵', schneiderin: '🧵', architekt: '📐', architektin: '📐', ingenieur: '⚙️', informatiker: '💻',
  informatikerin: '💻', programmierer: '💻', elektriker: '💡', mechaniker: '🔧', automechaniker: '🔧',
  'kfz-mechaniker': '🔧', mechatroniker: '🤖', handwerker: '🛠', bauarbeiter: '👷', tischler: '🪚',
  schreiner: '🪚', glaser: '🪟', maler: '🎨', malerin: '🎨', künstler: '🎨', musiker: '🎻', sänger: '🎤',
  sängerin: '🎤', schauspieler: '🎭', schauspielerin: '🎭', fotograf: '📷', kameramann: '🎥',
  journalist: '📰', reporter: '🎙', schriftsteller: '✍️', autor: '📚', autorin: '📚', historiker: '🏛',
  chemiker: '⚗️', sekretär: '📇', sekretärin: '📇', rezeptionist: '🛎', politiker: '🏛', richter: '⚖️',
  rechtsanwalt: '⚖️', polizist: '👮', detektiv: '🕵️', soldat: '🪖', soldatin: '🪖', feuerwehrmann: '🚒',
  feuerwehrfrau: '🚒', pilot: '✈️', flugbegleiter: '✈️', zugbegleiter: '🚆', taxifahrer: '🚕',
  busfahrer: '🚌', postbote: '✉️', briefträger: '✉️', bauer: '🚜', bäuerin: '🚜', landwirt: '🚜',
  gärtner: '🌷', gärtnerin: '🌷', trainer: '🏅', trainerin: '🏅', fahrlehrer: '🚗', detektivin: '🕵️'
};
function значок(de) {
  var слова = de.replace(/[,;(].*$/, '').trim().split(/\s+/);
  var слово = (слова.length > 1 && /^(der|die|das)$/i.test(слова[0]) ? слова[1] : слова[0] || '').toLowerCase();
  return ЗНАЧКИ[слово] || '';
}

var ПЛИТКИ = {
  код: 'плитки', имя: 'Плитки', значок: '🎴', сама: true,
  под: 'Стена плиток: открой, переверни, убери выученные',
  слова: function (д) {
    return д.все.filter(function (к) { return к.ru && к.de.length <= 60 && к.ru.length <= 60; });
  },
  хватает: function (д) { return ПЛИТКИ.слова(д).length >= 6; },
  экран: function (х) {
    var все = перемешать(ПЛИТКИ.слова(х.данные)).slice(0, 30);
    var плиты = все.map(function (к, i) { return { к: к, цвет: i % 6, убрана: false }; });
    var лицомRu = true, открыта = -1, перевёрнута = false;
    var начало = Date.now(), таймер = null;

    function время() {
      var с = Math.floor((Date.now() - начало) / 1000);
      return Math.floor(с / 60) + ':' + ('0' + (с % 60)).slice(-2);
    }
    function тик() { var э = document.getElementById('игВремя'); if (э) э.textContent = время(); else стоп(); }
    function стоп() { if (таймер) { clearInterval(таймер); таймер = null; } }
    function видимые() { var о = []; плиты.forEach(function (п, i) { if (!п.убрана) о.push(i); }); return о; }
    function убрано() { return плиты.filter(function (п) { return п.убрана; }).length; }
    function лицо(п) { return лицомRu ? п.к.ru : п.к.de; }
    function изнанка(п) { return лицомRu ? п.к.de : п.к.ru; }

    function стена() {
      открыта = -1;
      var остаток = видимые().length;
      х.рисовать(
        '<div class="иг-вкладки"><button class="иг-мини' + (лицомRu ? ' вкл' : '') + '" id="игЛицоRu">лицом по-русски</button>' +
        '<button class="иг-мини' + (лицомRu ? '' : ' вкл') + '" id="игЛицоDe">лицом по-немецки</button></div>' +
        '<p class="иг-подсказ"><span class="иг-время" id="игВремя">' + время() + '</span> · на стене ' + остаток +
        ' · убрано ' + убрано() + ' из ' + плиты.length + '. Нажми плитку — она откроется крупно.</p>' +
        '<div class="иг-стена" id="игСтена">' + плиты.map(function (п, i) {
          var з = значок(п.к.de);
          return '<button class="иг-плита ц' + п.цвет + (лицомRu ? '' : ' де') + (п.убрана ? ' убрана' : '') +
            '" data-i="' + i + '">' + (з ? '<i>' + з + '</i>' : '') + экр(лицо(п)) + '</button>';
        }).join('') + '</div>' +
        '<div class="иг-панель"><button class="иг-мини" id="игСлучайная">🎲 Случайная</button>' +
        '<button class="иг-мини" id="игТасовать">🔀 Перетасовать</button>' +
        '<button class="иг-мини" id="игВернуть"' + (убрано() ? '' : ' disabled') + '>↩ Вернуть убранные</button>' +
        '<button class="иг-мини" id="игГотово">✓ Закончить</button></div>');
      Array.prototype.forEach.call(document.querySelectorAll('#игСтена .иг-плита'), function (к) {
        к.onclick = function () { открыть(+к.getAttribute('data-i')); };
      });
      document.getElementById('игЛицоRu').onclick = function () { лицомRu = true; стена(); };
      document.getElementById('игЛицоDe').onclick = function () { лицомRu = false; стена(); };
      document.getElementById('игСлучайная').onclick = function () {
        var в = видимые(); if (в.length) открыть(в[Math.floor(Math.random() * в.length)]);
      };
      document.getElementById('игТасовать').onclick = function () { плиты = перемешать(плиты); стена(); };
      document.getElementById('игВернуть').onclick = function () { плиты.forEach(function (п) { п.убрана = false; }); стена(); };
      document.getElementById('игГотово').onclick = закончить;
      if (!остаток) закончить();
    }

    function открыть(i) {
      открыта = i; перевёрнута = false;
      зум();
    }

    function соседняя(шаг) {
      var в = видимые(), где = в.indexOf(открыта);
      if (где < 0) return -1;
      var н = где + шаг;
      return н >= 0 && н < в.length ? в[н] : -1;
    }

    function зум() {
      var п = плиты[открыта];
      if (!п) { стена(); return; }
      var з = значок(п.к.de);
      var текст = перевёрнута ? изнанка(п) : лицо(п);
      var немецкое = перевёрнута ? лицомRu : !лицомRu;
      х.рисовать(
        '<p class="иг-подсказ"><span class="иг-время" id="игВремя">' + время() + '</span> · ' +
        'нажми на плитку — перевернётся; стрелки или свайп — соседние</p>' +
        '<div class="иг-зум"><button class="иг-стрелка" id="игПред"' + (соседняя(-1) < 0 ? ' disabled' : '') + '>‹</button>' +
        '<div class="иг-большая' + (перевёрнута ? ' оборот' : '') + '" id="игБольшая">' +
        (з ? '<i>' + з + '</i>' : '') +
        '<b' + (немецкое ? ' class="де"' : '') + '>' + экр(текст) + '</b>' +
        (перевёрнута && немецкое && п.к.тр ? '<small>[' + экр(п.к.тр) + ']</small>' : '') +
        '<small>' + (перевёрнута ? 'оборот' : 'лицо') + '</small></div>' +
        '<button class="иг-стрелка" id="игСлед"' + (соседняя(1) < 0 ? ' disabled' : '') + '>›</button></div>' +
        '<div class="иг-низ"><button class="иг-главная" id="игПеревернуть">⟲ Перевернуть</button>' +
        '<button class="иг-тихая" id="игУбрать">✓ Убрать — знаю</button>' +
        '<button class="иг-тихая" id="игЗвук">🔊</button>' +
        '<button class="иг-тихая" id="игКСтене">К стене</button></div>');
      var б = document.getElementById('игБольшая');
      function перевернуть() {
        б.classList.add('вертится');
        setTimeout(function () {
          перевёрнута = !перевёрнута; зум();
          if (перевёрнута && лицомRu) х.голос(п.к.ид, п.к.de);
        }, 180);
      }
      б.onclick = перевернуть;
      document.getElementById('игПеревернуть').onclick = перевернуть;
      document.getElementById('игЗвук').onclick = function () { х.голос(п.к.ид, п.к.de); };
      document.getElementById('игКСтене').onclick = стена;
      document.getElementById('игПред').onclick = function () { var н = соседняя(-1); if (н >= 0) открыть(н); };
      document.getElementById('игСлед').onclick = function () { var н = соседняя(1); if (н >= 0) открыть(н); };
      document.getElementById('игУбрать').onclick = function () {
        var н = соседняя(1); if (н < 0) н = соседняя(-1);
        п.убрана = true; х.звукОтвета(true);
        if (н >= 0) открыть(н); else стена();
      };
      // свайп: влево — следующая, вправо — предыдущая (короткое касание — переворот)
      var x0 = null;
      б.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      б.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0; x0 = null;
        if (Math.abs(dx) < 40) return;
        e.preventDefault();
        var н = соседняя(dx < 0 ? 1 : -1); if (н >= 0) открыть(н);
      });
    }

    function закончить() {
      стоп();
      var всего = плиты.length, знал = убрано();
      х.конец(Math.round(знал / всего * 100), 'Убрано как выученные: ' + знал + ' из ' + всего + ' · время ' + время());
    }

    таймер = setInterval(тик, 1000);
    стена();
  }
};

/* 10. Книжки — «вставь в текст» (14.10.2026, копия Wordwall «Vervollständige den Satz»,
   игра Даши «Haben oder sein?»). Слева полка книжек-слов, в тексте пропуски.
   Книжку можно ПЕРЕТАЩИТЬ в пропуск или нажать книжку, потом пропуск (на телефоне
   перетаскивание бывает капризным — оба способа работают). «Проверить» — верные ✓,
   неверные перечёркнуты; табличка «счёт и время»; «Показать ответы», «Ещё раз».
   Материал: если страница задала window.ИГРЫ_ТЕКСТЫ — берём его (набор Даши
   и т. п.), иначе фразы урока: прячем второе слово (в немецком там стоит глагол). */
var КНИЖКИ = {
  код: 'книжки', имя: 'Вставь в текст', значок: '📚', сама: true,
  под: 'Перетащи книжки-слова в пропуски, потом «Проверить»',
  свои: function () {
    var н = window.ИГРЫ_ТЕКСТЫ;
    if (!н || !н.length) return [];
    var строки = [];
    н.forEach(function (набор) { (набор.строки || []).forEach(function (с) { if (с[0].indexOf('___') >= 0) строки.push(с); }); });
    return строки;
  },
  изФраз: function (д) {
    var итог = [];
    д.фразы.forEach(function (к) {
      var ч = к.de.split(/\s+/);
      if (ч.length < 3 || /\?$/.test(к.de)) return;
      var г = голое(ч[1]);
      if (!г || г.length < 2 || /^[A-ZÄÖÜ]/.test(г) || /\d/.test(г)) return;
      ч[1] = ч[1].replace(г, '___');
      итог.push([ч.join(' '), г, к.ru, к.ид]);
    });
    return итог;
  },
  хватает: function (д) { return КНИЖКИ.свои().length >= 4 || КНИЖКИ.изФраз(д).length >= 6; },
  экран: function (х) {
    var свои = КНИЖКИ.свои();
    var пул = свои.length >= 4 ? свои : КНИЖКИ.изФраз(х.данные);
    var строки = пул.length > 12 ? перемешать(пул).slice(0, 10) : (свои.length ? пул.slice() : перемешать(пул).slice(0, 10));
    var книги, места, начало, таймер, проверено, перевод = false, выбрана = -1;

    function заново() {
      книги = перемешать(строки.map(function (с, i) { return { т: String(с[1]).split('|')[0], цвет: i % 6 }; }));
      места = строки.map(function () { return -1; });
      начало = Date.now(); проверено = false; выбрана = -1;
      стоп(); таймер = setInterval(тик, 1000);
      рисовать();
    }
    function время() {
      var с = Math.floor((Date.now() - начало) / 1000);
      return Math.floor(с / 60) + ':' + ('0' + (с % 60)).slice(-2);
    }
    function тик() { var э = document.getElementById('игВремя'); if (э) э.textContent = время(); else стоп(); }
    function стоп() { if (таймер) { clearInterval(таймер); таймер = null; } }
    function гдеКнига(к) { return места.indexOf(к); }
    function книжка(к, доп) {
      return '<span class="иг-книга ц' + книги[к].цвет + (доп || '') + '" data-к="' + к + '">' + экр(книги[к].т) + '</span>';
    }
    function верноЛи(н) {
      var к = места[н];
      if (к < 0) return false;
      return String(строки[н][1]).split('|').some(function (в) { return норм(в) === норм(книги[к].т); });
    }

    function рисовать(показатьОтветы) {
      var наПолке = [];
      книги.forEach(function (_, к) { if (гдеКнига(к) < 0) наПолке.push(к); });
      var текст = строки.map(function (с, н) {
        var части = экр(с[0]).split('___');
        var к = места[н], класс = '', знак = '', верн = '';
        if (проверено) {
          var ок = верноЛи(н);
          класс = ок ? ' да' : ' нет';
          знак = '<span class="знак">' + (ок ? '✓' : '✗') + '</span>';
          if (!ок && показатьОтветы) верн = '<span class="верн">' + экр(String(с[1]).split('|')[0]) + '</span>';
        }
        var дырка = '<span class="иг-дырка' + класс + '" data-н="' + н + '">' + (к >= 0 ? книжка(к) : '') + знак + верн + '</span>';
        return '<div class="ряд">' + части[0] + дырка + (части[1] || '') +
          (перевод && с[2] ? '<small>' + экр(с[2]) + '</small>' : '') + '</div>';
      }).join('');
      х.рисовать(
        (проверено ? табличка() : '<p class="иг-подсказ"><span class="иг-время" id="игВремя">' + время() + '</span> · ' +
          'перетащи книжку в пропуск — или нажми книжку, потом пропуск. Нажми на поставленную — вернётся на полку.</p>') +
        (проверено ? '' : '<div class="иг-полка' + (наПолке.length ? '' : ' пусто') + '" id="игПолка">' +
          наПолке.map(function (к) { return книжка(к, к === выбрана ? ' выбрана' : ''); }).join('') + '</div>') +
        '<div class="иг-текст" id="игТекст">' + текст + '</div>' +
        '<div class="иг-низ">' +
        (проверено
          ? '<button class="иг-главная" id="игЕщё">↻ Ещё раз</button>' +
            '<button class="иг-тихая" id="игОтветы">' + (показатьОтветы ? 'Ответы показаны' : '👁 Показать ответы') + '</button>'
          : '<button class="иг-главная" id="игПроверить">✓ Проверить</button>') +
        '<button class="иг-тихая" id="игПеревод">' + (перевод ? 'Без перевода' : 'Перевод') + '</button></div>');
      var пр = document.getElementById('игПроверить'); if (пр) пр.onclick = проверить;
      var ещё = document.getElementById('игЕщё'); if (ещё) ещё.onclick = заново;
      var отв = document.getElementById('игОтветы'); if (отв) отв.onclick = function () { рисовать(true); };
      document.getElementById('игПеревод').onclick = function () { перевод = !перевод; рисовать(показатьОтветы); };
      if (!проверено) оживить();
    }

    function табличка() {
      var верных = строки.filter(function (_, н) { return верноЛи(н); }).length;
      return '<div class="иг-табличка"><b>' + (верных === строки.length ? 'Идеально!' : 'Готово') + '</b>' +
        '<div class="два"><div>' + верных + '<small>из ' + строки.length + ' верно</small></div>' +
        '<div>' + время() + '<small>время</small></div></div></div>';
    }

    function поставить(к, н) {
      var было = места[н];
      var откуда = гдеКнига(к);
      if (откуда >= 0) места[откуда] = было >= 0 && откуда !== н ? было : -1;  // меняем местами
      места[н] = к;
      выбрана = -1;
      рисовать();
    }
    function наПолку(к) { var г = гдеКнига(к); if (г >= 0) места[г] = -1; выбрана = -1; рисовать(); }

    function оживить() {
      Array.prototype.forEach.call(document.querySelectorAll('#игКарта .иг-книга'), function (э) {
        э.addEventListener('pointerdown', function (e) { тащить(e, э); });
      });
      Array.prototype.forEach.call(document.querySelectorAll('#игТекст .иг-дырка'), function (д) {
        д.addEventListener('click', function (e) {
          if (e.target.closest('.иг-книга')) return;      // по книжке — своя обработка
          var н = +д.getAttribute('data-н');
          if (выбрана >= 0) поставить(выбрана, н);
        });
      });
    }

    function тащить(e, э) {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      var к = +э.getAttribute('data-к');
      var x0 = e.clientX, y0 = e.clientY, призрак = null, цель = null, id = e.pointerId;
      function под(x, y) {
        var эл = document.elementFromPoint(x, y);
        return эл && эл.closest ? (эл.closest('#игТекст .иг-дырка') || эл.closest('#игПолка')) : null;
      }
      function ход(ev) {
        if (ev.pointerId !== id) return;
        if (!призрак && Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 7) return;
        if (!призрак) {
          призрак = э.cloneNode(true); призрак.classList.add('летит'); призрак.classList.remove('выбрана');
          document.body.appendChild(призрак); э.classList.add('тень');
        }
        призрак.style.left = (ev.clientX - призрак.offsetWidth / 2) + 'px';
        призрак.style.top = (ev.clientY - призрак.offsetHeight / 2) + 'px';
        var н = под(ev.clientX, ev.clientY);
        if (цель && цель !== н) цель.classList.remove('цель');
        цель = н; if (цель && цель.classList.contains('иг-дырка')) цель.classList.add('цель');
      }
      function конец(ev) {
        if (ev.pointerId !== id) return;
        document.removeEventListener('pointermove', ход);
        document.removeEventListener('pointerup', конец);
        document.removeEventListener('pointercancel', конец);
        if (призрак) {
          призрак.remove();
          var н = под(ev.clientX, ev.clientY);
          if (н && н.classList.contains('иг-дырка')) поставить(к, +н.getAttribute('data-н'));
          else if (н && н.id === 'игПолка') наПолку(к);
          else рисовать();
          return;
        }
        // просто нажатие
        if (гдеКнига(к) >= 0) {
          if (выбрана >= 0 && выбрана !== к) поставить(выбрана, гдеКнига(к)); else наПолку(к);
        } else {
          выбрана = выбрана === к ? -1 : к; рисовать();
        }
      }
      document.addEventListener('pointermove', ход);
      document.addEventListener('pointerup', конец);
      document.addEventListener('pointercancel', конец);
    }

    function проверить() {
      стоп(); проверено = true;
      var верных = 0;
      строки.forEach(function (_, н) { if (верноЛи(н)) верных++; });
      var процент = Math.round(верных / строки.length * 100);
      х.рекорд(процент, верных, строки.length);
      рисовать();
      // «чинг-чинг»: по звуку на каждый пропуск по очереди
      строки.forEach(function (_, н) {
        setTimeout(function () { х.звукОтвета(верноЛи(н)); }, 260 * н);
      });
    }

    заново();
  }
};

/* ═════════ Пятая очередь (15.10.2026) — то, что увидели на ZUM Deutsch Lernen ═════════ */

/* 11. Говори вслух — микрофон, браузер распознаёт немецкую речь (бесплатно, без сервера) */
function сравнитьРечь(сказано, надо) {
  var н = слова_(надо).map(function (с) { return норм(голое(с)); }).filter(Boolean);
  var с = норм(сказано).split(' ').filter(Boolean);
  var пул = с.slice(), есть = н.map(function (сл) {
    var i = пул.indexOf(сл);
    if (i >= 0) { пул.splice(i, 1); return 'ок'; }
    for (var j = 0; j < пул.length; j++) if (опечатка(пул[j], сл)) { пул.splice(j, 1); return 'почти'; }
    return 'нет';
  });
  var балл = есть.reduce(function (a, x) { return a + (x === 'ок' ? 1 : x === 'почти' ? .7 : 0); }, 0) / Math.max(н.length, 1);
  return { балл: балл, есть: есть };
}
var СКАЖИ = {
  код: 'скажи', имя: 'Говори вслух', значок: '🎤',
  под: 'Скажи фразу по-немецки в микрофон — сайт поймёт и проверит',
  хватает: function (д) { return !!распознавание() && д.фразы.length >= 4; },
  задания: function (д) {
    return перемешать(предложения(д)).slice(0, 6);
  },
  раунд: function (ход) {
    var з = ход.задание(), Р = распознавание(), слушаем = null, попыток = 0, видноDe = false;
    function экран(итог) {
      ход.рисовать(
        '<p class="иг-ру">' + экр(з.ru) + '</p>' +
        '<p class="иг-подсказ">Скажи это по-немецки. Не знаешь — открой подсказку, прочитай и скажи.</p>' +
        (видноDe ? '<p class="иг-де">' + экр(з.de) + '</p>' + (з.тр ? '<p class="иг-тр">[' + экр(з.тр) + ']</p>' : '') : '') +
        '<div style="text-align:center;margin:10px 0 14px"><button class="иг-мик" id="игМик">🎤 Говорить</button></div>' +
        '<div id="игИтог">' + (итог || '') + '</div>' +
        '<div class="иг-низ"><button class="иг-тихая" id="игПодсказка">' + (видноDe ? 'Скрыть' : '👁 Подсказка') + '</button>' +
        '<button class="иг-тихая" id="игЗвук">🔊 Как звучит</button>' +
        '<button class="иг-тихая" id="игПропуск">Дальше</button></div>');
      document.getElementById('игПодсказка').onclick = function () { видноDe = !видноDe; экран(итог); };
      document.getElementById('игЗвук').onclick = function () { ход.голос(з.ид, з.de); };
      document.getElementById('игПропуск').onclick = function () {
        if (слушаем) try { слушаем.abort(); } catch (e) {}
        if (!итог) ход.ответ(false, { de: з.de, ru: з.ru });
        ход.дальше();
      };
      document.getElementById('игМик').onclick = слушать;
    }
    function слушать() {
      var мик = document.getElementById('игМик');
      try {
        слушаем = new Р(); слушаем.lang = 'de-DE'; слушаем.interimResults = false; слушаем.maxAlternatives = 3;
      } catch (e) { document.getElementById('игИтог').innerHTML = '<div class="иг-ответ мимо">Микрофон в этом браузере не работает — открой в Chrome или Safari.</div>'; return; }
      мик.classList.add('слушает'); мик.textContent = '● Слушаю…';
      слушаем.onresult = function (e) {
        var лучшее = null;
        for (var i = 0; i < e.results[0].length; i++) {
          var т = e.results[0][i].transcript, с = сравнитьРечь(т, з.de);
          if (!лучшее || с.балл > лучшее.с.балл) лучшее = { т: т, с: с };
        }
        попыток++;
        var верно = лучшее.с.балл >= .85;
        var ч = слова_(з.de);
        var разбор = '<div class="иг-слова">' + ч.map(function (сл, i) {
          return '<span class="' + лучшее.с.есть[i] + '">' + экр(сл) + '</span>';
        }).join(' ') + '</div>';
        var итог = '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
          (верно ? '✓ Понятно! ' : 'Сайт услышал: ') + '«' + экр(лучшее.т) + '»' +
          (верно ? '' : '<br>Зелёное — сказал верно, оранжевое — почти, красное — не услышал. Попробуй ещё раз.') + '</div>' + разбор;
        if (верно || попыток >= 3) {
          ход.ответ(верно, верно ? null : { de: з.de, ru: з.ru });
          ход.рисовать('<p class="иг-ру">' + экр(з.ru) + '</p>' + итог +
            '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше</button>' +
            '<button class="иг-тихая" id="игЗвук">🔊 Как звучит</button></div>');
          document.getElementById('игДальше').onclick = ход.дальше;
          document.getElementById('игЗвук').onclick = function () { ход.голос(з.ид, з.de); };
          if (!верно) ход.голос(з.ид, з.de);
        } else экран(итог);
      };
      слушаем.onerror = function (e) {
        var почему = e.error === 'not-allowed' ? 'Нужно разрешить микрофон для этого сайта (значок в адресной строке).'
                   : e.error === 'no-speech' ? 'Ничего не услышал — говори громче и ближе к телефону.'
                   : 'Не получилось распознать (' + e.error + '). Попробуй ещё раз.';
        экран('<div class="иг-ответ мимо">' + почему + '</div>');
      };
      слушаем.onend = function () { var м = document.getElementById('игМик'); if (м) { м.classList.remove('слушает'); м.textContent = '🎤 Говорить'; } };
      try { слушаем.start(); } catch (e) {}
    }
    экран('');
  }
};

/* 12. Диктант — слушаешь фразу урока, пишешь; разбор по словам, опечатки отдельно */
var ДИКТАНТ = {
  код: 'диктант', имя: 'Диктант', значок: '✍️',
  под: 'Послушай фразу и напиши её — проверка по словам',
  хватает: function (д) { return д.фразы.length >= 4; },
  задания: function (д) {
    return перемешать(предложения(д)).slice(0, 5);
  },
  раунд: function (ход) {
    var з = ход.задание();
    ход.рисовать(
      '<p class="иг-подсказ">Нажми «Слушать», напиши, что услышал. Заглавные буквы важны: существительные пишутся с большой.</p>' +
      '<div class="иг-низ" style="margin-bottom:10px"><button class="иг-главная" id="игСлушать">🔊 Слушать</button>' +
      '<button class="иг-тихая" id="игМедленно">🐢 Медленно</button>' +
      '<button class="иг-тихая" id="игПеревод">Перевод</button></div>' +
      '<p class="иг-ру" id="игРу" style="display:none">' + экр(з.ru) + '</p>' +
      '<textarea class="иг-поле" id="игВвод" rows="2" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="пиши здесь…"></textarea>' +
      '<div id="игОтвет"></div>' +
      '<div class="иг-низ" id="игНиз"><button class="иг-главная" id="игПроверить">Проверить</button></div>');
    function медленно() {
      try { var р = new SpeechSynthesisUtterance(з.de); р.lang = 'de-DE'; р.rate = .65; speechSynthesis.cancel(); speechSynthesis.speak(р); } catch (e) {}
    }
    document.getElementById('игСлушать').onclick = function () { ход.голос(з.ид, з.de); };
    document.getElementById('игМедленно').onclick = медленно;
    document.getElementById('игПеревод').onclick = function () { var э = document.getElementById('игРу'); э.style.display = э.style.display ? '' : 'none'; };
    ход.голос(з.ид, з.de);
    document.getElementById('игПроверить').onclick = function () {
      var ввод = document.getElementById('игВвод').value;
      var надо = слова_(з.de), есть = ввод.trim().split(/\s+/).filter(Boolean);
      var ошибок = 0, опечаток = 0;
      var разбор = надо.map(function (сл, i) {
        var г = голое(сл), т = голое(есть[i] || '');
        if (т === г) return '<span class="ок">' + экр(сл) + '</span>';
        if (т && т.toLowerCase() === г.toLowerCase()) { опечаток++; return '<span class="почти" title="заглавная буква">' + экр(сл) + '</span>'; }
        if (опечатка(т, г)) { опечаток++; return '<span class="почти" title="у тебя: ' + экр(т) + '">' + экр(сл) + '</span>'; }
        ошибок++; return '<span class="нет">' + экр(сл) + '</span>';
      }).join(' ');
      if (есть.length > надо.length) ошибок++;
      var верно = !ошибок && !опечаток;
      ход.ответ(верно, верно ? null : { de: з.de, ru: з.ru });
      document.getElementById('игОтвет').innerHTML =
        '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
        (верно ? '✓ Без ошибок!' : ошибок ? 'Ошибок: ' + ошибок + (опечаток ? ', опечаток/заглавных: ' + опечаток : '') :
          'Почти! Проверь написание — оранжевое: опечатка или маленькая буква вместо заглавной.') + '</div>' +
        '<div class="иг-слова">' + разбор + '</div>';
      document.getElementById('игНиз').innerHTML = '<button class="иг-главная" id="игДальше">Дальше</button>';
      document.getElementById('игДальше').onclick = ход.дальше;
    };
  }
};

/* 13. Отметь слова — нажми все существительные (у немцев они с большой буквы — тренирует глаз и артикли) */
var МЕСТОИМЕНИЯ_SIE = { 'Sie': 1, 'Ihr': 1, 'Ihre': 1, 'Ihnen': 1, 'Ihren': 1, 'Ihrem': 1, 'Ihrer': 1, 'Ihres': 1 };
var ОТМЕТЬ = {
  код: 'отметь', имя: 'Отметь слова', значок: '🖍',
  под: 'Нажми в предложении все существительные',
  разметка: function (ф, сущ) {
    return слова_(ф.de).map(function (сл, i) {
      var г = голое(сл), заглавная = /^[A-ZÄÖÜ]/.test(г);
      var цель = заглавная && !МЕСТОИМЕНИЯ_SIE[г] && (i > 0 || сущ[г]);
      var нейтр = заглавная && i === 0 && !цель;     // первое слово с большой — может быть чем угодно
      return { сл: сл, цель: !!цель, нейтр: нейтр };
    });
  },
  хватает: function (д) { return ОТМЕТЬ.задания(д).length >= 4; },
  задания: function (д) {
    var сущ = {};
    д.существительные.forEach(function (с) { сущ[с.слово] = 1; });
    return перемешать(д.фразы.filter(function (ф) { return ф.н >= 4 && ф.н <= 14; })).map(function (ф) {
      return { ф: ф, т: ОТМЕТЬ.разметка(ф, сущ) };
    }).filter(function (з) { return з.т.some(function (x) { return x.цель; }); }).slice(0, 6);
  },
  раунд: function (ход) {
    var з = ход.задание(), выбор = {};
    ход.рисовать(
      '<p class="иг-подсказ">Нажми <b>все существительные</b> (предметы, люди, места, имена). Пунктир — первое слово, его не трогаем.</p>' +
      '<div class="иг-метки" id="игМетки">' + з.т.map(function (x, i) {
        return '<button class="иг-метка' + (x.нейтр ? ' нейтр' : '') + '" data-i="' + i + '">' + экр(x.сл) + '</button>';
      }).join('') + '</div>' +
      '<p class="иг-ру" style="font-size:14px;font-weight:500">' + экр(з.ф.ru) + '</p>' +
      '<div id="игОтвет"></div><div class="иг-низ" id="игНиз"><button class="иг-главная" id="игПроверить">Проверить</button></div>');
    карта_кнопки('.иг-метка').forEach(function (к) {
      var i = +к.getAttribute('data-i');
      if (з.т[i].нейтр) return;
      к.onclick = function () { выбор[i] = !выбор[i]; к.classList.toggle('выбрана', !!выбор[i]); };
    });
    document.getElementById('игПроверить').onclick = function () {
      var промах = 0, пропуск = 0;
      карта_кнопки('.иг-метка').forEach(function (к) {
        var i = +к.getAttribute('data-i'), x = з.т[i];
        к.onclick = null;
        if (x.цель && выбор[i]) к.classList.add('иг-верно');
        else if (!x.цель && выбор[i]) { к.classList.add('иг-мимо'); промах++; }
        else if (x.цель) { к.classList.add('пропущена'); пропуск++; }
      });
      var верно = !промах && !пропуск;
      ход.ответ(верно, верно ? null : { de: з.ф.de, ru: з.ф.ru });
      document.getElementById('игОтвет').innerHTML = '<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' +
        (верно ? '✓ Все существительные найдены!' : (пропуск ? 'Пропущено: ' + пропуск + ' (оранжевая рамка). ' : '') +
          (промах ? 'Лишних: ' + промах + ' (красные).' : '')) + '</div>';
      document.getElementById('игНиз').innerHTML = '<button class="иг-главная" id="игДальше">Дальше</button>';
      document.getElementById('игДальше').onclick = ход.дальше;
      ход.голос(з.ф.ид, з.ф.de);
    };
  }
};

/* 14. Расставь текст по порядку — строки рассказа или диалога урока перемешаны */
/* слова, которые цепляют строку за предыдущую: местоимение-отсылка или «потом/но/поэтому» */
var СВЯЗКИ = /^(er|sie|es|dann|danach|aber|deshalb|deswegen|zuerst|jetzt|später|dort|außerdem|trotzdem|also|doch|ja|nein)$/i;
var ТЕКСТ = {
  код: 'текст', имя: 'Текст по порядку', значок: '📜',
  под: 'Строки рассказа или диалога перемешались — расставь их',
  /* Порядок должен что-то значить: берём только
     • рассказ — больше половины строк (кроме первой) цепляются за предыдущую (er/sie/dann/aber…);
     • диалог — на вопросы отвечают (ответ перекликается словом или Ja/Nein/Doch), вопросов подряд не больше двух.
     Списки вопросов к анамнезу и разрозненные примеры с листа сюда не попадают. */
  куски: function (д) {
    var если = window.ИГРЫ_ТЕКСТЫ_ПОРЯДОК;          // страница может дать свои тексты
    if (если && если.length) return если;
    return группы(д).filter(function (г) {
      if (г.length < 4) return false;
      var хвост = г.slice(1);
      var цепь = хвост.filter(function (ф) { return СВЯЗКИ.test(голое(слова_(ф.de)[0] || '')); }).length;
      if (цепь / хвост.length > .5) return true;
      var ответов = 0, подряд = 0, макс = 0;
      for (var i = 0; i < г.length; i++) {
        var вопрос = /\?\s*$/.test(г[i].de);
        подряд = вопрос ? подряд + 1 : 0; макс = Math.max(макс, подряд);
        if (вопрос && г[i + 1] && !/\?\s*$/.test(г[i + 1].de) && ДИАЛОГ.связаны(г[i].de, г[i + 1].de)) ответов++;
      }
      return ответов >= 2 && макс <= 2;
    });
  },
  хватает: function (д) { return ТЕКСТ.куски(д).length >= 1; },
  задания: function (д) {
    return перемешать(ТЕКСТ.куски(д)).slice(0, 3).map(function (г) {
      var размер = Math.min(г.length, 6), начало = Math.floor(Math.random() * (г.length - размер + 1));
      return г.slice(начало, начало + размер);
    });
  },
  раунд: function (ход) {
    var строки = ход.задание(), порядок = [], тасовка = перемешать(строки.map(function (_, i) { return i; }));
    function рисовать(итог) {
      ход.рисовать(
        '<p class="иг-подсказ">Нажимай строки в том порядке, как они шли в уроке. Нажми на поставленную — вернётся.</p>' +
        '<div class="иг-строки" id="игГотово">' + порядок.map(function (i, п) {
          return '<button class="иг-строчка" data-п="' + п + '"><span class="ном">' + (п + 1) + '.</span><b>' + экр(строки[i].de) + '</b></button>';
        }).join('') + '</div>' +
        '<div class="иг-строки" id="игОсталось">' + тасовка.filter(function (i) { return порядок.indexOf(i) < 0; }).map(function (i) {
          return '<button class="иг-строчка" data-i="' + i + '"><b>' + экр(строки[i].de) + '</b><small>' + экр(строки[i].ru) + '</small></button>';
        }).join('') + '</div>' + (итог || '') +
        '<div class="иг-низ" id="игНиз">' + (итог ? '<button class="иг-главная" id="игДальше">Дальше</button>'
          : '<button class="иг-главная" id="игПроверить">Проверить</button>') + '</div>');
      if (итог) { document.getElementById('игДальше').onclick = ход.дальше; return; }
      карта_кнопки('#игОсталось .иг-строчка').forEach(function (к) { к.onclick = function () { порядок.push(+к.getAttribute('data-i')); рисовать(); }; });
      карта_кнопки('#игГотово .иг-строчка').forEach(function (к) { к.onclick = function () { порядок.splice(+к.getAttribute('data-п'), 1); рисовать(); }; });
      document.getElementById('игПроверить').onclick = function () {
        if (порядок.length < строки.length) return;
        var верно = порядок.every(function (i, п) { return i === п; });
        ход.ответ(верно, верно ? null : { de: строки.map(function (с) { return с.de; }).join(' / '), ru: 'порядок строк' });
        рисовать('<div class="иг-ответ ' + (верно ? 'верно' : 'мимо') + '">' + (верно ? '✓ Всё по порядку!' :
          'Правильно так:<br>' + строки.map(function (с, п) { return (п + 1) + '. <span class="де">' + экр(с.de) + '</span>'; }).join('<br>')) + '</div>');
      };
    }
    рисовать();
  }
};

/* 15. Диалог-карточки — реплика → ответь вслух → переверни (как Dialogcards на ZUM) */
var ДИАЛОГ = {
  код: 'диалог', имя: 'Диалог-карточки', значок: '💬', сама: true,
  под: 'Вопрос из урока — ответь вслух, потом переверни и сверь',
  /* ответ должен перекликаться с вопросом: общее слово (4+ букв) или Ja / Nein / Doch */
  связаны: function (в, о) {
    if (/^(ja|nein|doch)\b/i.test(о)) return true;
    var слв = {};
    слова_(в).forEach(function (с) { var н = норм(голое(с)); if (н.length >= 4) слв[н] = 1; });
    return слова_(о).some(function (с) { return слв[норм(голое(с))]; });
  },
  пары: function (д) {
    var п = [];
    // «Wo sind die Kinder? Sie sind bei der Oma.» — вопрос и ответ в одной строке урока
    д.фразы.forEach(function (ф) {
      var м = ф.de.match(/^(.+?\?)\s+(.+[.!])$/), мр = (ф.ru || '').match(/^(.+?\?)\s+(.+)$/);
      if (м && !/\?/.test(м[2]))
        п.push([{ ид: null, de: м[1], ru: мр ? мр[1] : ф.ru }, { ид: null, de: м[2], ru: мр ? мр[2] : '' }]);  // звук записи целиком выдал бы ответ — читает голос браузера
    });
    группы(д).forEach(function (г) {
      for (var i = 0; i + 1 < г.length; i++)
        if (/\?\s*$/.test(г[i].de) && !/\?\s*$/.test(г[i + 1].de) && ДИАЛОГ.связаны(г[i].de, г[i + 1].de))
          п.push([г[i], г[i + 1]]);
    });
    return п;
  },
  хватает: function (д) { return ДИАЛОГ.пары(д).length >= 3; },
  экран: function (х) {
    var пары = перемешать(ДИАЛОГ.пары(х.данные)).slice(0, 10), i = 0, знал = 0, открыта = false;
    function карта() {
      if (i >= пары.length) { х.конец(Math.round(знал / пары.length * 100), 'Знал ответ: ' + знал + ' из ' + пары.length); return; }
      var в = пары[i][0], о = пары[i][1];
      х.рисовать(
        '<p class="иг-подсказ">Карточка ' + (i + 1) + ' из ' + пары.length + '. Прочитай вопрос, ответь вслух — потом переверни.</p>' +
        '<div class="иг-карточка"><div class="кто">вопрос</div><div class="реплика">' + экр(в.de) + '</div>' +
        '<div class="перев">' + экр(в.ru) + '</div></div>' +
        (открыта ? '<div class="иг-карточка" style="border-color:var(--das,#8a6d1a)"><div class="кто">ответ из урока</div>' +
          '<div class="реплика">' + экр(о.de) + '</div><div class="перев">' + экр(о.ru) + '</div></div>' : '') +
        '<div class="иг-низ">' + (открыта
          ? '<button class="иг-главная" id="игЗнал">✓ Знал</button><button class="иг-тихая" id="игНеЗнал">✗ Повторить</button>'
          : '<button class="иг-главная" id="игПеревернуть">⟲ Перевернуть</button>') +
        '<button class="иг-тихая" id="игЗвук">🔊</button></div>');
      document.getElementById('игЗвук').onclick = function () { var к = открыта ? о : в; х.голос(к.ид, к.de); };
      if (открыта) {
        document.getElementById('игЗнал').onclick = function () { знал++; х.звукОтвета(true); i++; открыта = false; карта(); };
        document.getElementById('игНеЗнал').onclick = function () { пары.push(пары[i]); i++; открыта = false; карта(); };
      } else document.getElementById('игПеревернуть').onclick = function () { открыта = true; карта(); х.голос(о.ид, о.de); };
      if (!открыта) х.голос(в.ид, в.de);
    }
    карта();
  }
};

/* 16. Разговор с развилками (BranchingScenario на ZUM): пациент говорит — выбираешь реплику врача.
   Хорошая ведёт дальше, плохая — пациент переспрашивает или обижается, можно исправиться.
   Данные: scenarii/<урок>.json (пишет сценарии.py) → window.ИГРЫ_СЦЕНАРИЙ (блок урока грузит сам).
   { "имя", "вступление", "начало": "id", "узлы": { id: { "кто": "Patientin", "de", "ru",
     "варианты": [ { "de", "ru", "балл": 2|1|0, "почему", "к": "id" | null } ] } } }      */
var СЦЕНАРИЙ = {
  код: 'сценарий', имя: 'Разговор с пациентом', значок: '🩺', сама: true,
  под: 'Пациент говорит — выбери, что ответит врач. Разговор идёт по-разному',
  хватает: function () { var с = window.ИГРЫ_СЦЕНАРИЙ; return !!(с && с.узлы && с.начало); },
  экран: function (х) {
    var с = window.ИГРЫ_СЦЕНАРИЙ, путь = [], набрано = 0, максимум = 0, шагов = 0;
    function голос(de) { try { if (!window.speechSynthesis) return; var р = new SpeechSynthesisUtterance(de); р.lang = 'de-DE'; р.rate = .92; speechSynthesis.cancel(); speechSynthesis.speak(р); } catch (e) {} }
    function итог() {
      var процент = максимум ? Math.round(набрано / максимум * 100) : 0;
      х.рекорд(процент, набрано, максимум);
      х.рисовать('<div class="иг-итог"><div class="число">' + процент + '%</div><div class="строка">' +
        экр(с.имя || '') + ' · лучших ответов ' + путь.filter(function (п) { return п.в.балл === 2; }).length + ' из ' + путь.length + '</div></div>' +
        '<div class="иг-разбор"><h3>Разбор разговора:</h3>' + путь.map(function (п) {
          var лучший = п.у.варианты.filter(function (в) { return в.балл === 2; })[0];
          return '<div style="background:' + (п.в.балл === 2 ? 'rgba(31,95,91,.10)' : п.в.балл === 1 ? 'rgba(192,122,0,.10)' : 'var(--warn-bg,#fbeae6)') + '">' +
            '<b>' + (п.в.балл === 2 ? '✓' : п.в.балл === 1 ? '≈' : '✗') + '</b> <span class="де">' + экр(п.в.de) + '</span>' +
            (п.в.почему ? '<br><small>' + экр(п.в.почему) + '</small>' : '') +
            (п.в.балл < 2 && лучший ? '<br><small>Лучше: <span class="де">' + экр(лучший.de) + '</span></small>' : '') + '</div>';
        }).join('') + '</div>' +
        '<div class="иг-низ"><button class="иг-главная" id="игЕщё">↻ Ещё раз</button><button class="иг-тихая" id="игВыход">К играм</button></div>');
      document.getElementById('игЕщё').onclick = function () { СЦЕНАРИЙ.экран(х); };
      document.getElementById('игВыход').onclick = х.меню;
    }
    function узел(id, отклик) {
      var у = с.узлы[id];
      if (!у) { итог(); return; }
      шагов++;
      var варианты = перемешать(у.варианты);
      х.рисовать(
        (шагов === 1 && с.вступление ? '<p class="иг-подсказ">' + экр(с.вступление) + '</p>' : '') +
        (отклик || '') +
        '<div class="иг-карточка" style="text-align:left"><div class="кто">' + экр(у.кто || 'Patientin') + '</div>' +
        '<div class="реплика">' + экр(у.de) + '</div><div class="перев" id="игПер" hidden>' + экр(у.ru || '') + '</div></div>' +
        '<div class="иг-низ" style="margin:-4px 0 10px"><button class="иг-тихая" id="игСлушать">🔊</button><button class="иг-тихая" id="игПерКн">Перевод</button></div>' +
        (у.варианты.length ? '<p class="иг-подсказ"><b>Что скажет врач?</b></p><div class="иг-варианты">' + варианты.map(function (в, i) {
          return '<button class="иг-вариант" data-i="' + i + '">' + экр(в.de) + '</button>';
        }).join('') + '</div><div id="игОтвет"></div>' : '<div class="иг-низ"><button class="иг-главная" id="игКонец">Чем закончилось ›</button></div>'));
      document.getElementById('игСлушать').onclick = function () { голос(у.de); };
      document.getElementById('игПерКн').onclick = function () { var п = document.getElementById('игПер'); п.hidden = !п.hidden; };
      голос(у.de);
      if (!у.варианты.length) { document.getElementById('игКонец').onclick = итог; return; }
      карта_кнопки('.иг-вариант').forEach(function (к) {
        к.onclick = function () {
          var в = варианты[+к.getAttribute('data-i')];
          максимум += 2; набрано += в.балл; путь.push({ у: у, в: в });
          х.звукОтвета(в.балл === 2);
          карта_кнопки('.иг-вариант').forEach(function (д) {
            д.onclick = null;
            var вв = варианты[+д.getAttribute('data-i')];
            if (вв.балл === 2) д.classList.add('иг-верно'); else if (д === к) д.classList.add('иг-мимо');
          });
          document.getElementById('игОтвет').innerHTML = '<div class="иг-ответ ' + (в.балл === 2 ? 'верно' : 'мимо') + '">' +
            (в.балл === 2 ? '✓ ' : в.балл === 1 ? '≈ Можно, но… ' : '✗ ') + экр(в.почему || '') +
            (в.ru ? '<br><small>' + экр(в.ru) + '</small>' : '') + '</div>' +
            '<div class="иг-низ"><button class="иг-главная" id="игДальше">Дальше ›</button></div>';
          голос(в.de);
          document.getElementById('игДальше').onclick = function () { в.к ? узел(в.к) : итог(); };
        };
      });
    }
    узел(с.начало);
  }
};

var ВСЕ_ИГРЫ = [ПОРЯДОК, РОДЫ, ПРОПУСК, КНИЖКИ, СКАЖИ, ДИКТАНТ, ОТМЕТЬ, ТЕКСТ, ДИАЛОГ, СЦЕНАРИЙ, КАРТИНКА, АНАГРАММА, ПОСЛЕДОВАТЕЛЬНОСТЬ, ПАРОЧКИ, ПЛИТКИ, КОЛЕСО];

function доступные(д, сцены) {
  return ВСЕ_ИГРЫ.filter(function (и) { return и.хватает(д, сцены); });
}

function карта_кнопки(сел) {
  return Array.prototype.slice.call(document.querySelectorAll('#игКарта ' + сел));
}

window.ИГРЫ = ИГРЫ;
})();
