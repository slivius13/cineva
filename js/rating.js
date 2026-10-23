/* === CINEVA RATING SYSTEM & CANVAS EXPORTER === */
(() => {
  const byId = id => document.getElementById(id);
  const $ = byId;
  const num = id => {
    const el = byId(id);
    return el ? Number(el.value || 0) : 0;
  };

  const showToast = (msg, type) => (typeof window.showToast === 'function' ? window.showToast(msg, type) : null);
  const tmdbFetch = (...args) => (typeof window.tmdbFetch === 'function' ? window.tmdbFetch(...args) : null);
  const kpFetch = (...args) => (typeof window.kpFetch === 'function' ? window.kpFetch(...args) : null);
  const posterUrl = (path, size = 'w500') => (typeof window.posterUrl === 'function' ? window.posterUrl(path, size) : (path ? `https://image.tmdb.org/t/p/${size}${path}` : ''));
  const releaseYear = item => (typeof window.releaseYear === 'function' ? window.releaseYear(item) : String((item.release_date || item.first_air_date || item.year || '').slice(0, 4)));
  const titleMatchScore = (q, item) => (typeof window.CINEVA?.titleMatchScore === 'function' ? window.CINEVA.titleMatchScore(q, item) : 0);

  // Criteria definitions
  const criteriaData = [
    { id: 'story', name: 'Сценарий / Образы', hint: 'Логика истории, конфликты и диалоги, выразительность образов и символов; оценивай точность и оригинальность замысла.' },
    { id: 'structure', name: 'Структура / Ритмика', hint: 'Композиция, монтаж, последовательность сцен и управление темпом: как произведение развивается и удерживает внимание.' },
    { id: 'craft', name: 'Режиссура / Реализация стиля', hint: 'Насколько последовательно и выразительно воплощён выбранный стиль: постановка, камера, свет, монтаж, звук и музыка. Учитывай решения, а не бюджет.' },
    { id: 'characters', name: 'Персонажи / Индивидуальность и харизма', hint: 'Самобытность персонажей, достоверность актёрской игры, индивидуальность исполнителей, харизма и химия между ними.' }
  ];

  // Initialize criteria DOM if criteria container is present
  const criteriaRoot = byId('criteria');
  if (criteriaRoot) {
    criteriaRoot.replaceChildren();
    criteriaData.forEach(c => {
      const el = document.createElement('div');
      el.className = 'criterion';
      el.innerHTML = `
        <div class="crit-head"><div class="crit-name">${c.name}</div><div class="val" id="val-${c.id}">5</div></div>
        <div class="hint">${c.hint}</div>
        <div class="range-line"><span class="range-edge">1</span><input id="${c.id}" type="range" min="1" max="10" value="5" step="1" aria-label="${c.name}"><span class="range-edge">10</span></div>
        <div class="depth-desc" id="desc-${c.id}">5 из 10 баллов</div>
      `;
      criteriaRoot.appendChild(el);
    });
  }

  const depthDescriptions = {
    1: '1 балл — Развлекательный посыл: произведение прежде всего даёт аттракцион, эмоцию или жанровое удовольствие; самостоятельный смысловой слой почти не выражен.',
    2: '2 балла — Простой житейский или жанровый смысл: тема считывается напрямую, конфликт понятен, но трактовка в основном буквальная.',
    3: '3 балла — Личная и психологическая глубина: рефлексия, сложные чувства, внутренние противоречия и размышление о месте человека в мире.',
    4: '4 балла — Социальное и нравственное высказывание: произведение исследует общество, мораль, эпоху или сложные явления и допускает несколько прочтений.',
    5: '5 баллов — Вневременные смыслы: многослойное высказывание об универсальных вопросах, которое не исчерпывается сюжетом или историческим контекстом.'
  };

  const valueDescriptions = {
    rarityGenre: {
      '0.5': 'Распространённый жанр с устойчивыми, часто используемыми тропами.',
      '1.0': 'Знакомый жанр, но сочетание поджанров или акцентов встречается реже.',
      '1.5': 'Редкое сочетание жанров либо нетипичная трактовка привычного направления.',
      '2.0': 'Редкий поджанр или смелая жанровая деконструкция.',
      '2.5': 'Уникальный жанровый ход или эксперимент, которому трудно подобрать близкие аналоги.'
    },
    rarityFormat: {
      '0.5': 'Наиболее распространённый формат исполнения и привычная производственная форма.',
      '1.0': 'Стандартный для кино формат без заметно необычных формальных решений.',
      '1.5': 'Необычное, но уже известное сочетание способов исполнения или подачи.',
      '2.0': 'Редкий формат исполнения — например, гибрид игровых, документальных или анимационных средств, если он необычен для данного контекста.',
      '2.5': 'Исключительно редкая или уникальная форма исполнения, определяющая всё произведение.'
    },
    integFormat: {
      '0.5': 'Компактный формат: короткометражка, спецэпизод или небольшая подборка отдельных историй.',
      '1.0': 'Развёрнутый формат: полнометражное произведение или законченный сезон, рассчитанный на цельное восприятие.'
    },
    integGenre: {
      '0.5': 'Сборник эпизодов или жанров: единой идеи, связывающей части, почти нет.',
      '1.0': 'В центре две-три самостоятельные идеи; они соседствуют, но связываются не всегда последовательно.',
      '1.5': 'Несколько идей или жанров связаны общей темой, хотя цельность временами теряется.',
      '2.0': 'Единая идея организует жанр, тональность и развитие произведения.',
      '2.5': 'Цельный жанровый эксперимент: необычная форма и все её элементы подчинены общему замыслу.'
    },
    integMeaning: {
      '0.5': 'Ясное смысловое высказывание почти отсутствует; события или эпизоды слабо связаны между собой.',
      '1.0': 'Есть понятная тема и связное повествование; основные части складываются в законченное целое.',
      '1.5': 'Цельное повествование и ясная смысловая линия: сцены, образы и финал усиливают общий замысел.'
    },
    impactScale: {
      '0.5': 'Создатель практически неизвестен широкой аудитории; мало заметных упоминаний и работ с существенным охватом.',
      '1.0': 'Малоизвестный автор: о нём знают преимущественно в узком жанровом или профессиональном кругу.',
      '1.5': 'Узнаваемый создатель с устойчивой аудиторией и заметными работами, коллаборациями или публикациями.',
      '2.0': 'Очень известный автор: широкая аудитория, регулярное внимание медиа и заметное присутствие в индустрии.',
      '2.5': 'Один из наиболее известных создателей или авторов крупной франшизы; высокий публичный охват и широкая узнаваемость.'
    },
    impactHype: {
      '0.5': 'Почти нет ожидания до выхода: слабый анонс, мало промо и почти отсутствуют предварительные обсуждения.',
      '1.0': 'Незначительное ожидание: анонсы или трейлеры замечает главным образом профильная аудитория.',
      '1.5': 'Умеренный интерес: есть заметные трейлеры, публикации и обсуждения среди поклонников.',
      '2.0': 'Высокие ожидания: масштабная промокампания, активные обсуждения и заметный интерес широкой аудитории.',
      '2.5': 'Релиз-событие: крупная кампания, устойчивый медийный резонанс и ожидание, выходящее за пределы фанатского круга.'
    }
  };

  const qualityDescriptions = {
    story: {
      1: 'Сценарная логика почти не работает; образы случайны или шаблонны.',
      2: 'Мотивировки и диалоги слабы, конфликт держится на клише.',
      3: 'Есть отдельные удачные находки, но история часто предсказуема или неубедительна.',
      4: 'Некоторые сцены и образы работают, однако заметны штампы и пробелы.',
      5: 'Крепкая базовая драматургия: история понятна, но образы и ходы в основном знакомы.',
      6: 'Уверенная история и выразительные сцены; часть линий или образов раскрыта не полностью.',
      7: 'Хорошо собранный сценарий, запоминающиеся образы и в основном убедительные мотивировки.',
      8: 'Выразительная драматургия и многослойные образы; детали поддерживают общую тему.',
      9: 'Высокая оригинальность и точность: образы, символы и сюжетные решения работают как единая система.',
      10: 'Исключительно самобытная и цельная драматургия; каждая деталь значима и усиливает замысел.'
    },
    structure: {
      1: 'Композиция распадается; темп мешает понять развитие произведения.',
      2: 'Переходы неубедительны, ритм часто случайный, есть серьёзные провалы.',
      3: 'Отдельные части плохо связаны или сильно проседают по темпу.',
      4: 'Общий ход понятен, однако ритм неровный, а часть эпизодов кажется лишней.',
      5: 'Рабочая стандартная структура; темп в целом приемлем, но не всегда точен.',
      6: 'Хорошо организованное развитие с несколькими затянутыми или поспешными фрагментами.',
      7: 'Сцены выстроены убедительно, ритм поддерживает развитие и внимание.',
      8: 'Сильная композиция и точное управление темпом; переходы и нарастание напряжения работают.',
      9: 'Ритм осознанно формирует впечатление, почти каждая сцена добавляет смысл или движение.',
      10: 'Исключительно точная структура: форма и темп усиливают замысел, случайных или лишних фрагментов почти нет.'
    },
    craft: {
      1: 'Постановка и техническая реализация не складываются в цельный стиль.',
      2: 'Много случайных решений; камера, монтаж, свет или звук часто мешают восприятию.',
      3: 'Есть отдельные удачные решения, но исполнение заметно неровное.',
      4: 'Ремесленная база присутствует, однако стиль и технические решения непоследовательны.',
      5: 'Компетентная реализация без выраженного единства или оригинальности.',
      6: 'Визуальные и звуковые средства в основном согласованы с замыслом.',
      7: 'Уверенная режиссура: камера, монтаж, свет и звук поддерживают настроение и тему.',
      8: 'Выразительный и последовательный авторский подход к форме и атмосфере.',
      9: 'Оригинальные формальные решения точно работают вместе и усиливают произведение.',
      10: 'Исключительно целостная реализация: визуальный и звуковой язык сам становится частью высказывания.'
    },
    characters: {
      1: 'Персонажи плоские, индивидуальность почти не проявляется, игра неубедительна.',
      2: 'Преобладают шаблонные типажи, реакции и мотивация выглядят искусственно.',
      3: 'Есть знакомые характеры и отдельные удачные моменты, но исполнения неровные.',
      4: 'Некоторые персонажи запоминаются, однако большинство раскрыто поверхностно.',
      5: 'В целом убедительно, но индивидуальность и химия между героями ограничены.',
      6: 'Есть живые характеры и достоверная игра, хотя глубина раскрытия неодинакова.',
      7: 'Персонажи различимы и убедительны; взаимодействия и актёрская химия работают.',
      8: 'Сильная индивидуальность, многослойные характеры и выразительные исполнения.',
      9: 'Персонажи и актёрские работы запоминаются надолго, а взаимодействия психологически точны.',
      10: 'Исключительно самобытные и полноценно раскрытые характеры; харизма и взаимодействия создают собственный мир.'
    }
  };

  function updateValueDescriptions() {
    Object.entries(valueDescriptions).forEach(([id, descriptions]) => {
      const el = byId(id), desc = byId(id + 'Desc');
      if (!el || !desc) return;
      const value = Number(el.value).toFixed(1);
      desc.textContent = `${value} — ${descriptions[value] || 'Промежуточное значение выбранного критерия.'}`;
    });

    criteriaData.forEach(c => {
      const el = byId(c.id), desc = byId('desc-' + c.id);
      if (el && desc) {
        const value = Number(el.value);
        desc.textContent = `${value}/10 — ${qualityDescriptions[c.id]?.[value] || 'Оценка выбранного уровня реализации.'}`;
      }
    });

    const vibe = byId('vibe');
    if (vibe && byId('vibeDesc')) {
      byId('vibeDesc').textContent = `${vibe.value} из 10 — ${vibe.value <= 3 ? 'сдержанное эмоциональное погружение' : vibe.value <= 6 ? 'умеренное эмоциональное погружение' : vibe.value <= 8 ? 'сильное эмоциональное погружение' : 'максимальное эмоциональное погружение'}.`;
    }
  }

  const impactMultiplierTable = {
    '1.0': 1.12,
    '1.5': 1.34,
    '2.0': 1.50,
    '2.5': 1.62,
    '3.0': 1.72,
    '3.5': 1.81,
    '4.0': 1.88,
    '4.5': 1.94,
    '5.0': 2.00
  };

  const vibeMultipliers = [1.0000, 1.0675, 1.1349, 1.2024, 1.2699, 1.3373, 1.4048, 1.4723, 1.5397, 1.6072];

  function getValueTier(val, kindText) {
    const noun = kindText.includes('СЕРИАЛ') ? 'СЕРИАЛ' : (kindText.includes('МУЛЬТ') ? 'МУЛЬТФИЛЬМ' : 'ФИЛЬМ');
    if (val >= 24) return { name: `РУБИНОВЫЙ ${noun}`, short: 'Рубин', range: '24.00 – 30.00', color: '#ff4d6d', bg: 'rgba(255,77,109,.16)', dark: '#3b0d18' };
    if (val >= 18) return { name: `САПФИРОВЫЙ ${noun}`, short: 'Сапфир', range: '18.00 – 23.99', color: '#60a5fa', bg: 'rgba(96,165,250,.16)', dark: '#0f2342' };
    if (val >= 12) return { name: `ИЗУМРУДНЫЙ ${noun}`, short: 'Изумруд', range: '12.00 – 17.99', color: '#34d399', bg: 'rgba(52,211,153,.16)', dark: '#0b2e23' };
    if (val >= 6) return { name: `ЗОЛОТОЙ ${noun}`, short: 'Золото', range: '6.00 – 11.99', color: '#fbbf24', bg: 'rgba(251,191,36,.16)', dark: '#332407' };
    return { name: `СЕРЕБРЯНЫЙ ${noun}`, short: 'Серебро', range: '0.34 – 5.99', color: '#cbd5e1', bg: 'rgba(203,213,225,.14)', dark: '#1e2430' };
  }

  function setArtworkColors(img) {
    const rootStyle = document.documentElement.style;
    const fallback = ['#273a48', '#171923', '#c5ff65'];
    const apply = colors => {
      rootStyle.setProperty('--art-a', colors[0] || fallback[0]);
      rootStyle.setProperty('--art-b', colors[1] || fallback[1]);
      rootStyle.setProperty('--art-accent', colors[2] || fallback[2]);
    };
    const sample = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, n = 0, brightR = 0, brightG = 0, brightB = 0, brightN = 0;
        for (let i = 0; i < data.length; i += 16) {
          const rr = data[i], gg = data[i + 1], bb = data[i + 2];
          if (rr + gg + bb < 420) { r += rr; g += gg; b += bb; n++; }
          if (Math.max(rr, gg, bb) - Math.min(rr, gg, bb) > 25) { brightR += rr; brightG += gg; brightB += bb; brightN++; }
        }
        const dark = n ? `rgb(${Math.round(r / n * 0.48)},${Math.round(g / n * 0.48)},${Math.round(b / n * 0.48)})` : fallback[1];
        const average = `rgb(${Math.round(r / (n || 1))},${Math.round(g / (n || 1))},${Math.round(b / (n || 1))})`;
        const accent = brightN ? `rgb(${Math.round(brightR / brightN)},${Math.round(brightG / brightN)},${Math.round(brightB / brightN)})` : '#c5ff65';
        apply([average, dark, accent]);
      } catch (_) {
        apply(fallback);
      }
    };
    if (img.complete && img.naturalWidth) sample();
    else img.addEventListener('load', sample, { once: true });
  }

  function displayGenre(text) {
    return String(text || '').split(',').map(part => part.trim().replace(/(^|[\s-])([а-яёa-z])/giu, (match, prefix, letter) => prefix + letter.toLocaleUpperCase('ru-RU'))).join(', ');
  }

  function fmtNum(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  // ==========================================
  // RATING CALCULATOR UPDATE FUNCTION
  // ==========================================
  function update() {
    if (!byId('title')) return;
    updateValueDescriptions();

    // 1. Base criteria (4..40) & Quality (10%..100%)
    let baseSum = 0;
    criteriaData.forEach(c => {
      const v = num(c.id);
      baseSum += v;
      if (byId('val-' + c.id)) byId('val-' + c.id).textContent = String(v);
      if (byId('share-' + c.id)) byId('share-' + c.id).textContent = String(v);
    });
    const qualityPct = baseSum * 2.5;
    const qualityFactor = qualityPct / 100;

    // 2. Vibe and 90-point rating
    const vibe = num('vibe');
    const vibeMult = vibeMultipliers[Math.max(0, Math.min(9, vibe - 1))] || 1.2699;
    if (byId('vibeValue')) byId('vibeValue').textContent = String(vibe);
    if (byId('share-vibe')) byId('share-vibe').textContent = String(vibe);
    const score90 = Math.round(baseSum * 1.4 * vibeMult);
    if (byId('score')) byId('score').textContent = String(score90);
    if (byId('previewBaseSum')) byId('previewBaseSum').textContent = `${baseSum}/40`;
    if (byId('previewVibeMult')) byId('previewVibeMult').textContent = `×${vibeMult.toFixed(2)}`;
    if (byId('previewQualityPct')) byId('previewQualityPct').textContent = `${fmtNum(qualityPct)}%`;
    if (byId('baseSumBadge')) byId('baseSumBadge').textContent = `База: ${baseSum} / 40 · Качество: ${fmtNum(qualityPct)}%`;

    // 3. Cinema value: (Rarity + Integrity + Depth) * Quality * Impact
    const rGenre = num('rarityGenre'), rFormat = num('rarityFormat');
    const rarity = rGenre + rFormat;
    if (byId('rarityGenreVal')) byId('rarityGenreVal').textContent = rGenre.toFixed(1);
    if (byId('rarityFormatVal')) byId('rarityFormatVal').textContent = rFormat.toFixed(1);
    if (byId('rarityScoreDisplay')) byId('rarityScoreDisplay').textContent = `${fmtNum(rarity)} / 5`;

    const iFormat = num('integFormat'), iGenre = num('integGenre'), iMeaning = num('integMeaning');
    const integrity = Math.min(5, iFormat + iGenre + iMeaning);
    if (byId('integFormatVal')) byId('integFormatVal').textContent = iFormat.toFixed(1);
    if (byId('integGenreVal')) byId('integGenreVal').textContent = iGenre.toFixed(1);
    if (byId('integMeaningVal')) byId('integMeaningVal').textContent = iMeaning.toFixed(1);
    if (byId('integrityScoreDisplay')) byId('integrityScoreDisplay').textContent = `${fmtNum(integrity)} / 5`;

    const depth = num('depth');
    if (byId('depthScoreDisplay')) byId('depthScoreDisplay').textContent = `${depth} / 5`;
    if (byId('depthDesc')) byId('depthDesc').textContent = depthDescriptions[depth] || '';

    const impScale = num('impactScale'), impHype = num('impactHype');
    const impSum = (impScale + impHype).toFixed(1);
    const impactMult = impactMultiplierTable[impSum] || 1.62;
    if (byId('impactScaleVal')) byId('impactScaleVal').textContent = impScale.toFixed(1);
    if (byId('impactHypeVal')) byId('impactHypeVal').textContent = impHype.toFixed(1);
    if (byId('impactScoreDisplay')) byId('impactScoreDisplay').textContent = `×${impactMult.toFixed(2)}`;

    const rawValue = (rarity + integrity + depth) * qualityFactor * impactMult;
    const valueFixed = rawValue.toFixed(2);
    if (byId('valueScore')) byId('valueScore').textContent = valueFixed;
    if (byId('valueFormulaBadge')) byId('valueFormulaBadge').textContent = `Ценность: ${valueFixed} / 30`;

    // Chip summaries
    if (byId('chipRarity')) byId('chipRarity').textContent = `${fmtNum(rarity)}/5`;
    if (byId('chipIntegrity')) byId('chipIntegrity').textContent = `${fmtNum(integrity)}/5`;
    if (byId('chipDepth')) byId('chipDepth').textContent = `${depth}/5`;
    if (byId('chipQuality')) byId('chipQuality').textContent = `${fmtNum(qualityPct)}%`;
    if (byId('chipImpact')) byId('chipImpact').textContent = `×${impactMult.toFixed(2)}`;

    // Tier calculation & badge
    const kindVal = byId('kind') ? byId('kind').value.toUpperCase() : 'ФИЛЬМ';
    const tier = getValueTier(rawValue, kindVal);
    document.documentElement.style.setProperty('--tier-color', tier.color);
    document.documentElement.style.setProperty('--tier-bg', tier.bg);

    if (byId('tierPill')) byId('tierPill').textContent = tier.name;
    if (byId('previewTierShort')) byId('previewTierShort').textContent = tier.short;
    if (byId('previewTierRange')) byId('previewTierRange').textContent = tier.range;

    const title = byId('title') ? (byId('title').value.trim() || 'Название произведения') : 'Название произведения';
    if (byId('previewTitle')) byId('previewTitle').textContent = title;
    if (byId('previewDirector')) byId('previewDirector').textContent = byId('director')?.value.trim() || 'Режиссёр / создатель';
    if (byId('previewYear')) byId('previewYear').textContent = byId('year')?.value.trim() || 'Год';
    if (byId('previewGenre')) byId('previewGenre').textContent = displayGenre(byId('genre')?.value.trim()) || 'Жанр';
    if (byId('previewKind')) byId('previewKind').textContent = kindVal;
  }

  // Bind input listeners
  [
    'title', 'director', 'year', 'genre', 'kind', 'vibe',
    'rarityGenre', 'rarityFormat', 'integFormat', 'integGenre', 'integMeaning', 'depth', 'impactScale', 'impactHype',
    ...criteriaData.map(c => c.id)
  ].forEach(id => {
    const el = byId(id);
    if (el) el.addEventListener('input', update);
  });

  // Poster image file upload
  let imageUrl = null;
  const posterFileInp = byId('posterFile');
  if (posterFileInp) {
    posterFileInp.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl = URL.createObjectURL(file);
      const img = byId('posterImg');
      if (img) {
        img.removeAttribute('crossorigin');
        img.dataset.imageType = 'custom';
        img.src = imageUrl;
        img.style.display = 'block';
        if (byId('posterPlaceholder')) byId('posterPlaceholder').style.display = 'none';
        setArtworkColors(img);
      }
    });
  }

  const posterImg = byId('posterImg');
  if (posterImg) {
    posterImg.addEventListener('error', () => {
      posterImg.style.display = 'none';
      if (byId('posterPlaceholder')) byId('posterPlaceholder').style.display = 'block';
    });
    posterImg.addEventListener('load', () => {
      if (posterImg.naturalWidth > 0) {
        posterImg.style.display = 'block';
        if (byId('posterPlaceholder')) byId('posterPlaceholder').style.display = 'none';
        setArtworkColors(posterImg);
      }
    });
  }

  // Metadata edit locks
  let metadataMode = 'unset';
  const metadataFieldIds = ['title', 'director', 'year', 'genre', 'kind', 'posterFile'];
  function setMetadataMode(mode) {
    metadataMode = mode;
    const locked = mode === 'tmdb' || mode === 'kinopoisk';
    metadataFieldIds.forEach(id => {
      const el = byId(id);
      if (el) {
        el.disabled = locked;
        el.title = locked ? 'Данные загружены из базы и защищены от редактирования.' : '';
      }
    });
    if (byId('metadataFields')) byId('metadataFields').hidden = locked;
    if (byId('manualEntryBtn')) {
      byId('manualEntryBtn').hidden = locked;
      byId('manualEntryBtn').textContent = 'Ручной ввод';
    }
  }

  // ==========================================
  // TMDB & KINOPOISK SEARCH INSIDE RATING
  // ==========================================
  let tmdbSearchResults = [];
  let tmdbSearchDebounce = null;

  async function searchTmdb(queryOverride) {
    const query = (queryOverride === undefined ? byId('tmdbQuery')?.value : queryOverride)?.trim().replace(/\s+/g, ' ') || '';
    if (query.length < 2) {
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = query.length ? 'Введи хотя бы два символа.' : 'Введи название фильма или сериала.';
      if (byId('tmdbResults')) byId('tmdbResults').replaceChildren();
      tmdbSearchResults = [];
      return;
    }

    if (!window.getTmdbKey() && !window.getKpKey()) {
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Источники отключены. Нажмите «Перейти к ручному вводу», чтобы оценить фильм без API.';
      if (byId('tmdbResults')) byId('tmdbResults').replaceChildren();
      tmdbSearchResults = [];
      return;
    }

    const searchBtn = byId('tmdbSearchBtn');
    if (searchBtn) { searchBtn.disabled = true; searchBtn.textContent = 'Ищу…'; }
    if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Ищем в единой базе TMDB и Кинопоиска…';

    try {
      const { results } = await (typeof window.searchUnifiedMedia === 'function' ? window.searchUnifiedMedia(query, 'multi') : { results: [] });
      tmdbSearchResults = results.slice(0, 15);
      renderTmdbResults(tmdbSearchResults);
    } catch (err) {
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Ошибка поиска: ' + err.message;
    } finally {
      if (searchBtn) { searchBtn.disabled = false; searchBtn.textContent = 'Поиск'; }
    }
  }

  function renderTmdbResults(items) {
    const container = byId('tmdbResults');
    if (!container) return;
    container.replaceChildren();

    if (!items.length) {
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Совпадений не найдено. Попробуйте оригинальное название или ручной ввод.';
      return;
    }

    if (byId('tmdbStatus')) byId('tmdbStatus').textContent = `Найдено вариантов: ${items.length}. Выберите произведение:`;

    const frag = document.createDocumentFragment();
    items.forEach((item, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tmdb-result';

      const posterPath = item.posterUrlPreview || item.posterUrl || (item.poster_path ? posterUrl(item.poster_path, 'w185') : '');
      const poster = posterPath ? document.createElement('img') : document.createElement('div');
      if (posterPath) {
        poster.src = posterPath;
        poster.alt = '';
        poster.loading = 'lazy';
        poster.onerror = () => {
          poster.replaceWith(Object.assign(document.createElement('div'), { className: 'tmdb-no-poster', textContent: '✳' }));
        };
      } else {
        poster.className = 'tmdb-no-poster';
        poster.textContent = '✳';
      }

      const copy = document.createElement('span');
      copy.className = 'tmdb-result-copy';

      const name = document.createElement('strong');
      name.textContent = item.title || item.name || item.nameRu || item.nameEn || 'Без названия';

      const source = item.source === 'kinopoisk' ? 'Кинопоиск' : 'TMDB';
      const year = releaseYear(item);
      const isTv = item.media_type === 'tv' || item.type === 'TV_SERIES';
      const meta = document.createElement('span');
      meta.textContent = `${isTv ? 'Сериал' : 'Фильм'}${year ? ' · ' + year : ''} · ${source}${Number(item.ratingTmdb) > 0 ? ' · TMDB ' + Number(item.ratingTmdb).toFixed(1) : ''}${Number(item.ratingKinopoisk) > 0 ? ' · КП ' + Number(item.ratingKinopoisk).toFixed(1) : ''}`;

      copy.append(name, meta);
      btn.append(poster, copy);
      btn.addEventListener('click', () => selectTmdbResult(index));
      frag.appendChild(btn);
    });
    container.appendChild(frag);
  }

  async function selectTmdbResult(index) {
    const item = tmdbSearchResults[index];
    if (!item) return;

    if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Загружаем данные произведения…';
    const buttons = [...(byId('tmdbResults')?.querySelectorAll('button') || [])];
    buttons.forEach(b => { b.disabled = true; });

    try {
      let title = '', date = '', genres = [], director = '', poster = '', isTv = false, votes = 0, rating = 0;
      if (item.source === 'tmdb') {
        const type = item.media_type === 'tv' ? 'tv' : 'movie';
        const details = await tmdbFetch('/' + type + '/' + encodeURIComponent(item.id) + '?language=ru-RU');
        title = details.title || details.name || details.original_title || details.original_name || item.title || '';
        date = String((details.release_date || details.first_air_date || item.year || '').slice(0, 4));
        genres = (details.genres || []).map(g => g.name).filter(Boolean);
        poster = details.poster_path ? posterUrl(details.poster_path, 'w780') : (item.posterUrl || '');
        isTv = type === 'tv';
        rating = Number(details.vote_average || item.ratingTmdb || 0);
        votes = Number(details.vote_count || 0);

        if (type === 'movie') {
          try {
            const credits = await tmdbFetch('/movie/' + encodeURIComponent(item.id) + '/credits?language=ru-RU');
            director = (credits.crew || []).filter(x => x.job === 'Director').map(x => x.name).filter(Boolean).join(', ');
          } catch (_) {}
        } else {
          try {
            const credits = await tmdbFetch('/tv/' + encodeURIComponent(item.id) + '/aggregate_credits?language=ru-RU');
            director = (credits.crew || []).filter(x => (x.jobs || []).some(j => j.job === 'Director' || j.job === 'Creator') || x.department === 'Directing' || x.department === 'Writing').map(x => x.name).filter(Boolean).slice(0, 4).join(', ');
          } catch (_) {}
        }
      } else {
        const id = item.id || item.filmId || item.kinopoiskId;
        const details = await kpFetch('/v2.2/films/' + encodeURIComponent(id));
        try {
          const staff = await kpFetch('/v1/staff?filmId=' + encodeURIComponent(id));
          director = (staff || []).filter(p => p.professionKey === 'DIRECTOR' || p.professionText === 'Режиссеры' || p.professionText === 'Режиссёр').map(p => p.nameRu || p.nameEn).filter(Boolean).join(', ');
        } catch (_) {}
        title = details.nameRu || details.nameOriginal || details.nameEn || item.nameRu || '';
        date = details.year ? String(details.year) : '';
        genres = (details.genres || item.genres || []).map(g => typeof g === 'string' ? g : (g.genre || g.name || '')).filter(Boolean);
        isTv = ['TV_SERIES', 'MINI_SERIES', 'TV_SHOW'].includes(details.type || item.type);
        votes = Number(details.ratingKinopoiskVoteCount || 0);
        rating = Number(details.ratingKinopoisk || 0);
        poster = details.posterUrl || item.posterUrl || details.posterUrlPreview || '';
      }

      loadRatingItem({
        id: item.id,
        source: item.source,
        kind: isTv ? 'tv' : 'movie',
        title,
        director,
        year: date,
        genre: genres.join(', '),
        posterUrl: poster,
        voteCount: votes,
        rating
      });

      if (byId('tmdbResults')) byId('tmdbResults').replaceChildren();
    } catch (err) {
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = `Не удалось загрузить данные: ${err.message}`;
    } finally {
      buttons.forEach(b => { b.disabled = false; });
    }
  }

  const tmdbSearchBtn = byId('tmdbSearchBtn');
  if (tmdbSearchBtn) {
    tmdbSearchBtn.addEventListener('click', () => {
      clearTimeout(tmdbSearchDebounce);
      searchTmdb();
    });
  }

  const tmdbQueryInp = byId('tmdbQuery');
  if (tmdbQueryInp) {
    tmdbQueryInp.addEventListener('input', () => {
      clearTimeout(tmdbSearchDebounce);
      tmdbSearchDebounce = setTimeout(() => searchTmdb(), 400);
    });
    tmdbQueryInp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(tmdbSearchDebounce);
        searchTmdb();
      }
    });
  }

  // Manual entry toggle
  const manualEntryBtn = byId('manualEntryBtn');
  if (manualEntryBtn) {
    manualEntryBtn.addEventListener('click', () => {
      setMetadataMode('manual');
      if (byId('editorDetails')) byId('editorDetails').hidden = false;
      if (byId('resultCard')) byId('resultCard').hidden = false;
      document.querySelector('#page-rating .layout')?.classList.add('has-preview');
      if (byId('tmdbResults')) byId('tmdbResults').replaceChildren();
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Ручной ввод: заполните данные произведения и выставьте оценки.';
      byId('title')?.focus();
      update();
    });
  }

  // ==========================================
  // REVIEWER MODAL & STORAGE
  // ==========================================
  let reviewerName = '';
  try { reviewerName = localStorage.getItem('cinevaReviewerName') || ''; } catch (_) {}
  window.reviewerName = reviewerName;

  const reviewerOverlay = byId('reviewerOverlay');
  function saveReviewerName() {
    const value = byId('reviewerNameInput')?.value.trim();
    if (!value) { byId('reviewerNameInput')?.focus(); return; }
    reviewerName = value;
    window.reviewerName = reviewerName;
    if (byId('reviewerHeaderName')) byId('reviewerHeaderName').textContent = reviewerName;
    try { localStorage.setItem('cinevaReviewerName', reviewerName); } catch (_) {}
    if (reviewerOverlay) reviewerOverlay.hidden = true;
  }

  byId('reviewerSave')?.addEventListener('click', saveReviewerName);
  byId('reviewerNameInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') saveReviewerName(); });
  byId('reviewerEdit')?.addEventListener('click', () => {
    if (byId('reviewerNameInput')) byId('reviewerNameInput').value = reviewerName;
    if (reviewerOverlay) reviewerOverlay.hidden = false;
    byId('reviewerNameInput')?.focus();
  });
  if (byId('reviewerHeaderName')) byId('reviewerHeaderName').textContent = reviewerName || 'не задан';

  // ==========================================
  // RESET RATING FORM
  // ==========================================
  const resetBtn = byId('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      ['title', 'director', 'year', 'genre'].forEach(id => { if (byId(id)) byId(id).value = ''; });
      if (byId('tmdbQuery')) byId('tmdbQuery').value = '';
      if (byId('tmdbResults')) byId('tmdbResults').replaceChildren();
      if (byId('editorDetails')) byId('editorDetails').hidden = true;
      setMetadataMode('unset');
      if (byId('resultCard')) byId('resultCard').hidden = true;
      document.querySelector('#page-rating .layout')?.classList.remove('has-preview');
      if (byId('tmdbStatus')) byId('tmdbStatus').textContent = 'Введи название фильма или сериала.';
      if (byId('kind')) byId('kind').selectedIndex = 0;

      criteriaData.forEach(c => { if (byId(c.id)) byId(c.id).value = 5; });
      if (byId('vibe')) byId('vibe').value = 5;
      if (byId('rarityGenre')) byId('rarityGenre').value = '1.0';
      if (byId('rarityFormat')) byId('rarityFormat').value = '1.0';
      if (byId('integFormat')) byId('integFormat').value = '1.0';
      if (byId('integGenre')) byId('integGenre').value = '1.5';
      if (byId('integMeaning')) byId('integMeaning').value = '1.0';
      if (byId('depth')) byId('depth').value = 3;
      if (byId('impactScale')) byId('impactScale').value = '2.0';
      if (byId('impactHype')) byId('impactHype').value = '2.0';
      if (byId('posterFile')) byId('posterFile').value = '';

      if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = null; }
      if (posterImg) {
        posterImg.removeAttribute('src');
        posterImg.style.display = 'none';
      }
      if (byId('posterPlaceholder')) byId('posterPlaceholder').style.display = 'block';

      document.documentElement.style.setProperty('--art-a', '#273a48');
      document.documentElement.style.setProperty('--art-b', '#171923');
      document.documentElement.style.setProperty('--art-accent', '#c5ff65');
      update();
    });
  }

  // ==========================================
  // EXTERNAL LOAD ITEM TRANSITION HANDLER
  // ==========================================
  function loadRatingItem(item) {
    if (!item || !byId('title')) return;

    byId('title').value = item.title || '';
    byId('director').value = item.director || '';
    byId('year').value = item.year || '';
    byId('genre').value = item.genre || '';

    const isTv = item.kind === 'tv' || String(item.title).toLowerCase().includes('сериал');
    const animated = String(item.genre).toLowerCase().includes('анима') || String(item.genre).toLowerCase().includes('animation');
    if (byId('kind')) {
      byId('kind').value = isTv ? (animated ? 'Анимационный сериал' : 'Сериал') : (animated ? 'Мультфильм' : 'Фильм');
    }
    if (byId('integFormat')) byId('integFormat').value = '1.0';

    const voteCount = Number(item.voteCount) || 0;
    const vote = Number(item.rating) || 0;
    if (voteCount > 100000) { byId('impactScale').value = '2.5'; byId('impactHype').value = '2.5'; }
    else if (voteCount > 30000) { byId('impactScale').value = '2.0'; byId('impactHype').value = '2.0'; }
    else if (voteCount > 8000 || vote >= 8) { byId('impactScale').value = '1.5'; byId('impactHype').value = '1.5'; }
    else if (voteCount > 1000) { byId('impactScale').value = '1.0'; byId('impactHype').value = '1.0'; }
    else { byId('impactScale').value = '0.5'; byId('impactHype').value = '0.5'; }

    const poster = item.posterUrl || item.poster || '';
    if (poster && byId('posterImg')) {
      if (imageUrl) { URL.revokeObjectURL(imageUrl); imageUrl = null; }
      byId('posterImg').dataset.imageType = 'poster';
      byId('posterImg').removeAttribute('crossorigin');
      byId('posterImg').src = poster;
      byId('posterImg').style.display = 'block';
      if (byId('posterPlaceholder')) byId('posterPlaceholder').style.display = 'none';
      setArtworkColors(byId('posterImg'));
    }

    if (byId('editorDetails')) byId('editorDetails').hidden = false;
    if (byId('resultCard')) byId('resultCard').hidden = false;
    document.querySelector('#page-rating .layout')?.classList.add('has-preview');
    setMetadataMode(item.source === 'kinopoisk' ? 'kinopoisk' : 'tmdb');

    if (byId('tmdbQuery')) byId('tmdbQuery').value = item.title;
    if (byId('tmdbStatus')) byId('tmdbStatus').textContent = `Загружено: ${item.title} (${item.year || 'год не указан'}). Выставьте оценки.`;

    update();
    showToast(`⭐ Карточка «${item.title}» загружена в калькулятор!`, 'success');
  }

  // ==========================================
  // SHARED RATING DEEP LINK GENERATOR
  // ==========================================
  function shareRatingProject() {
    try {
      const title = byId('title')?.value.trim();
      if (!title) {
        showToast('Сначала заполните название фильма!', 'error');
        return;
      }
      const payload = {
        t: title,
        d: byId('director')?.value.trim() || '',
        y: byId('year')?.value.trim() || '',
        g: byId('genre')?.value.trim() || '',
        k: byId('kind')?.value || 'Фильм',
        p: byId('posterImg')?.getAttribute('src') || '',
        rev: reviewerName || '',
        s: {
          story: num('story'),
          structure: num('structure'),
          craft: num('craft'),
          characters: num('characters'),
          vibe: num('vibe'),
          rg: byId('rarityGenre')?.value,
          rf: byId('rarityFormat')?.value,
          if: byId('integFormat')?.value,
          ig: byId('integGenre')?.value,
          im: byId('integMeaning')?.value,
          dp: num('depth'),
          is: byId('impactScale')?.value,
          ih: byId('impactHype')?.value
        }
      };

      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
      const shareUrl = `${window.location.origin}${window.location.pathname}#rate=${encodeURIComponent(b64)}`;

      if (navigator.clipboard) {
        navigator.clipboard.writeText(shareUrl).then(() => {
          showToast('🔗 Ссылка на оценку скопирована в буфер обмена!', 'success');
        }).catch(() => prompt('Скопируйте ссылку на оценку:', shareUrl));
      } else {
        prompt('Скопируйте ссылку на оценку:', shareUrl);
      }
    } catch (e) {
      showToast('Ошибка при формировании ссылки: ' + e.message, 'error');
    }
  }

  function checkSharedRatingFromUrl() {
    try {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      let rateParam = null;
      if (hash.includes('rate=')) rateParam = hash.split('rate=')[1].split('&')[0];
      else if (search.includes('rate=')) rateParam = new URLSearchParams(search).get('rate');

      if (rateParam) {
        const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(rateParam)))));
        if (payload && payload.t) {
          if (byId('title')) byId('title').value = payload.t || '';
          if (byId('director')) byId('director').value = payload.d || '';
          if (byId('year')) byId('year').value = payload.y || '';
          if (byId('genre')) byId('genre').value = payload.g || '';
          if (byId('kind') && payload.k) byId('kind').value = payload.k;

          if (payload.p && byId('posterImg')) {
            byId('posterImg').src = payload.p;
            byId('posterImg').style.display = 'block';
            if (byId('posterPlaceholder')) byId('posterPlaceholder').style.display = 'none';
          }
          if (payload.s) {
            criteriaData.forEach(c => {
              if (payload.s[c.id] && byId(c.id)) byId(c.id).value = payload.s[c.id];
            });
            if (payload.s.vibe && byId('vibe')) byId('vibe').value = payload.s.vibe;
            if (payload.s.rg && byId('rarityGenre')) byId('rarityGenre').value = payload.s.rg;
            if (payload.s.rf && byId('rarityFormat')) byId('rarityFormat').value = payload.s.rf;
            if (payload.s.if && byId('integFormat')) byId('integFormat').value = payload.s.if;
            if (payload.s.ig && byId('integGenre')) byId('integGenre').value = payload.s.ig;
            if (payload.s.im && byId('integMeaning')) byId('integMeaning').value = payload.s.im;
            if (payload.s.dp && byId('depth')) byId('depth').value = payload.s.dp;
            if (payload.s.is && byId('impactScale')) byId('impactScale').value = payload.s.is;
            if (payload.s.ih && byId('impactHype')) byId('impactHype').value = payload.s.ih;
          }
          if (payload.rev) {
            reviewerName = payload.rev;
            window.reviewerName = reviewerName;
            if (byId('reviewerHeaderName')) byId('reviewerHeaderName').textContent = payload.rev;
          }

          if (byId('editorDetails')) byId('editorDetails').hidden = false;
          if (byId('resultCard')) byId('resultCard').hidden = false;
          document.querySelector('#page-rating .layout')?.classList.add('has-preview');
          update();
          showToast(`⭐ Загружена оценка для «${payload.t}»!`, 'success');
        }
      }
    } catch (_) {}
  }

  // ==========================================
  // CANVAS PNG EXPORTER FOR COLLECTOR CARD
  // ==========================================
  function loadImageForExport(img) {
    return new Promise((resolve, reject) => {
      if (!img || !img.getAttribute('src')) { reject(new Error('Обложка не выбрана')); return; }
      const originalSrc = img.currentSrc || img.src;
      const isCustom = img.dataset.imageType === 'custom' || originalSrc.startsWith('blob:') || originalSrc.startsWith('data:');
      const attempts = [];
      if (isCustom) {
        attempts.push({ src: originalSrc, crossOrigin: false });
      } else {
        attempts.push({ src: originalSrc, crossOrigin: true });
        try {
          const u = new URL(originalSrc);
          if (u.protocol === 'https:' || u.protocol === 'http:') {
            attempts.push({ src: 'https://images.weserv.nl/?url=' + encodeURIComponent(u.host + u.pathname + u.search), crossOrigin: true });
          }
        } catch (_) {}
      }
      let index = 0;
      const tryNext = () => {
        if (index >= attempts.length) {
          reject(new Error('Не удалось загрузить обложку для PNG. Попробуйте загрузить файл постера вручную.'));
          return;
        }
        const attempt = attempts[index++];
        const copy = new Image();
        if (attempt.crossOrigin) copy.crossOrigin = 'anonymous';
        copy.onload = () => resolve(copy);
        copy.onerror = tryNext;
        copy.src = attempt.src;
      };
      tryNext();
    });
  }

  function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean), lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
        if (lines.length === maxLines - 1) break;
      } else line = next;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
      let last = lines[lines.length - 1];
      while (last && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = last.trim() + '…';
    }
    return lines;
  }

  async function downloadCardPng() {
    const button = byId('saveImage');
    if (button) { button.disabled = true; button.textContent = 'Рендерим PNG…'; }
    try {
      const W = 1200, H = 1240, pad = 52;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--art-accent').trim() || '#c5ff65';
      const artA = css.getPropertyValue('--art-a').trim() || '#273a48';
      const artB = css.getPropertyValue('--art-b').trim() || '#171923';

      const kindUpper = byId('kind') ? byId('kind').value.toUpperCase() : 'ФИЛЬМ';
      const rawVal = parseFloat(byId('valueScore')?.textContent || '0') || 0;
      const tier = getValueTier(rawVal, kindUpper);

      let img = null;
      const posterElement = byId('posterImg');
      if (posterElement && posterElement.getAttribute('src')) {
        try { img = await loadImageForExport(posterElement); } catch (e) {
          throw new Error('Постер отображается, но браузер не смог включить его в PNG. ' + e.message);
        }
      }

      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, artA);
      bg.addColorStop(0.52, artB);
      bg.addColorStop(1, '#070910');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      if (img) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.filter = 'blur(48px) saturate(135%)';
        const br = Math.max(W / img.width, H / img.height);
        ctx.drawImage(img, (W - img.width * br) / 2, (H - img.height * br) / 2, img.width * br, img.height * br);
        ctx.restore();
      }

      const glow = ctx.createRadialGradient(W - 160, 120, 20, W - 160, 120, 520);
      glow.addColorStop(0, tier.bg.replace('.16', '.32').replace('.14', '.28'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = 'rgba(8,10,18,.58)';
      roundedRect(ctx, 24, 24, W - 48, H - 48, 38);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 2;
      roundedRect(ctx, 24, 24, W - 48, H - 48, 38);
      ctx.stroke();

      // Top bar
      const topY = 56;
      ctx.fillStyle = tier.color;
      ctx.beginPath();
      ctx.arc(pad + 10, topY + 18, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '900 19px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#e5eaf7';
      ctx.fillText('CINEVA · CINEMA INDEX', pad + 28, topY + 25);

      ctx.font = '900 18px system-ui, -apple-system, sans-serif';
      const tierText = tier.name;
      const tierW = ctx.measureText(tierText).width + 42;
      const tierX = W - pad - tierW;
      roundedRect(ctx, tierX, topY, tierW, 38, 19);
      ctx.fillStyle = tier.dark;
      ctx.fill();
      ctx.strokeStyle = tier.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = tier.color;
      ctx.fillText(tierText, tierX + 21, topY + 25);

      // Hero block
      const heroY = 116, heroH = 470;
      const posterW = 330, posterH = 470;
      const posterX = pad;

      ctx.save();
      roundedRect(ctx, posterX, heroY, posterW, posterH, 26);
      ctx.clip();
      if (img) {
        const ratio = Math.max(posterW / img.width, posterH / img.height);
        const iw = img.width * ratio, ih = img.height * ratio;
        ctx.drawImage(img, posterX + (posterW - iw) / 2, heroY + (posterH - ih) * 0.35, iw, ih);
      } else {
        const ph = ctx.createLinearGradient(posterX, heroY, posterX + posterW, heroY + posterH);
        ph.addColorStop(0, artA);
        ph.addColorStop(1, artB);
        ctx.fillStyle = ph;
        ctx.fillRect(posterX, heroY, posterW, posterH);
        ctx.fillStyle = '#ffffff';
        ctx.font = '900 54px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('КИНО', posterX + posterW / 2, heroY + posterH / 2 + 10);
        ctx.textAlign = 'left';
      }
      const pShade = ctx.createLinearGradient(0, heroY + posterH * 0.55, 0, heroY + posterH);
      pShade.addColorStop(0, 'rgba(0,0,0,0)');
      pShade.addColorStop(1, 'rgba(5,7,12,.82)');
      ctx.fillStyle = pShade;
      ctx.fillRect(posterX, heroY, posterW, posterH);
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 2;
      roundedRect(ctx, posterX, heroY, posterW, posterH, 26);
      ctx.stroke();

      const infoX = posterX + posterW + 34;
      const infoW = W - pad - infoX;
      const title = byId('title')?.value.trim() || 'Название произведения';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 50px system-ui, -apple-system, sans-serif';
      const titleLines = wrapCanvasText(ctx, title, infoW, 2);
      titleLines.forEach((line, i) => ctx.fillText(line, infoX, heroY + 52 + i * 56));

      const metaY = heroY + 52 + (titleLines.length - 1) * 56 + 40;
      const directorText = byId('director')?.value.trim() || 'Режиссёр / создатель';
      ctx.font = '600 22px system-ui, sans-serif';
      ctx.fillStyle = '#c9d2e6';
      const directorLines = wrapCanvasText(ctx, directorText, infoW, 2);
      directorLines.forEach((line, i) => ctx.fillText(line, infoX, metaY + i * 30));

      const detailParts = [byId('year')?.value.trim() || 'Год', displayGenre(byId('genre')?.value.trim()) || 'Жанр'].filter(Boolean);
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillStyle = '#aebbd3';
      const detailLines = wrapCanvasText(ctx, detailParts.join('  ·  '), infoW, 2);
      detailLines.forEach((line, i) => ctx.fillText(line, infoX, metaY + directorLines.length * 30 + 28 + i * 28));

      // Dual Score boxes
      const boxesY = heroY + 220, boxesH = 250, boxGap = 18;
      const box1W = Math.floor((infoW - boxGap) * 0.46);
      const box2W = infoW - boxGap - box1W;

      // Box 1: Rating 90
      roundedRect(ctx, infoX, boxesY, box1W, boxesH, 24);
      ctx.fillStyle = 'rgba(12,16,28,.82)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillStyle = '#a8b2c8';
      ctx.fillText('РЕЙТИНГ', infoX + 24, boxesY + 38);

      const score90 = byId('score')?.textContent || '50';
      ctx.font = '950 92px system-ui, sans-serif';
      ctx.fillStyle = accent;
      ctx.fillText(score90, infoX + 22, boxesY + 148);
      const s90W = ctx.measureText(score90).width;
      ctx.font = '800 28px system-ui, sans-serif';
      ctx.fillStyle = '#8f99b0';
      ctx.fillText('/ 90', infoX + 28 + s90W, boxesY + 144);

      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = '#b8c2d8';
      ctx.fillText(`База ${byId('previewBaseSum')?.textContent || '20/40'}`, infoX + 24, boxesY + 212);

      // Box 2: Cinema Value
      const box2X = infoX + box1W + boxGap;
      roundedRect(ctx, box2X, boxesY, box2W, boxesH, 24);
      const vGrad = ctx.createLinearGradient(box2X, boxesY, box2X + box2W, boxesY + boxesH);
      vGrad.addColorStop(0, tier.dark);
      vGrad.addColorStop(1, 'rgba(12,16,28,.88)');
      ctx.fillStyle = vGrad;
      ctx.fill();
      ctx.strokeStyle = tier.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.font = '800 17px system-ui, sans-serif';
      ctx.fillStyle = tier.color;
      ctx.fillText('ЦЕННОСТЬ КИНО', box2X + 24, boxesY + 38);

      ctx.textAlign = 'right';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillStyle = '#dfe6f6';
      ctx.fillText(tier.short.toUpperCase(), box2X + box2W - 24, boxesY + 38);
      ctx.textAlign = 'left';

      const valText = byId('valueScore')?.textContent || '15.00';
      ctx.font = '950 88px system-ui, sans-serif';
      ctx.fillStyle = tier.color;
      ctx.fillText(valText, box2X + 22, boxesY + 148);
      const valW = ctx.measureText(valText).width;
      ctx.font = '800 26px system-ui, sans-serif';
      ctx.fillStyle = '#b5bfd4';
      ctx.fillText('/ 30', box2X + 28 + valW, boxesY + 144);

      ctx.font = '600 18px system-ui, sans-serif';
      ctx.fillStyle = '#dbe2f4';
      ctx.fillText('Индекс произведения', box2X + 24, boxesY + 212);

      // Base Criteria Section
      const sec1Y = heroY + heroH + 48;
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillStyle = '#9aa5bd';
      ctx.fillText('КРИТЕРИИ ОЦЕНКИ', pad, sec1Y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e2e7f5';
      ctx.fillText(`КАЧЕСТВО РЕАЛИЗАЦИИ: ${byId('previewQualityPct')?.textContent || '50%'}`, W - pad, sec1Y);
      ctx.textAlign = 'left';

      const ratings = [
        ['Сценарий / Образы', byId('story')?.value || '5', false],
        ['Структура / Темп', byId('structure')?.value || '5', false],
        ['Режиссура / Стиль', byId('craft')?.value || '5', false],
        ['Актёры / Харизма', byId('characters')?.value || '5', false],
        ['Атмосфера / Вайб', byId('vibe')?.value || '5', true]
      ];
      const gridY = sec1Y + 20, gap = 16, fullW = W - pad * 2, cw = (fullW - gap) / 2, ch = 84;
      ratings.forEach((item, i) => {
        const isFull = item[2];
        const col = isFull ? 0 : i % 2, row = isFull ? 2 : Math.floor(i / 2);
        const bx = pad + col * (cw + gap), by = gridY + row * (ch + 14), bw = isFull ? fullW : cw;
        roundedRect(ctx, bx, by, bw, ch, 18);
        ctx.fillStyle = isFull ? 'rgba(42,26,64,.82)' : 'rgba(14,18,30,.76)';
        ctx.fill();
        ctx.strokeStyle = isFull ? 'rgba(198,145,255,.45)' : 'rgba(255,255,255,.11)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const valNum = Number(item[1]);
        const barW = Math.max(12, ((bw - 44) * (valNum / 10)));
        roundedRect(ctx, bx + 22, by + ch - 14, bw - 44, 5, 3);
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.fill();
        roundedRect(ctx, bx + 22, by + ch - 14, barW, 5, 3);
        ctx.fillStyle = isFull ? '#d5a8ff' : accent;
        ctx.fill();

        ctx.fillStyle = '#e6eaf5';
        ctx.font = '700 22px system-ui, sans-serif';
        ctx.fillText(item[0], bx + 22, by + 44);

        ctx.textAlign = 'right';
        ctx.fillStyle = isFull ? '#d5a8ff' : '#ffffff';
        ctx.font = '950 38px system-ui, sans-serif';
        ctx.fillText(`${item[1]} / 10`, bx + bw - 22, by + 48);
        ctx.textAlign = 'left';
      });

      // Cinema Value Breakdown
      const sec2Y = gridY + 3 * (ch + 14) + 28;
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.fillStyle = '#9aa5bd';
      ctx.fillText('ИНДЕКС ЦЕННОСТИ', pad, sec2Y);
      ctx.textAlign = 'right';
      ctx.fillStyle = tier.color;
      ctx.fillText(`ПОРОГ СТАТУСА: ${tier.range}`, W - pad, sec2Y);
      ctx.textAlign = 'left';

      const vItems = [
        {
          title: 'РЕДКОСТЬ', val: byId('chipRarity')?.textContent || '2.0/5', hi: false,
          details: [`Жанр / поджанр ${byId('rarityGenreVal')?.textContent || '1.0'}`, `Формат ${byId('rarityFormatVal')?.textContent || '1.0'}`]
        },
        {
          title: 'ЦЕЛОСТНОСТЬ', val: byId('chipIntegrity')?.textContent || '3.5/5', hi: false,
          details: [`Формат ${byId('integFormatVal')?.textContent || '1.0'} · Жанр ${byId('integGenreVal')?.textContent || '1.5'}`, `Смысл ${byId('integMeaningVal')?.textContent || '1.0'}`]
        },
        {
          title: 'ГЛУБИНА', val: byId('chipDepth')?.textContent || '3/5', hi: false,
          details: [`Вертикаль смысла · ${byId('depth')?.value || '3'}`]
        },
        {
          title: 'КАЧЕСТВО', val: byId('chipQuality')?.textContent || '50%', hi: false,
          details: [`Сценарий ${byId('story')?.value || '5'} · Ритм ${byId('structure')?.value || '5'}`, `Стиль ${byId('craft')?.value || '5'} · Актёры ${byId('characters')?.value || '5'}`]
        },
        {
          title: 'ВЛИЯНИЕ', val: byId('chipImpact')?.textContent || '×1.62', hi: true,
          details: [`Известность ${byId('impactScaleVal')?.textContent || '2.0'}`, `Ожидание ${byId('impactHypeVal')?.textContent || '2.0'}`]
        }
      ];
      const vY = sec2Y + 20, vGap = 14, vW = (fullW - vGap * 4) / 5, vH = 134;
      vItems.forEach((v, i) => {
        const vx = pad + i * (vW + vGap);
        roundedRect(ctx, vx, vY, vW, vH, 18);
        ctx.fillStyle = v.hi ? tier.dark : 'rgba(14,18,30,.82)';
        ctx.fill();
        ctx.strokeStyle = v.hi ? tier.color : 'rgba(255,255,255,.12)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '800 14px system-ui, sans-serif';
        ctx.fillStyle = v.hi ? tier.color : '#9aa5bd';
        ctx.fillText(v.title, vx + 16, vY + 32);

        ctx.font = '950 36px system-ui, sans-serif';
        ctx.fillStyle = v.hi ? tier.color : '#ffffff';
        ctx.fillText(v.val, vx + 16, vY + 78);

        ctx.font = '650 11px system-ui, sans-serif';
        ctx.fillStyle = v.hi ? '#d8e8bd' : '#9aa5bd';
        (v.details || []).slice(0, 2).forEach((line, j) => {
          ctx.fillText(line, vx + 16, vY + 105 + j * 14, vW - 32);
        });
      });

      // Footer
      const footerY = H - pad;
      ctx.font = '900 19px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#e5eaf7';
      ctx.fillText('FILM REVIEW', pad, footerY);

      ctx.textAlign = 'right';
      ctx.font = '900 19px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#e5eaf7';
      ctx.fillText(`${reviewerName || 'Рецензент'} · ${new Date().toLocaleDateString('ru-RU')}`, W - pad, footerY);
      ctx.textAlign = 'left';

      const safeName = title.replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 60) || 'rzt-cinema';
      const link = document.createElement('a');
      link.download = `${safeName}-cineva.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Коллекционная карточка успешно сохранена в PNG!', 'success');
    } catch (error) {
      alert('Не удалось создать PNG: ' + error.message);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Скачать PNG'; }
    }
  }

  byId('saveImage')?.addEventListener('click', downloadCardPng);
  byId('ratingShareBtn')?.addEventListener('click', shareRatingProject);

  // ==========================================
  // INCOMING TRANSITIONS & STARTUP
  // ==========================================
  // 1. Check incoming sessionStorage item from other pages ("⭐ Оценить в CINEVA ↗")
  try {
    const pendingRate = sessionStorage.getItem('cineva_rate_item');
    if (pendingRate) {
      sessionStorage.removeItem('cineva_rate_item');
      const pItem = JSON.parse(pendingRate);
      if (pItem) loadRatingItem(pItem);
    }
  } catch (_) {}

  // 2. Check URL search param rateId
  try {
    const params = new URLSearchParams(window.location.search);
    const rateId = params.get('rateId');
    const rateType = params.get('type') || 'movie';
    const rateSource = params.get('source') || 'tmdb';
    if (rateId && !sessionStorage.getItem('cineva_rate_item')) {
      if (rateSource === 'kinopoisk') {
        kpFetch('/v2.2/films/' + encodeURIComponent(rateId)).then(d => {
          loadRatingItem({
            id: rateId,
            source: 'kinopoisk',
            kind: rateType,
            title: d.nameRu || d.nameOriginal || d.nameEn || '',
            year: String(d.year || ''),
            genre: (d.genres || []).map(g => typeof g === 'string' ? g : (g.genre || g.name || '')).join(', '),
            posterUrl: d.posterUrl || d.posterUrlPreview || '',
            voteCount: d.ratingKinopoiskVoteCount || 0,
            rating: d.ratingKinopoisk || 0
          });
        }).catch(() => {});
      } else {
        tmdbFetch('/' + rateType + '/' + encodeURIComponent(rateId) + '?language=ru-RU').then(d => {
          loadRatingItem({
            id: rateId,
            source: 'tmdb',
            kind: rateType,
            title: d.title || d.name || d.original_title || d.original_name || '',
            year: releaseYear(d),
            genre: (d.genres || []).map(g => g.name).join(', '),
            posterUrl: d.poster_path ? posterUrl(d.poster_path, 'w780') : '',
            voteCount: d.vote_count || 0,
            rating: d.vote_average || 0
          });
        }).catch(() => {});
      }
    }
  } catch (_) {}

  // 3. Check shared rating link hash (#rate=...)
  checkSharedRatingFromUrl();
  window.addEventListener('hashchange', checkSharedRatingFromUrl);

  // Initial calculation
  update();

  // Expose methods on window
  window.updateRating = update;
  window.loadRatingItem = loadRatingItem;
  window.downloadCardPng = downloadCardPng;
  window.shareRatingProject = shareRatingProject;
})();
