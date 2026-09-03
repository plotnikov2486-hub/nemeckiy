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
var ЗНАК    = { 'авто': '🌗', 'light': '☀️', 'dark': '🌙' };

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
  мета.content = тёмная ? '#12142A' : '#E9EBF6';
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
    'background:#FFFFFF; color:#1C2242; box-shadow:0 6px 20px rgba(40,50,110,.22);' +
    '-webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);}' +
    '#переклТемы:active{transform:scale(.95);}' +
    '#переклТемы .птп{font-size:12.5px; opacity:.7; font-weight:500;}' +
    ':root[data-theme="dark"] #переклТемы{background:#1E2140; color:#EDEFF8;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.45);}' +
    '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) #переклТемы{' +
    'background:#1E2140; color:#EDEFF8; box-shadow:0 6px 20px rgba(0,0,0,.45);}}' +
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
