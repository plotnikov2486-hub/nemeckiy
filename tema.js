/* Переключатель светлой и тёмной темы — один на весь сайт.

   Просьба Григория: «чтобы человек мог переключить внутри сайта, кому как
   нравится». Три состояния по кругу: как в системе → светлая → тёмная.

   Выбор общий для всех страниц (ключ nemeckiy_тема), поэтому переключил
   в уроке — сменилось и в ЗУБРе, и в справочнике.

   Подключать в <head> ОБЫЧНЫМ тегом, без defer: тема должна встать
   до первой отрисовки, иначе страница мигнёт белым. */
(function(){
"use strict";

var КЛЮЧ = 'nemeckiy_тема';
var ПОРЯДОК = ['авто', 'light', 'dark'];
var ПОДПИСЬ = { 'авто': 'как в системе', 'light': 'светлая', 'dark': 'тёмная' };
// 04.11 Hallmark: значки нарисованы (SVG), а не эмодзи
var ЗНАК    = { 'авто': '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"8\"/><path d=\"M12 4a8 8 0 0 1 0 16z\" fill=\"currentColor\"/></svg>', 'light': '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2\"/></svg>', 'dark': '<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" aria-hidden=\"true\"><path d=\"M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z\"/></svg>' };

function выбранная(){
  try{
    var з = localStorage.getItem(КЛЮЧ);
    return ПОРЯДОК.indexOf(з) >= 0 ? з : 'авто';
  }catch(e){ return 'авто'; }
}

function применить(тема){
  var к = document.documentElement;
  if (тема === 'авто') к.removeAttribute('data-theme');
  else k_set(к, тема);
  // цвет строки состояния на телефоне — чтобы шапка не выбивалась
  var тёмная = тема === 'dark' || (тема === 'авто' && window.matchMedia &&
               window.matchMedia('(prefers-color-scheme: dark)').matches);
  var мета = document.querySelector('meta[name="theme-color"]');
  if (!мета){
    мета = document.createElement('meta');
    мета.name = 'theme-color';
    document.head && document.head.appendChild(мета);
  }
  мета.content = тёмная ? 'oklch(19% 0.016 255)' : 'oklch(97% 0.012 95)';
}
function k_set(к, тема){ к.setAttribute('data-theme', тема); }

// ── профиль: у Гриши синий, у Полины розовый ──
// Раньше это работало только на главной. Ставим здесь же, чтобы цвет
// был единым на всех страницах и вставал до первой отрисовки.
function профиль(){
  try{ return localStorage.getItem('nemeckiy_profile') === 'polina' ? 'polina' : 'grigoriy'; }
  catch(e){ return 'grigoriy'; }
}
function применитьПрофиль(){
  document.documentElement.setAttribute('data-кто', профиль());
}

// ── ставим тему и профиль СРАЗУ, ещё до отрисовки страницы ──
применить(выбранная());
применитьПрофиль();

// ── кнопка появляется, когда страница готова ──
function кнопку(){
  if (document.getElementById('переклТемы')) return;

  var б = document.createElement('button');
  б.id = 'переклТемы';
  б.type = 'button';

  var стиль = document.createElement('style');
  стиль.textContent =
    '#переклТемы{position:fixed; right:14px; bottom:16px; z-index:9999;' +
    'display:flex; align-items:center; gap:7px; padding:10px 14px; border:none;' +
    'border-radius:99px; cursor:pointer; font:inherit; font-size:14px; font-weight:600;' +
    'background:var(--color-card, oklch(98.8% 0.007 95)); color:var(--color-ink, oklch(20% 0.014 255)); box-shadow:inset 0 0 0 1px var(--color-rule, oklch(87% 0.016 95)), 0 4px 0 0 var(--color-edge, oklch(83% 0.04 88));' +
    '-webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);}' +
    '#переклТемы:active{translate:0 3px;} #переклТемы span{display:inline-flex;align-items:center;}' +
    '#переклТемы .птп{font-size:12.5px; opacity:.7; font-weight:500;}' +
    ':root[data-theme="dark"] #переклТемы{background:oklch(25% 0.018 255); color:oklch(95% 0.014 95);' +
    'box-shadow:inset 0 0 0 1px oklch(33% 0.018 255), 0 4px 0 0 oklch(14% 0.016 255);}' +
    '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) #переклТемы{' +
    'background:oklch(25% 0.018 255); color:oklch(95% 0.014 95); box-shadow:inset 0 0 0 1px oklch(33% 0.018 255), 0 4px 0 0 oklch(14% 0.016 255);}}' +
    '@media (max-width:560px){#переклТемы .птп{display:none;} #переклТемы{padding:11px 13px;}}' +
    '@media print{#переклТемы{display:none;}}';
  document.head.appendChild(стиль);

  function нарисовать(){
    var т = выбранная();
    б.innerHTML = '<span>' + ЗНАК[т] + '</span><span class="птп">' + ПОДПИСЬ[т] + '</span>';
    б.title = 'Тема: ' + ПОДПИСЬ[т] + ' — нажми, чтобы сменить';
    б.setAttribute('aria-label', б.title);
  }

  б.onclick = function(){
    var следующая = ПОРЯДОК[(ПОРЯДОК.indexOf(выбранная()) + 1) % ПОРЯДОК.length];
    try{ localStorage.setItem(КЛЮЧ, следующая); }catch(e){}
    применить(следующая);
    нарисовать();
  };

  нарисовать();
  document.body.appendChild(б);
}

if (document.readyState === 'loading')
  document.addEventListener('DOMContentLoaded', кнопку);
else кнопку();

// если человек сменил тему в системе, а у нас стоит «авто» — подхватываем
if (window.matchMedia){
  var сл = window.matchMedia('(prefers-color-scheme: dark)');
  var обработчик = function(){ if (выбранная() === 'авто') применить('авто'); };
  if (сл.addEventListener) сл.addEventListener('change', обработчик);
  else if (сл.addListener) сл.addListener(обработчик);
}

// вкладка в другом окне сменила тему — синхронизируемся
window.addEventListener('storage', function(e){
  if (e.key === 'nemeckiy_profile') применитьПрофиль();
  if (e.key === КЛЮЧ){
    применить(выбранная());
    var б = document.getElementById('переклТемы');
    if (б){ document.getElementById('переклТемы').remove(); кнопку(); }
  }
});
})();

/* 05.11.2026 врач: на экране блокировки айфона висела старая иконка «D немецкий» с белыми полосами и «ЗУБР — слова немецкого».
   Теперь при любом звуке сайта — логотип GlobalDoc (квадрат во весь край) и название страницы. */
(function(){
  if (!('mediaSession' in navigator) || !window.MediaMetadata || !window.HTMLMediaElement) return;
  var корень = (function(){ try { return document.currentScript.src.replace(/tema\.js.*$/, ''); } catch (e) { return ''; } })();
  var играть = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(){
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: (document.title || '').split(/\s+[—–-]\s+/)[0] || 'Немецкий для врачей',
        artist: 'GlobalDoc',
        artwork: [{ src: корень + 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
      });
    } catch (e) {}
    return играть.apply(this, arguments);
  };
})();
