/* «📚 Домашка к этому уроку» — полноэкранная домашка для уроков с Claude (21.10.2026, врач).
   Задания строятся сами из словаря урока (words/<урок>.json — тот же, что кормит ЗУБР и игры):
     • «Выбери правильный вариант» — в предложении урока пропуск(и): артикль, sein/haben,
       предлог, местоимение, модальный глагол…; три варианта (бывает парой, как у Даши «hat – ist»);
     • «Напиши по-немецки» — русская фраза урока → своё предложение, проверка с опечатками.
   После ответа — верный вариант, 🔊, перевод и «почему». В конце — «теперь поиграйте»;
   в конце игр (ядро) — «выполнить задания». Раскатывает встроить_игры.py → публикация/dz.js. */
(function () {
  'use strict';

  var СЕМЬИ = [
    { к: 'артикль', с: ['der', 'die', 'das', 'den', 'dem', 'des'],
      п: 'Артикль: сначала род слова (der/die/das), потом падеж — кто? (Nominativ), кого? (Akkusativ: den), кому? (Dativ: dem/der), чей? (Genitiv: des/der).' },
    { к: 'ein', с: ['ein', 'eine', 'einen', 'einem', 'einer', 'eines'],
      п: 'Неопределённый артикль: род + падеж. Akkusativ мужского — einen, Dativ — einem/einer.' },
    { к: 'kein', с: ['kein', 'keine', 'keinen', 'keinem', 'keiner'],
      п: 'kein склоняется как ein: keinen (Akk. м. р.), keinem (Dat.).' },
    { к: 'sein', с: ['bin', 'bist', 'ist', 'sind', 'seid'],
      п: 'sein: ich bin, du bist, er/sie/es ist, wir/sie/Sie sind, ihr seid.' },
    { к: 'haben', с: ['habe', 'hast', 'hat', 'haben', 'habt'],
      п: 'haben: ich habe, du hast, er/sie/es hat, wir/sie/Sie haben, ihr habt.' },
    { к: 'werden', с: ['werde', 'wirst', 'wird', 'werden', 'werdet'],
      п: 'werden: ich werde, du wirst, er wird, wir/sie/Sie werden, ihr werdet.' },
    { к: 'модальный', с: ['kann', 'muss', 'darf', 'soll', 'will', 'möchte', 'kannst', 'musst', 'darfst', 'sollst', 'willst', 'möchtest', 'können', 'müssen', 'dürfen', 'sollen', 'wollen', 'möchten'],
      п: 'Модальный глагол: kann — может, muss — должен, darf — можно/разрешено, soll — следует, will — хочет, möchte — хотел бы. Смотри и на лицо: ich/er kann, du kannst, wir können.' },
    { к: 'Konjunktiv', с: ['hätte', 'wäre', 'könnte', 'würde', 'sollte', 'müsste', 'dürfte'],
      п: 'Konjunktiv II — вежливость и «бы»: hätte (имел бы), wäre (был бы), könnte (мог бы), würde (+ инфинитив), sollte (следовало бы).' },
    { к: 'местоимение', с: ['mich', 'mir', 'dich', 'dir', 'ihn', 'ihm', 'uns', 'euch', 'Ihnen'],
      п: 'Местоимение: кого? — Akkusativ (mich, dich, ihn), кому? — Dativ (mir, dir, ihm, Ihnen). Смотри на глагол или предлог.' },
    { к: 'предлог', с: ['in', 'an', 'auf', 'mit', 'zu', 'nach', 'bei', 'von', 'aus', 'für', 'über', 'unter', 'vor', 'seit', 'gegen', 'ohne', 'durch', 'um'],
      п: 'Предлог часто держится за глагол или выражение (warten auf, Angst vor, nach Hause, zu Fuß) — запоминай целиком.' },
    { к: 'слитный', с: ['im', 'am', 'ins', 'zum', 'zur', 'vom', 'beim'],
      п: 'Слитные формы: im = in dem, am = an dem, ins = in das, zum = zu dem, zur = zu der, vom = von dem, beim = bei dem.' },
    { к: 'союз', с: ['weil', 'dass', 'wenn', 'als', 'ob', 'obwohl', 'denn', 'aber', 'deshalb', 'trotzdem', 'damit', 'bevor', 'nachdem', 'während'],
      п: 'Союз меняет смысл и порядок слов: после weil, dass, wenn, ob, obwohl глагол уходит в конец; после deshalb, trotzdem — сразу за ними.' }
  ];
  var ПО_СЛОВУ = {};
  СЕМЬИ.forEach(function (с) { с.с.forEach(function (сл) { if (!ПО_СЛОВУ[сл.toLowerCase()]) ПО_СЛОВУ[сл.toLowerCase()] = с; }); });

  function экр(т) { return String(т == null ? '' : т).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function чисто(т) { var d = document.createElement('div'); d.innerHTML = String(т || ''); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  function смешать(а) { а = а.slice(); for (var i = а.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = а[i]; а[i] = а[j]; а[j] = t; } return а; }
  function норм(т) { return String(т || '').toLowerCase().replace(/[„“"«».,!?;:()–—-]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function какВ(образец, слово) { return /^[A-ZÄÖÜ]/.test(образец) ? слово.charAt(0).toUpperCase() + слово.slice(1) : слово; }

  // перевод без пометок: «(пример книги)», «1. …», «❌/✅», «→ форма»
  function чистыйРу(ru) {
    ru = чисто(ru);
    if (/❌/.test(ru)) return '';
    ru = ru.replace(/✅/g, '').replace(/^\s*\d+\.\s*/, '').split(/\s+→\s+/)[0];
    ru = ru.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s*\([^)]*$/, '').trim();   // и недорезанная «(…»
    return ru.length >= 3 ? ru : '';
  }

  function фразыУрока(сырое) {
    var итог = [], было = {};
    (сырое || []).forEach(function (c) {
      if (!c || !c[1]) return;
      var de = чисто(c[1]).replace(/^[„"«]|[“"»]$/g, '');
      var ru = чистыйРу(c[3]);
      var сл = de.split(/\s+/);
      if (!ru || сл.length < 3 || сл.length > 14 || было[de] || /[\/…]|\.\.\./.test(de)) return;
      if (!/[а-яё]/i.test(ru)) return;                                   // «перевод» без русских букв — это пометка, не перевод
      if (/^(der|die|das)\s+\S+,\s*(der|die|das)\s/i.test(de)) return;   // карточка «слово, мн. число»
      было[de] = 1;
      итог.push({ ид: c[0], de: de, ru: ru, слова: сл });
    });
    return итог;
  }

  // «Выбери вариант»: 1–2 пропуска из «семей», 3 варианта
  function заданиеВыбор(ф) {
    var места = [];
    ф.слова.forEach(function (т, i) {
      var голое = т.replace(/[.,!?;:„“"«»()]/g, '');
      var с = ПО_СЛОВУ[голое.toLowerCase()];
      if (с && !(с.к === 'артикль' && i === 0 && ф.слова.length <= 3)) места.push({ i: i, голое: голое, семья: с });
    });
    if (!места.length) return null;
    места = смешать(места).slice(0, места.length >= 2 && Math.random() < .6 ? 2 : 1).sort(function (а, б) { return а.i - б.i; });
    function другое(м, кроме) {
      var вар = смешать(м.семья.с.filter(function (с) { return с.toLowerCase() !== м.голое.toLowerCase() && кроме.indexOf(с.toLowerCase()) < 0; }));
      return вар.length ? какВ(м.голое, вар[0]) : null;
    }
    var верно = места.map(function (м) { return м.голое; });
    var варианты = [верно], ключи = [верно.join('|').toLowerCase()];
    for (var п = 0; п < 12 && варианты.length < 3; п++) {
      var вар = места.map(function (м, к) {
        if (места.length === 2 && Math.random() < .35) return м.голое;      // один из двух — тот же
        return другое(м, [м.голое.toLowerCase()]) || м.голое;
      });
      var кл = вар.join('|').toLowerCase();
      if (ключи.indexOf(кл) < 0) { ключи.push(кл); варианты.push(вар); }
    }
    if (варианты.length < 3) return null;
    var текст = ф.слова.map(function (т, i) {
      for (var к = 0; к < места.length; к++) if (места[к].i === i) return т.replace(места[к].голое, '___');
      return т;
    }).join(' ');
    var почему = [], семьи = {};
    места.forEach(function (м) { if (!семьи[м.семья.к]) { семьи[м.семья.к] = 1; почему.push(м.семья.п); } });
    return { тип: 'выбор', ф: ф, текст: текст, верно: верно, варианты: смешать(варианты), почему: почему.join('<br>') };
  }

  function заданиеПисьмо(ф) {
    if (ф.слова.length > 9 || /[«»„“"]/.test(ф.de) || /\d|[<>&%]/.test(ф.de)) return null;   // числа и знаки писать неудобно
    return { тип: 'письмо', ф: ф };
  }

  function собрать(фразы) {
    var выбор = [], письмо = [];
    смешать(фразы).forEach(function (ф) {
      var в = заданиеВыбор(ф);
      if (в && выбор.length < 8) { выбор.push(в); return; }
      var п = заданиеПисьмо(ф);
      if (п && письмо.length < 4) письмо.push(п);
    });
    return выбор.concat(письмо);
  }

  function сравнить(ввод, надо) {
    var а = норм(ввод), б = норм(надо);
    if (!а) return 'пусто';
    if (а === б) return 'верно';
    var ас = а.split(' '), бс = б.split(' ');
    if (ас.length !== бс.length) return 'нет';
    var почти = 0;
    for (var i = 0; i < ас.length; i++) {
      if (ас[i] === бс[i]) continue;
      if (window.ИГРЫ_ОПЕЧАТКА && ИГРЫ_ОПЕЧАТКА(ас[i], бс[i])) { почти++; continue; }
      return 'нет';
    }
    return почти <= 2 ? 'почти' : 'нет';
  }

  var СТИЛЬ = ''
    + '.дз{ font-family:-apple-system,"SF Pro Text",Arial,sans-serif; color:var(--ink,#1c2242); max-width:720px; margin:0 auto; }'
    + '.дз-карта{ background:var(--surface,#fff); border:1px solid var(--line,#e4e6ef); border-radius:18px; padding:18px 16px; box-shadow:var(--shadow,0 8px 24px rgba(40,50,110,.10)); }'
    + '.дз h2{ font-size:20px; margin:0 0 4px; } .дз p.под{ font-size:13.5px; color:var(--ink-muted,#5b615c); margin:2px 0 14px; line-height:1.45; }'
    + '.дз-пути{ display:grid; gap:12px; } .дз-путь{ display:flex; align-items:center; gap:14px; width:100%; text-align:left; cursor:pointer; font:inherit;'
    + '  border-radius:16px; padding:16px; min-height:74px; border:1px solid var(--line,#e4e6ef); background:var(--surface-2,#f3f4fa); color:inherit; }'
    + '.дз-путь.главный{ background:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); border-color:var(--accent,#1f5f5b); }'
    + '.дз-путь i{ font-style:normal; font-size:30px; } .дз-путь b{ display:block; font-size:17px; } .дз-путь small{ display:block; font-size:13px; opacity:.85; margin-top:2px; }'
    + '.дз-шапка{ display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:13px; font-weight:700; color:var(--ink-muted,#5b615c); }'
    + '.дз-полоса{ flex:1; height:8px; border-radius:99px; background:var(--surface-2,#eceef6); overflow:hidden; } .дз-полоса i{ display:block; height:100%; background:var(--accent,#1f5f5b); }'
    + '.дз-тип{ font-size:12px; letter-spacing:.06em; text-transform:uppercase; font-weight:800; color:var(--accent,#1f5f5b); margin-bottom:8px; }'
    + '.дз-фраза{ font-family:Georgia,"Iowan Old Style",serif; font-size:21px; font-weight:700; line-height:1.5; margin:0 0 6px; }'
    + '.дз-фраза .дыр{ display:inline-block; min-width:58px; border-bottom:3px solid var(--accent,#1f5f5b); text-align:center; color:var(--accent,#1f5f5b); }'
    + '.дз-ру{ font-size:18px; font-weight:700; line-height:1.4; margin:0 0 6px; }'
    + '.дз-подск{ font-size:13px; color:var(--ink-muted,#5b615c); margin:0 0 12px; }'
    + '.дз-вар{ display:grid; gap:10px; margin:12px 0; } .дз-вар button{ font:inherit; font-family:Georgia,"Iowan Old Style",serif; font-size:18px; font-weight:700;'
    + '  padding:14px 16px; border-radius:14px; cursor:pointer; text-align:left; min-height:54px; background:var(--surface-2,#f3f4fa); color:inherit; border:2px solid var(--line,#e4e6ef); }'
    + '.дз-вар button.да{ border-color:#1f9d55; background:rgba(31,157,85,.14); } .дз-вар button.нет{ border-color:#d64545; background:rgba(214,69,69,.12); text-decoration:line-through; }'
    + '.дз textarea{ width:100%; font:inherit; font-size:17px; padding:12px; border-radius:12px; border:2px solid var(--line,#e4e6ef); background:var(--surface,#fff); color:inherit; min-height:84px; box-sizing:border-box; }'
    + '.дз-итог{ margin-top:12px; padding:12px 14px; border-radius:14px; background:var(--surface-2,#f3f4fa); border:1px solid var(--line,#e4e6ef); line-height:1.5; }'
    + '.дз-итог .верд{ font-weight:800; font-size:16px; margin-bottom:6px; } .дз-итог .де{ font-family:Georgia,serif; font-size:18px; font-weight:700; }'
    + '.дз-итог .ру{ color:var(--ink-muted,#5b615c); font-size:14px; margin-top:4px; } .дз-итог .поч{ font-size:13px; color:var(--ink-muted,#5b615c); margin-top:8px; }'
    + '.дз-звук{ font:inherit; font-size:15px; border:none; background:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); border-radius:99px; padding:5px 11px; cursor:pointer; margin-left:6px; vertical-align:middle; }'
    + '.дз-низ{ display:flex; gap:10px; flex-wrap:wrap; margin-top:14px; } .дз-низ button{ font:inherit; font-size:16px; font-weight:800; cursor:pointer; border-radius:14px; padding:13px 18px; flex:1; min-height:50px;'
    + '  border:1px solid var(--line,#e4e6ef); background:var(--surface,#fff); color:inherit; } .дз-низ button.главная{ background:var(--accent,#1f5f5b); color:var(--accent-ink,#fff); border-color:var(--accent,#1f5f5b); }'
    + '.дз-низ button:disabled{ opacity:.45; } .дз-счёт{ font-size:44px; font-weight:900; text-align:center; color:var(--accent,#1f5f5b); margin:8px 0 2px; }';

  window.ДОМАШКА = {
    /* наст: { корень, слова, урок, база, игры: function() — открыть игры } */
    старт: function (наст) {
      var фразы = фразыУрока(наст.слова);
      var задания = собрать(фразы);
      if (задания.length < 4) return 0;
      if (!document.getElementById('дз-стиль')) { var ст = document.createElement('style'); ст.id = 'дз-стиль'; ст.textContent = СТИЛЬ; document.head.appendChild(ст); }
      var корень = наст.корень, урок = наст.урок, база = наст.база || '../';
      var ключ = 'nemeckiy_dz_' + урок;
      var i = 0, верных = 0;

      function звук(ид) {
        try { if (localStorage.getItem('nemeckiy_zvuk_выкл') === '1') return; } catch (e) {}
        try { new Audio(база + 'zvuk/' + урок + '/' + ид + '.mp3').play().catch(function () {}); } catch (e) {}
      }
      function кнЗвук(ид) { return '<button type="button" class="дз-звук" data-звук="' + экр(ид) + '">🔊</button>'; }
      function оживитьЗвук() {
        Array.prototype.forEach.call(корень.querySelectorAll('[data-звук]'), function (к) { к.onclick = function () { звук(к.getAttribute('data-звук')); }; });
      }
      function рекорд() { try { return JSON.parse(localStorage.getItem(ключ) || 'null'); } catch (e) { return null; } }

      function меню() {
        var р = рекорд(), игр = (window.ИГРЫ && ИГРЫ.какиеЕсть) ? ИГРЫ.какиеЕсть().length : 0;
        корень.innerHTML = '<div class="дз"><div class="дз-карта"><h2>📚 Домашка к этому уроку</h2>' +
          '<p class="под">Сначала задания — по одному, с проверкой и пояснением. Потом закрепить в играх. Можно и сразу в игры.</p>' +
          '<div class="дз-пути"><button type="button" class="дз-путь главный" id="дзЗадания"><i>📝</i><span><b>Задания (' + задания.length + ')</b>' +
          '<small>выбери вариант · напиши по-немецки' + (р ? ' · прошлый раз: ' + р.верных + ' из ' + р.всего : '') + '</small></span></button>' +
          (игр ? '<button type="button" class="дз-путь" id="дзИгры"><i>🎮</i><span><b>Игры (' + игр + ')</b><small>те же слова урока — играть</small></span></button>' : '') +
          '</div></div></div>';
        корень.querySelector('#дзЗадания').onclick = function () { задания = собрать(фразы); i = 0; верных = 0; показать(); };
        var иг = корень.querySelector('#дзИгры'); if (иг) иг.onclick = function () { наст.игры && наст.игры(); };
      }

      function шапка() {
        return '<div class="дз-шапка"><span>Задание ' + (i + 1) + ' из ' + задания.length + '</span>' +
          '<div class="дз-полоса"><i style="width:' + Math.round(i / задания.length * 100) + '%"></i></div><span>' + верных + ' ✓</span></div>';
      }
      function итогБлок(верд, з, почему) {
        return '<div class="дз-итог"><div class="верд">' + верд + '</div><div class="де">' + экр(з.ф.de) + кнЗвук(з.ф.ид) + '</div>' +
          '<div class="ру">' + экр(з.ф.ru) + '</div>' + (почему ? '<div class="поч">💡 ' + почему + '</div>' : '') + '</div>';
      }
      function дальше() { i++; if (i >= задания.length) финал(); else показать(); корень.scrollIntoView({ block: 'start' }); }

      function показать() {
        var з = задания[i];
        if (з.тип === 'выбор') {
          var фраза = экр(з.текст).replace(/___/g, '<span class="дыр">?</span>');
          корень.innerHTML = '<div class="дз"><div class="дз-карта">' + шапка() + '<div class="дз-тип">Выбери правильный вариант</div>' +
            '<div class="дз-фраза">' + фраза + '</div><div class="дз-подск">' + экр(з.ф.ru) + '</div>' +
            '<div class="дз-вар">' + з.варианты.map(function (в, к) { return '<button type="button" data-в="' + к + '">' + экр(в.join(' – ')) + '</button>'; }).join('') + '</div>' +
            '<div id="дзОтвет"></div><div class="дз-низ"><button type="button" class="главная" id="дзДалее" disabled>Далее →</button></div></div></div>';
          Array.prototype.forEach.call(корень.querySelectorAll('[data-в]'), function (кн) {
            кн.onclick = function () {
              if (корень.querySelector('.дз-вар .да')) return;
              var в = з.варианты[+кн.getAttribute('data-в')];
              var ок = в.join('|').toLowerCase() === з.верно.join('|').toLowerCase();
              if (ок) верных++;
              Array.prototype.forEach.call(корень.querySelectorAll('[data-в]'), function (б) {
                var вв = з.варианты[+б.getAttribute('data-в')];
                if (вв.join('|').toLowerCase() === з.верно.join('|').toLowerCase()) б.classList.add('да');
                else if (б === кн) б.classList.add('нет');
              });
              корень.querySelector('#дзОтвет').innerHTML = итогБлок(ок ? '✅ Верно!' : '❌ Правильно: ' + экр(з.верно.join(' – ')), з, з.почему);
              оживитьЗвук(); if (ок) звук(з.ф.ид);
              var д = корень.querySelector('#дзДалее'); д.disabled = false; д.onclick = дальше;
            };
          });
        } else {
          корень.innerHTML = '<div class="дз"><div class="дз-карта">' + шапка() + '<div class="дз-тип">Напиши по-немецки</div>' +
            '<div class="дз-ру">' + экр(з.ф.ru) + '</div><div class="дз-подск">' + з.ф.слова.length + ' слов · фраза из урока</div>' +
            '<textarea id="дзВвод" lang="de" autocapitalize="sentences" spellcheck="false" placeholder="по-немецки…"></textarea>' +
            '<div id="дзОтвет"></div><div class="дз-низ"><button type="button" id="дзПроверить" class="главная">Проверить</button>' +
            '<button type="button" id="дзДалее" disabled>Далее →</button></div></div></div>';
          var пр = корень.querySelector('#дзПроверить'), д = корень.querySelector('#дзДалее');
          пр.onclick = function () {
            var р = сравнить(корень.querySelector('#дзВвод').value, з.ф.de);
            if (р === 'пусто') { корень.querySelector('#дзВвод').focus(); return; }
            if (р === 'верно' || р === 'почти') верных++;
            корень.querySelector('#дзОтвет').innerHTML = итогБлок(
              р === 'верно' ? '✅ Верно!' : р === 'почти' ? '🟠 Почти — проверь написание. Так в уроке:' : '❌ Сравни с уроком:', з,
              р === 'нет' ? 'Порядок слов: глагол на втором месте, в придаточном (после weil, dass, wenn) — в конце. Другой верный вариант тоже возможен — сверь смысл.' : '');
            оживитьЗвук(); звук(з.ф.ид);
            пр.disabled = true; д.disabled = false; д.classList.add('главная'); пр.classList.remove('главная'); д.onclick = дальше;
          };
        }
      }

      function финал() {
        try { localStorage.setItem(ключ, JSON.stringify({ верных: верных, всего: задания.length, когда: Date.now() })); } catch (e) {}
        var игр = (window.ИГРЫ && ИГРЫ.какиеЕсть) ? ИГРЫ.какиеЕсть().length : 0;
        корень.innerHTML = '<div class="дз"><div class="дз-карта"><h2>🎉 Вы выполнили все задания!</h2>' +
          '<div class="дз-счёт">' + верных + ' из ' + задания.length + '</div>' +
          '<p class="под" style="text-align:center">' + (игр ? 'Теперь для закрепления — поиграйте в игры на тех же словах.' : 'Отличная работа.') + '</p>' +
          '<div class="дз-низ">' + (игр ? '<button type="button" class="главная" id="дзВИгры">🎮 Играть</button>' : '') +
          '<button type="button" id="дзЕщё">↻ Новые задания</button></div></div></div>';
        var в = корень.querySelector('#дзВИгры'); if (в) в.onclick = function () { наст.игры && наст.игры(); };
        корень.querySelector('#дзЕщё').onclick = function () { задания = собрать(фразы); i = 0; верных = 0; показать(); };
      }

      window.ДОМАШКА.меню = меню;
      меню();
      return задания.length;
    }
  };
})();
