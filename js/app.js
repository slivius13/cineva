/* === CINEVA CORE APPLICATION & ROUTER === */
(() => {

  const byId = id => document.getElementById(id);
  const $ = id => document.getElementById(id);
  window.$ = $;
  window.byId = byId;

  // Bridge functions from rating.js
  const showToast = (...args) => (typeof window.showToast === 'function' ? window.showToast(...args) : null);
  const isApiSetupComplete = (...args) => (typeof window.isApiSetupComplete === 'function' ? window.isApiSetupComplete(...args) : true);
  const getTmdbKey = (...args) => (typeof window.getTmdbKey === 'function' ? window.getTmdbKey(...args) : (args[0] || ''));
  const getKpKey = (...args) => (typeof window.getKpKey === 'function' ? window.getKpKey(...args) : (args[0] || ''));
  const saveApiKeys = (...args) => (typeof window.saveApiKeys === 'function' ? window.saveApiKeys(...args) : null);
  const setArtworkColors = (...args) => (typeof window.setArtworkColors === 'function' ? window.setArtworkColors(...args) : null);
  const setMetadataMode = (...args) => (typeof window.setMetadataMode === 'function' ? window.setMetadataMode(...args) : null);
  const update = (...args) => (typeof window.updateRating === 'function' ? window.updateRating(...args) : null);


  // byId declared above
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const posterUrl = (path, size='w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
  const ratingText = value => value && Number(value)>0 ? Number(value).toFixed(1) : '—';
  const releaseYear = item => String((item.release_date || item.first_air_date || item.releaseDate || item.year || '').slice(0,4));
  
  let activePage = 'home';
  let activeSearchMode = 'multi';
  let liveSearchTimer = null;
  let lastSearchQuery = '';
  let lastSearchItems = [];
  let currentDetail = null;
  let searchCounter = 0;
  let previousPage = 'home';
  const pageIds = {home:'page-home', search:'page-search', detail:'page-detail', rating:'page-rating', watchlist:'page-watchlist', tierlist:'page-tierlist'};

  // In-memory cache for search queries (query + mode -> data)
  const searchCache = new Map();

  // Watchlist storage. Keep a session fallback for browsers that restrict LocalStorage for content:// files.
  let watchlistMemory = null;
  let watchlistMemoryOnly = false;
  function getWatchlist() {
    if (watchlistMemoryOnly && Array.isArray(watchlistMemory)) return watchlistMemory;
    try {
      const parsed = JSON.parse(localStorage.getItem('cineva_watchlist') || '[]');
      watchlistMemory = Array.isArray(parsed) ? parsed : [];
      return watchlistMemory;
    } catch (_) { return Array.isArray(watchlistMemory) ? watchlistMemory : []; }
  }
  function saveWatchlist(list) {
    watchlistMemory = Array.isArray(list) ? list : [];
    let persistent = true;
    try { localStorage.setItem('cineva_watchlist', JSON.stringify(watchlistMemory)); watchlistMemoryOnly = false; }
    catch (_) { persistent = false; watchlistMemoryOnly = true; }
    updateWatchlistCount();
    return persistent;
  }
  function sourceOf(item) { return item.source || 'tmdb'; }
  function isInWatchlist(id, type, source='') {
    return getWatchlist().some(item => String(item.id) === String(id) && (item.media_type || item.type) === type && (!source || sourceOf(item) === source));
  }
  function toggleWatchlist(item, type) {
    let list = getWatchlist();
    const mediaType = item.media_type || type || 'movie';
    const id = String(item.id || item.kinopoiskId || '');
    const source = sourceOf(item);
    if (!id) { showToast('Не удалось определить ID произведения.', 'error'); return; }
    const exists = list.some(x => String(x.id) === id && (x.media_type || x.type) === mediaType && sourceOf(x) === source);
    let notice = '';
    let noticeType = 'success';
    if (exists) {
      list = list.filter(x => !(String(x.id) === id && (x.media_type || x.type) === mediaType && sourceOf(x) === source));
      notice = 'Удалено из избранного';
      noticeType = 'info';
    } else {
      const title = item.title || item.name || item.nameRu || 'Без названия';
      const poster = item.poster || (item.poster_path ? posterUrl(item.poster_path, 'w500') : (item.posterUrl || item.posterUrlPreview || ''));
      list.unshift({
        id, media_type: mediaType, title, year: releaseYear(item), poster,
        poster_path: item.poster_path || '', posterUrl: item.posterUrl || '',
        ratingTmdb: item.ratingTmdb || item.vote_average || 0,
        ratingKinopoisk: item.ratingKinopoisk || 0, source
      });
      notice = `«${title}» добавлено в избранное`;
    }
    const persistent = saveWatchlist(list);
    if (!persistent) { notice += '. В этом браузере список сохранён только до закрытия страницы'; noticeType = 'error'; }
    showToast(notice, noticeType);
    updateWatchlistUI();
    document.querySelectorAll(`[data-watchlist-toggle="${id}"]`).forEach(btn => {
      const active = isInWatchlist(id, mediaType, source);
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
      btn.title = active ? 'В избранном' : 'В избранное';
    });
  }
  function updateWatchlistCount() {
    const list = getWatchlist();
    const badge = byId('watchlistCount');
    if (badge) badge.textContent = String(list.length);
  }
  function updateWatchlistUI() {
    updateWatchlistCount();
    const grid = byId('watchlistGrid');
    const status = byId('watchlistStatus');
    const clearBtn = byId('watchlistClearBtn');
    if (!grid || !status) return;
    const list = getWatchlist();
    if (!list.length) {
      status.textContent = 'Список избранного пуст.';
      grid.innerHTML = '<div class="notice-card" style="grid-column:1/-1"><strong>Пока ничего не сохранено</strong>Открой карточку фильма и нажми «В избранное», чтобы сохранить кино на потом.</div>';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }
    status.textContent = `Сохранено произведений: ${list.length}`;
    if (clearBtn) clearBtn.style.display = 'inline-block';
    grid.innerHTML = list.map(item => {
      const type = item.media_type || item.type || 'movie';
      const source = sourceOf(item);
      return `<div class="watchlist-entry">${posterCard(item, type)}<button class="watchlist-remove" type="button" data-watchlist-remove="${safe(item.id)}" data-watchlist-type="${safe(type)}" data-watchlist-source="${safe(source)}">Убрать из избранного</button></div>`;
    }).join('');
  }

  // Common Cinema Dictionary for Google-like "Возможно, вы имели в виду"
  const CINEMA_DICTIONARY = [
    {term: 'интерстеллар', match: ['интерстелар', 'интерстеляр', 'интерстелр', 'интерстелер', 'interstellar']},
    {term: 'оппенгеймер', match: ['опенгеймер', 'опенхаймер', 'оппенхаймер', 'oppenheimer']},
    {term: 'побег из шоушенка', match: ['побег из шаушенка', 'шоушенк', 'шаушенк']},
    {term: 'криминальное чтиво', match: ['криминалное чтиво', 'чтиво', 'pulp fiction']},
    {term: 'бойцовский клуб', match: ['бойцовски клуб', 'бойцовскии клуб', 'боицовский клуб', 'fight club']},
    {term: 'властелин колец', match: ['властилин колец', 'властилин', 'lord of the rings']},
    {term: 'темный рыцарь', match: ['тёмный рыцарь', 'темныи рыцарь', 'dark knight']},
    {term: 'игра престолов', match: ['игр престолов', 'игра престол', 'game of thrones']},
    {term: 'во все тяжкие', match: ['во все тяшкие', 'тяжкие', 'breaking bad']},
    {term: 'джентльмены', match: ['джентельмены', 'джентельмен', 'gentlemen']},
    {term: 'остров проклятых', match: ['остров проклятых', 'остров проклятих', 'shutter island']},
    {term: 'начало', match: ['начяло', 'инсепшн', 'inception']},
    {term: 'матрица', match: ['матритца', 'matrix']},
    {term: 'кристофер нолан', match: ['кристофер нолон', 'нолан', 'nolan', 'christopher nolan']},
    {term: 'квентин тарантино', match: ['квентин торантино', 'тарантино', 'tarantino']},
    {term: 'леонардо ди каприо', match: ['леонардо дикаприо', 'дикаприо', 'декаприо', 'dicaprio']},
    {term: 'стивен спилберг', match: ['спилберг', 'spielberg']},
    {term: 'дэвид финчер', match: ['давид финчер', 'финчер', 'fincher']},
    {term: 'харри поттер', match: ['гарри поттер', 'гари потер', 'гарри потер', 'harry potter']},
    {term: 'человек паук', match: ['человек-паук', 'человек павук', 'спайдермен', 'spiderman']},
    {term: 'мстители', match: ['мститили', 'avengers']},
    {term: 'зеленая миля', match: ['зелёная миля', 'зеленая мила', 'green mile']},
    {term: '1+1', match: ['неприкасаемые', 'intouchables']}
  ];

  function detectGoogleCorrection(query) {
    const raw = String(query || '').trim();
    if (raw.length < 2) return null;
    const flipped = switchKeyboardLayout(raw).trim();
    const isFlipped = flipped && normalizeSearchText(flipped) !== normalizeSearchText(raw);
    
    // 1. Keyboard layout detection (e.g. 'bynthcntkkfh' -> 'интерстеллар')
    if (isFlipped && (/[a-z]/i.test(raw) && !/[а-яё]/i.test(raw))) {
      return { type: 'layout', corrected: flipped, original: raw };
    }
    
    // 2. Dictionary match for known cinema titles & names
    const norm = normalizeSearchText(raw);
    for (const entry of CINEMA_DICTIONARY) {
      if (entry.term === norm) continue;
      if (entry.match.some(m => normalizeSearchText(m) === norm || norm.includes(normalizeSearchText(m)))) {
        return { type: 'spelling', corrected: entry.term, original: raw };
      }
      // Levenshtein distance ≤ 2 on long words
      if (norm.length >= 6 && entry.term.length >= 6 && Math.abs(norm.length - entry.term.length) <= 2) {
        if (titleMatchScore(norm, {nameRu: entry.term}) >= 0.82) {
          return { type: 'typo', corrected: entry.term, original: raw };
        }
      }
    }
    return null;
  }

  function showSettings() {
    const modal = byId('settingsOverlay');
    if (!modal) return;
    byId('settingTmdbKey').value = getTmdbKey();
    byId('settingKpKey').value = getKpKey();
    modal.hidden = false;
  }
  function hideSettings() {
    const modal = byId('settingsOverlay');
    if (modal) modal.hidden = true;
  }

  function setActiveNav(key) {
    document.querySelectorAll('[data-page-link]').forEach(button => {
      const current = button.dataset.pageLink;
      button.classList.toggle('active', current === key || (key === 'detail' && current === 'search'));
    });
  }
  function showPage(key, skipHistory) {
    const id = pageIds[key];
    if (!id) return;
    if (!skipHistory && activePage !== key && key === 'detail') {
      previousPage = activePage;
    }
    document.querySelectorAll('.site-page').forEach(page => page.classList.toggle('active', page.id === id));
    activePage = key;
    if (byId('liveSearchResults')) byId('liveSearchResults').hidden = true;
    setActiveNav(key === 'detail' ? (previousPage || 'home') : key);
    window.scrollTo({top:0, behavior:'smooth'});
    if (key === 'watchlist') updateWatchlistUI();
    if (key === 'tierlist' && typeof window.renderTierBoard === 'function') window.renderTierBoard();
    if (window.location.protocol.startsWith('http')) {
      const pageFile = key === 'home' ? 'index.html' : `${key}.html`;
      if (!window.location.pathname.endsWith(pageFile) && !skipHistory) {
        try { history.pushState(null, '', pageFile); } catch (_) {}
      }
    }
  }

  function goToSearch(mode='multi', query='') {
    activeSearchMode = mode;
    showPage('search');
    byId('searchPageTitle').textContent = 'Результаты поиска';
    byId('pageSearchInput').placeholder = 'Фильм, сериал, актёр или режиссёр';
    
    document.querySelectorAll('.filter-chip[data-search-mode]').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.searchMode === mode);
    });

    const resolvedQuery = query || byId('pageSearchInput').value.trim() || byId('globalSearchInput').value.trim();
    if (resolvedQuery) {
      byId('globalSearchInput').value = resolvedQuery;
      byId('pageSearchInput').value = resolvedQuery;
      runGlobalSearch(resolvedQuery, mode);
    } else {
      byId('searchResults').innerHTML = '';
      byId('searchStatus').textContent = 'Введи название в строку поиска.';
      byId('searchSuggestionBanner').hidden = true;
    }
  }

  function renderSkeletons(targetId, count=6) {
    const el = byId(targetId);
    if (!el) return;
    el.innerHTML = Array.from({length:count}, () => `
      <div class="skeleton-card" aria-hidden="true">
        <div class="poster-wrap"></div>
        <div class="skel-title"></div>
        <div class="skel-meta"></div>
      </div>
    `).join('');
  }

  function posterCard(item, fallbackType) {
    const type = item.media_type || fallbackType || 'movie';
    const person = type === 'person';
    const isKp = item.source === 'kinopoisk';
    const path = person ? item.profile_path : item.poster_path;
    const url = item.poster || (isKp ? (item.posterUrlPreview || item.posterUrl || '') : (item.posterUrl || posterUrl(path, person ? 'w342' : 'w500')));
    const title = item.title || item.name || item.nameRu || item.original_title || item.original_name || item.nameEn || 'Без названия';
    const year = releaseYear(item);
    const scores = [];
    if (!person && Number(item.ratingTmdb || item.vote_average) > 0) scores.push('TMDB ' + ratingText(item.ratingTmdb || item.vote_average));
    if (!person && Number(item.ratingKinopoisk) > 0) scores.push('КП ' + ratingText(item.ratingKinopoisk));
    const metric = scores.length ? `<span class="media-rating">${safe(scores.join(' · '))}</span>` : '';
    const alt = person ? 'Профиль' : 'Постер';
    const attrs = isKp ? `data-open-source="kinopoisk" data-kp-id="${safe(item.kinopoiskId || item.id || '')}"` : '';
    const metaText = person ? (item.known_for_department || 'Кино') : `${year || 'Год неизвестен'}${type==='tv' ? ' · Сериал' : type==='movie' ? ' · Фильм' : ''}${isKp ? ' · Кинопоиск' : ''}`;
    const id = String(item.id || item.kinopoiskId || '');

    return `<article class="media-card" role="button" tabindex="0" ${attrs} data-open-type="${safe(type)}" data-open-id="${safe(id)}" aria-label="Открыть ${safe(title)}"><span class="poster-wrap">${url ? `<img src="${safe(url)}" loading="lazy" alt="${alt}: ${safe(title)}">` : `<span class="no-poster">CINEVA<br>${person?'PERSON':'CINEMA'}</span>`}${metric}</span><span class="media-title">${safe(title)}</span><span class="media-meta">${safe(metaText)}</span></article>`;
  }

  function normalizeKpGlobal(item) {
    const kpId = item.filmId || item.kinopoiskId || item.film_id || item.id;
    const isTv = ['TV_SERIES','MINI_SERIES','TV_MINI_SERIES','TV_SHOW'].includes(item.type);
    return {
      source:'kinopoisk', id:String(kpId || ''), kinopoiskId:String(kpId || ''),
      media_type:isTv ? 'tv' : 'movie',
      title:item.nameRu || item.name || item.nameEn || item.nameOriginal || 'Без названия',
      name:item.nameRu || item.name || item.nameEn || item.nameOriginal || 'Без названия',
      original_title:item.nameOriginal || item.nameEn || '',
      release_date:String(item.year || ''), year:String(item.year || ''),
      posterUrl:item.posterUrl || '', posterUrlPreview:item.posterUrlPreview || '',
      ratingKinopoisk:Number(item.ratingKinopoisk || item.rating || 0),
      vote_average:0, vote_count:Number(item.ratingKinopoiskVoteCount || item.ratingVoteCount || 0)
    };
  }

  function personCard(person, job='') {
    const img = posterUrl(person.profile_path, 'w185');
    const name = person.name || 'Без имени';
    return `<button type="button" class="person-card" data-open-type="person" data-open-id="${safe(person.id)}"><span>${img ? `<img src="${safe(img)}" loading="lazy" alt="${safe(name)}">` : `<span class="person-photo-empty">CINEVA</span>`}</span><strong>${safe(name)}</strong><span>${safe(job || person.known_for_department || 'Кино')}</span></button>`;
  }

  function setShelf(id, items, type) {
    const target = byId(id);
    if (!target) return;
    if (!items || !items.length) {
      target.innerHTML = `<div class="notice-card" style="grid-column:1/-1"><strong>Пока нет данных</strong>Не получилось загрузить подборку. Попробуй поиск.</div>`;
      return;
    }
    target.innerHTML = items.slice(0,6).map(item => posterCard({...item, media_type:item.media_type || type}, type)).join('');
  }

  async function loadHomeShelves(force=false) {
    const markers = ['homeMovies','homeTv','homePeople'];
    if (!force && markers.every(id => byId(id)?.dataset.loaded === 'true')) return;
    if (!getTmdbKey() && !getKpKey()) {
      markers.forEach(id => {
        const el = byId(id);
        if (!el) return;
        el.dataset.loaded = 'true';
        el.innerHTML = '<div class="notice-card" style="grid-column:1/-1"><strong>Источники не подключены</strong>Каталог требует хотя бы один API-ключ. Раздел оценки уже доступен в режиме ручного ввода. Добавить ключ можно через настройки.</div>';
      });
      return;
    }
    markers.forEach(id => {
      const el = byId(id);
      if (el) { el.dataset.loaded = 'loading'; renderSkeletons(id, 6); }
    });
    try {
      const [movies, tv, people] = await Promise.all([
        tmdbFetch('/movie/popular?language=ru-RU&page=1').catch(() => null),
        tmdbFetch('/tv/popular?language=ru-RU&page=1').catch(() => null),
        tmdbFetch('/person/popular?language=ru-RU&page=1').catch(() => null)
      ]);
      let movieItems = (movies?.results||[]).map(x=>({...x,source:'tmdb',media_type:'movie',ratingTmdb:Number(x.vote_average||0)}));
      let tvItems = (tv?.results||[]).map(x=>({...x,source:'tmdb',media_type:'tv',ratingTmdb:Number(x.vote_average||0)}));
      if (!movieItems.length) {
        try { const fallback=await kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1'); movieItems=(fallback.items||fallback.films||[]).map(normalizeKpGlobal); } catch(_) {}
      }
      if (!tvItems.length) {
        try { const fallback=await kpFetch('/v2.2/films/collections?type=POPULAR_SERIES&page=1'); tvItems=(fallback.items||fallback.films||[]).map(normalizeKpGlobal).map(x=>({...x,media_type:'tv'})); } catch(_) {}
      }
      setShelf('homeMovies', movieItems, 'movie');
      setShelf('homeTv', tvItems, 'tv');
      setShelf('homePeople', (people?.results||[]).map(x=>({...x,source:'tmdb',media_type:'person'})), 'person');
      markers.forEach(id => { const el = byId(id); if (el) el.dataset.loaded = 'true'; });
      // Populate the second rating source after the TMDB shelves are already visible.
      if ((movies?.results||[]).length || (tv?.results||[]).length) {
        Promise.all([
          kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1').catch(()=>null),
          kpFetch('/v2.2/films/collections?type=POPULAR_SERIES&page=1').catch(()=>null)
        ]).then(([kpMovies,kpTv]) => {
          if (byId('homeMovies')?.dataset.loaded !== 'true') return;
          const kpMovieItems=(kpMovies?.items||kpMovies?.films||[]).map(normalizeKpGlobal).map(x=>({...x,media_type:'movie'}));
          const kpTvItems=(kpTv?.items||kpTv?.films||[]).map(normalizeKpGlobal).map(x=>({...x,media_type:'tv'}));
          const enrich=(tmdbItems,kpItems,containerId,type)=>{
            const grid=byId(containerId); if(!grid) return;
            tmdbItems.forEach(item=>{
              const title=titleName(item);
              const year=titleYear(item);
              const match=kpItems.map(k=>({item:k,score:titleMatchScore(title,k)+(year&&k.year?(year===k.year ? .12 : -.15):0)}))
                .filter(x=>x.score>=.78).sort((a,b)=>b.score-a.score)[0]?.item;
              if(!match) return;
              item.ratingKinopoisk=Number(match.ratingKinopoisk||0); item.kinopoiskId=match.id;
              const card=[...grid.querySelectorAll('.media-card')].find(el=>el.dataset.openType===type&&el.dataset.openId===String(item.id));
              if(!card) return;
              let chip=card.querySelector('.media-rating');
              if(!chip){chip=document.createElement('span');chip.className='media-rating';card.querySelector('.poster-wrap')?.appendChild(chip);}
              const scores=[];
              if(Number(item.ratingTmdb||item.vote_average)>0) scores.push('TMDB '+ratingText(item.ratingTmdb||item.vote_average));
              if(item.ratingKinopoisk>0) scores.push('КП '+ratingText(item.ratingKinopoisk));
              chip.textContent=scores.join(' · ');
            });
          };
          enrich(movieItems,kpMovieItems,'homeMovies','movie');
          enrich(tvItems,kpTvItems,'homeTv','tv');
        }).catch(()=>{});
      }
    } catch (error) {
      markers.forEach(id => {
        setShelf(id, [], 'movie');
        const el = byId(id);
        if (el) el.dataset.loaded = 'true';
      });
    }
  }

  async function pickRandomMovie() {
    showToast('Выбираем случайный шедевр…', 'info', 1800);
    try {
      const randomPage = Math.floor(Math.random() * 5) + 1;
      const res = await tmdbFetch(`/movie/top_rated?language=ru-RU&page=${randomPage}`);
      const list = res.results || [];
      if (list.length) {
        const item = list[Math.floor(Math.random() * list.length)];
        showToast(`🎲 Выпал фильм: ${item.title}!`, 'success');
        openTitle(item.id, 'movie');
        return;
      }
    } catch (_) {}
    try {
      const fallback = await kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1');
      const list = fallback.items || fallback.films || [];
      if (list.length) {
        const item = list[Math.floor(Math.random() * list.length)];
        const kpId = item.filmId || item.kinopoiskId || item.id;
        openKinopoiskTitle(kpId);
      }
    } catch (e) {
      showToast('Не удалось выбрать фильм: ' + e.message, 'error');
    }
  }

  async function searchTmdbGlobal(query, mode, signal) {
    const path = mode === 'person' ? '/search/person' : mode === 'movie' ? '/search/movie' : mode === 'tv' ? '/search/tv' : '/search/multi';
    const data = await tmdbFetch(path+'?query='+encodeURIComponent(query)+'&include_adult=false&language=ru-RU&page=1', signal, 9000);
    return (data.results || []).filter(item => mode === 'multi' ? ['movie','tv','person'].includes(item.media_type) : true)
      .map(item => ({...item, source:'tmdb', media_type:mode==='person'?'person':mode==='movie'?'movie':mode==='tv'?'tv':item.media_type}));
  }
  function titleYear(item) { return String(item.release_date || item.first_air_date || item.year || '').slice(0,4); }
  function titleName(item) { return item.title || item.name || item.original_title || item.original_name || item.nameRu || item.nameEn || item.nameOriginal || ''; }
  async function getKpMatches(query, mode, signal) {
    if (mode === 'person') return {results:[], error:null};
    try {
      const data = await kpFetch('/v2.1/films/search-by-keyword?keyword='+encodeURIComponent(query)+'&page=1', signal, 8000);
      return {results:(data.films || data.items || data.results || []).map(normalizeKpGlobal).filter(x=>x.id && (mode==='multi'||x.media_type===mode)), error:null};
    } catch(error) { return {results:[], error:error.message || String(error)}; }
  }
  function matchKpToTmdb(tmdbItem, kpItems) {
    const name = normalizeSearchText(titleName(tmdbItem));
    const year = titleYear(tmdbItem);
    const type = tmdbItem.media_type;
    let best = null, bestScore = 0;
    for (const kp of kpItems) {
      if (type && type !== 'person' && kp.media_type !== type) continue;
      const kpName = normalizeSearchText(titleName(kp));
      if (!name || !kpName) continue;
      let score = titleMatchScore(name, {...kp, nameRu:kp.title, nameEn:kp.original_title});
      const kpYear = titleYear(kp);
      if (year && kpYear) score += year === kpYear ? .12 : -.15;
      if (score > bestScore) {bestScore=score; best=kp;}
    }
    return bestScore >= .78 ? best : null;
  }

  function renderSearchBanner(suggestion, wasAutoCorrected=false) {
    const banner = byId('searchSuggestionBanner');
    if (!banner) return;
    if (!suggestion) { banner.hidden = true; banner.innerHTML = ''; return; }
    
    if (wasAutoCorrected) {
      banner.innerHTML = `
        <span class="suggest-badge">Автоисправление</span>
        <span>Показаны результаты по запросу: <button type="button" class="suggest-link" data-execute-search="${safe(suggestion.corrected)}"><strong>${safe(suggestion.corrected)}</strong></button></span>
        <span style="color:#7886a0">· Искать вместо этого: <button type="button" class="original-query-link" data-execute-search="${safe(suggestion.original)}" data-force="true">«${safe(suggestion.original)}»</button></span>
      `;
    } else {
      const label = suggestion.type === 'layout' ? 'Исправление раскладки' : 'Возможно, вы имели в виду:';
      banner.innerHTML = `
        <span class="suggest-badge">${label}</span>
        <span><button type="button" class="suggest-link" data-execute-search="${safe(suggestion.corrected)}"><strong>${safe(suggestion.corrected)}</strong></button> ?</span>
      `;
    }
    banner.hidden = false;
  }

  async function runGlobalSearch(rawQuery, mode=activeSearchMode, forceOriginal=false) {
    const query = String(rawQuery || '').trim().replace(/\s+/g,' ');
    activeSearchMode = mode;
    if (query.length < 2) {
      byId('searchStatus').textContent = 'Введи хотя бы два символа.';
      byId('searchResults').innerHTML = '';
      byId('searchSuggestionBanner').hidden = true;
      lastSearchQuery = query;
      return;
    }

    const cacheKey = `${mode}:${query.toLowerCase()}`;
    if (searchCache.has(cacheKey) && !forceOriginal) {
      const cached = searchCache.get(cacheKey);
      lastSearchQuery = query;
      byId('globalSearchInput').value = query;
      byId('pageSearchInput').value = query;
      lastSearchItems = cached.results;
      byId('searchResults').innerHTML = cached.results.map(item => posterCard(item, mode==='movie'?'movie':mode==='tv'?'tv':mode==='person'?'person':'multi')).join('');
      byId('searchStatus').innerHTML = `Найдено: ${cached.results.length} <span class="search-cache-badge">⚡ из кэша (0ms)</span>`;
      renderSearchBanner(cached.suggestion, cached.wasAutoCorrected);
      return;
    }

    const token = ++searchCounter;
    const controller = new AbortController();
    lastSearchQuery = query;
    byId('globalSearchInput').value = query;
    byId('pageSearchInput').value = query;
    
    // Check for Google-style typo or keyboard error
    const suggestion = !forceOriginal ? detectGoogleCorrection(query) : null;
    let effectiveQuery = query;
    let wasAutoCorrected = false;

    // If keyboard layout was wrong, auto-correct the query directly
    if (suggestion && suggestion.type === 'layout' && !forceOriginal) {
      effectiveQuery = suggestion.corrected;
      wasAutoCorrected = true;
    }

    renderSkeletons('searchResults', 10);
    byId('searchStatus').textContent = mode==='person' ? 'Ищем людей в TMDB…' : 'Ищем в TMDB и Кинопоиске…';
    const live = byId('liveSearchResults');

    let tmdbResults = [], tmdbError = null, kp = {results:[], error:null};
    try {
      try { tmdbResults = await searchTmdbGlobal(effectiveQuery, mode, controller.signal); }
      catch(error) { if (error.name==='AbortError') throw error; tmdbError = error.message || String(error); }
      if (token !== searchCounter) return;

      if (mode !== 'person') kp = await getKpMatches(effectiveQuery, mode, controller.signal);
      if (token !== searchCounter) return;

      // If zero results for effectiveQuery, and we had a suggestion, try the suggestion!
      if (!tmdbResults.length && !kp.results.length && suggestion && effectiveQuery === query) {
        effectiveQuery = suggestion.corrected;
        wasAutoCorrected = true;
        try { tmdbResults = await searchTmdbGlobal(effectiveQuery, mode, controller.signal); } catch(_) {}
        if (mode !== 'person') {
          try { kp = await getKpMatches(effectiveQuery, mode, controller.signal); } catch(_) {}
        }
      }

      const merged = []; const seen = new Set();
      for (const item of tmdbResults) {
        if (item.media_type === 'person') {
          const k = 'person:' + item.id;
          if (!seen.has(k)) { seen.add(k); merged.push(item); }
          continue;
        }
        const kpMatch = matchKpToTmdb(item, kp.results);
        const normalized = {
          ...item,
          ratingTmdb: Number(item.vote_average || 0),
          ratingKinopoisk: kpMatch ? Number(kpMatch.ratingKinopoisk || 0) : 0,
          kinopoiskId: kpMatch ? kpMatch.id : ''
        };
        const k = item.media_type + ':' + item.id;
        if (!seen.has(k)) { seen.add(k); merged.push(normalized); }
      }
      if (mode !== 'person') {
        for (const kpItem of kp.results) {
          const duplicate = tmdbResults.some(t => t.media_type === kpItem.media_type && matchKpToTmdb(t, [kpItem]));
          const k = 'kp:' + kpItem.id;
          if (!duplicate && !seen.has(k)) { seen.add(k); merged.push(kpItem); }
        }
      }

      const results = merged.slice(0, 30);
      lastSearchItems = results;
      
      // Save in cache
      searchCache.set(cacheKey, { results, suggestion, wasAutoCorrected });

      renderSearchBanner(suggestion, wasAutoCorrected);

      if (results.length) {
        byId('searchResults').innerHTML = results.map(item => posterCard(item, mode==='movie'?'movie':mode==='tv'?'tv':mode==='person'?'person':'multi')).join('');
        byId('searchStatus').textContent = `Найдено результатов: ${results.length}.`;
      } else if (tmdbError || kp.error) {
        byId('searchStatus').textContent = `Поиск не удался.`;
        byId('searchResults').innerHTML = `
          <div class="error-banner">
            <span class="error-icon">⚠️</span>
            <div class="error-text">
              <strong>Ошибка при обращении к базе данных</strong>
              <span>TMDB: ${safe(tmdbError || 'нет ответа')}; Кинопоиск: ${safe(kp.error || 'нет ответа')}</span>
            </div>
            <button class="retry-btn" type="button" data-retry-query="${safe(query)}">Повторить</button>
          </div>
        `;
      } else {
        byId('searchStatus').textContent = 'Ничего не найдено. Попробуй другое написание или оригинальное название.';
        byId('searchResults').innerHTML = '<div class="notice-card" style="grid-column:1/-1"><strong>Совпадений нет</strong>Попробуйте ввести оригинальное название на английском или проверить опечатки.</div>';
      }

      if (live && document.activeElement === byId('globalSearchInput')) {
        live.innerHTML = results.length ? results.slice(0,6).map(item => posterCard(item, 'multi')).join('') + '<button type="button" class="live-search-footer" data-open-all-results>Показать все результаты →</button>' : `<div class="live-search-message">${safe(byId('searchStatus').textContent)}</div>`;
        live.hidden = false;
      }
    } catch(error) {
      if (token !== searchCounter) return;
      byId('searchStatus').textContent = `Ошибка поиска: ${error.message || error}`;
      byId('searchResults').innerHTML = `<div class="notice-card" style="grid-column:1/-1"><strong>Поиск прерван</strong>${safe(error.message || error)}</div>`;
    }
  }

  function overviewText(data) { return data.overview || 'Описание пока недоступно на русском языке.'; }
  function renderCast(people) {
    if (!people || !people.length) return '<div class="notice-card">Информация о составе пока недоступна.</div>';
    return `<div class="people-row">${people.slice(0,12).map(p => personCard(p, p.character || (p.roles||[]).map(r=>r.character).filter(Boolean).join(', ') || p.known_for_department || 'Участник съёмочной группы')).join('')}</div>`;
  }
  function renderCrew(crew, isTv) {
    const names = (crew || []).filter(p => isTv ? ['Creator','Director','Executive Producer'].includes(p.job) : p.job === 'Director' || p.job === 'Writer' || p.job === 'Screenplay').slice(0,10);
    if (!names.length) return '';
    return `<section class="detail-section"><h2>${isTv?'Создатели':'Режиссура и сценарий'}</h2><div class="people-row">${names.map(p => personCard(p,p.job)).join('')}</div></section>`;
  }

  async function openTitle(id, type='movie') {
    showPage('detail');
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем карточку…</strong>Собираем описание, рейтинги и съёмочную группу.</div>';
    try {
      const base = type === 'tv' ? '/tv/' : '/movie/';
      const [d,c,v] = await Promise.all([
        tmdbFetch(base+encodeURIComponent(id)+'?language=ru-RU'),
        tmdbFetch(base+encodeURIComponent(id)+(type==='tv'?'/aggregate_credits':'/credits')+'?language=ru-RU').catch(()=>({cast:[],crew:[]})),
        tmdbFetch(base+encodeURIComponent(id)+'/videos?language=ru-RU').catch(()=>({results:[]}))
      ]);
      let kpMatch=null;
      try { const kpr=await getKpMatches(d.title||d.name||d.original_title||d.original_name||'', type, new AbortController().signal); kpMatch=matchKpToTmdb({...d,media_type:type}, kpr.results); } catch(_) {}
      d.ratingKinopoisk=Number(kpMatch?.ratingKinopoisk||0); d.kinopoiskId=kpMatch?.id||'';
      currentDetail = {source:'tmdb', kind:type, id:String(id), details:d, credits:c};
      const title = d.title || d.name || d.original_title || d.original_name || 'Без названия';
      const original = d.original_title || d.original_name || '';
      const date = d.release_date || d.first_air_date || '';
      const genres = (d.genres || []).map(g=>g.name).filter(Boolean);
      const runtime = type==='tv' ? (d.episode_run_time||[])[0] : d.runtime;
      const runtimeText = runtime ? `${runtime} мин.` : '';
      const poster = posterUrl(d.poster_path,'w500');
      const backdrop = posterUrl(d.backdrop_path,'w1280');
      const cast = c.cast || [];
      const crew = c.crew || [];
      const directors = type==='tv' ? (d.created_by||[]).map(p=>p.name) : crew.filter(p=>p.job==='Director').map(p=>p.name);
      const creatorsText = directors.slice(0,4).join(', ');
      const video = (v.results||[]).find(x=>x.site==='YouTube' && (x.type==='Trailer'||x.type==='Teaser'));
      const stats = [date.slice(0,4), type==='tv'?'Сериал':'Фильм', runtimeText, d.number_of_seasons?`${d.number_of_seasons} сез.`:'', genres.join(' · ')].filter(Boolean);
      const companies = (d.production_companies||[]).map(x=>x.name).filter(Boolean).slice(0,4).join(' · ');
      const countries = (d.production_countries||[]).map(x=>x.name).filter(Boolean).join(', ');
      const languages = (d.spoken_languages||[]).map(x=>x.english_name||x.name).filter(Boolean).join(', ');
      
      const inWatch = isInWatchlist(id, type, 'tmdb');

      byId('detailContent').innerHTML = `
        <section class="detail-top">${backdrop?`<img class="detail-backdrop" src="${safe(backdrop)}" alt="">`:''}<div class="detail-main">
          ${poster?`<img class="detail-poster" src="${safe(poster)}" alt="Постер: ${safe(title)}">`:'<div class="detail-poster" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}
          <div class="detail-copy"><div class="eyebrow">${type==='tv'?'CINEVA · СЕРИАЛ':'CINEVA · ФИЛЬМ'}</div><h1>${safe(title)}${date?` <span style="font-size:.55em;color:#a5b0c5">(${safe(date.slice(0,4))})</span>`:''}</h1>${original && original!==title?`<div class="detail-original">${safe(original)}</div>`:''}${d.tagline?`<div class="detail-tagline">«${safe(d.tagline)}»</div>`:''}
          <div class="detail-meta">${stats.map(s=>`<span>${safe(s)}</span>`).join('')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div class="detail-score"><strong>${ratingText(d.vote_average)}</strong><span>TMDB<br>${Number(d.vote_count||0).toLocaleString('ru-RU')} голосов</span></div>
            <div class="detail-score"><strong>${Number(d.ratingKinopoisk)>0?Number(d.ratingKinopoisk).toFixed(1):'—'}</strong><span>Кинопоиск<br>${d.kinopoiskId?'Найдено совпадение':'Оценка недоступна'}</span></div>
          </div>
          <h3>О произведении</h3><p class="overview">${safe(overviewText(d))}</p>${creatorsText?`<h3>${type==='tv'?'Создатели':'Режиссёр'}</h3><p class="overview">${safe(creatorsText)}</p>`:''}
          <div class="detail-actions">
            <button type="button" class="site-btn primary" data-rate-current>⭐ Оценить в CINEVA ↗</button>
            <button type="button" class="site-btn ${inWatch?'primary':''}" data-detail-watchlist="${safe(id)}" data-media-type="${safe(type)}">${inWatch?'✓ В избранном':'🔖 В избранное'}</button>
            <button type="button" class="site-btn" data-share-title="${safe(title)}">🔗 Поделиться</button>
            ${video?`<a class="site-btn" href="https://www.youtube.com/watch?v=${safe(video.key)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">▶ Трейлер ↗</a>`:''}
          </div></div>
        </div></section>
        ${renderCrew(crew,type==='tv')}
        <section class="detail-section"><h2>Актёрский состав</h2>${renderCast(cast)}</section>
        <section class="detail-section"><h2>Информация</h2><div class="notice-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">${[['Статус',d.status],['Страна',countries],['Языки',languages],['Студии',companies],['Бюджет',d.budget?new Intl.NumberFormat('ru-RU',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(d.budget):'—'],['Сборы',d.revenue?new Intl.NumberFormat('ru-RU',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(d.revenue):'—']].map(([k,val])=>`<div><span style="display:block;font-size:10px;color:#7f8aa2;margin-bottom:5px">${safe(k)}</span><strong style="font-size:12px;color:#e2e7f4">${safe(val||'—')}</strong></div>`).join('')}</div></section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные карточки предоставляются TMDB и Кинопоиском. CINEVA не связан с правообладателями.</p>`;
    } catch(error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть карточку</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openPerson(id) {
    showPage('detail');
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем профиль…</strong>Получаем биографию и фильмографию.</div>';
    try {
      let p, credits;
      try { [p,credits] = await Promise.all([tmdbFetch('/person/'+encodeURIComponent(id)+'?language=ru-RU'), tmdbFetch('/person/'+encodeURIComponent(id)+'/combined_credits?language=ru-RU')]); }
      catch (err) { [p,credits] = await Promise.all([tmdbFetch('/person/'+encodeURIComponent(id)+'?language=en-US'), tmdbFetch('/person/'+encodeURIComponent(id)+'/combined_credits?language=en-US')]); }
      currentDetail = {kind:'person', id:String(id), details:p, credits};
      const name = p.name || 'Без имени';
      const photo = posterUrl(p.profile_path, 'w500');
      let bio = p.biography || '';
      if (!bio) {
        try { const en = await tmdbFetch('/person/'+encodeURIComponent(id)+'?language=en-US'); bio = en.biography || ''; } catch (_) {}
      }
      const works = [...(credits.cast||[]), ...(credits.crew||[])].filter(w => w && w.id && (w.title||w.name)).sort((a,b)=>String(b.release_date||b.first_air_date||'').localeCompare(String(a.release_date||a.first_air_date||'')));
      const seen = new Set();
      const uniqueWorks = works.filter(w => { const k=(w.media_type||'')+':'+w.id; if(seen.has(k))return false; seen.add(k); return true; }).slice(0,24);
      const facts = [p.known_for_department, p.birthday?`Родился: ${p.birthday}`:'', p.place_of_birth, p.deathday?`Умер: ${p.deathday}`:''].filter(Boolean);
      const knownAs = (p.also_known_as||[]).slice(0,5).join(', ');
      
      byId('detailContent').innerHTML = `<section class="person-hero">${photo?`<img class="person-profile" src="${safe(photo)}" alt="${safe(name)}">`:'<div class="person-profile" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}<div><div class="eyebrow">CINEVA · ПРОФИЛЬ</div><h1 style="font-size:clamp(30px,4vw,52px);letter-spacing:-.05em;margin:10px 0">${safe(name)}</h1><div class="person-facts">${facts.map(f=>`<span>${safe(f)}</span>`).join('')}</div>${bio?`<p class="person-bio">${safe(bio)}</p>`:'<p class="person-bio">Биография для этой записи не указана. Ниже доступна фильмография и список проектов.</p>'}${knownAs?`<p style="font-size:10px;color:#8590a8;margin-top:14px">Также известен как: ${safe(knownAs)}</p>`:''}</div></section>
        <section class="detail-section"><h2>Фильмография</h2><p style="font-size:11px;color:#8d98af;margin:-7px 0 15px">Показаны ключевые проекты из базы данных TMDB.</p><div class="filmography">${uniqueWorks.length?uniqueWorks.map(w=>posterCard({...w,media_type:w.media_type||'movie'},w.media_type||'movie')).join(''):'<div class="notice-card" style="grid-column:1/-1">Фильмография пока недоступна.</div>'}</div></section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Биография и фильмография предоставлены TMDB. CINEVA не связан с TMDB.</p>`;
    } catch(error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть профиль</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openKinopoiskTitle(id) {
    if (!id) return;
    try {
      const kpd = await kpFetch('/v2.2/films/'+encodeURIComponent(id));
      const title = kpd.nameRu || kpd.nameOriginal || kpd.nameEn || '';
      const type = ['TV_SERIES','MINI_SERIES','TV_SHOW','TV_MINI_SERIES'].includes(kpd.type)?'tv':'movie';
      if (title) {
        const tmdb = await searchTmdbGlobal(title, type, new AbortController().signal);
        const match = tmdb.sort((a,b)=>titleMatchScore(title,b)-titleMatchScore(title,a))[0];
        if (match && titleMatchScore(title,match)>=.78) { await openTitle(match.id, type); return; }
      }
    } catch(_) {}
    showPage('detail');
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем карточку…</strong>Получаем описание и актёрский состав из Кинопоиска.</div>';
    try {
      const [d, staff] = await Promise.all([
        kpFetch('/v2.2/films/'+encodeURIComponent(id)),
        kpFetch('/v1/staff?filmId='+encodeURIComponent(id)).catch(()=>[])
      ]);
      currentDetail = {source:'kinopoisk', kind:['TV_SERIES','MINI_SERIES','TV_SHOW','TV_MINI_SERIES'].includes(d.type)?'tv':'movie', id:String(id), details:d, credits:{staff}};
      const title = d.nameRu||d.nameOriginal||d.nameEn||'Без названия';
      const original = d.nameOriginal||d.nameEn||'';
      const year = d.year?String(d.year):'';
      const isTv = ['TV_SERIES','MINI_SERIES','TV_SHOW','TV_MINI_SERIES'].includes(d.type);
      const genres = (d.genres||[]).map(g=>typeof g==='string'?g:(g.genre||g.name||'')).filter(Boolean);
      const poster = d.posterUrl||d.posterUrlPreview||'';
      const rating = Number(d.ratingKinopoisk||0);
      const votes = Number(d.ratingKinopoiskVoteCount||0);
      const length = d.filmLength?`${d.filmLength} мин.`:'';
      const tagline = d.slogan||'';
      const cast = (staff||[]).filter(p=>/ACTOR|VOICE|Акт|озвуч/i.test(String(p.professionKey||'')+' '+String(p.professionText||''))).slice(0,18);
      const directors = (staff||[]).filter(p=>/DIRECTOR|Режисс/i.test(String(p.professionKey||'')+' '+String(p.professionText||''))).slice(0,5);
      const overview = d.description||d.shortDescription||'Описание для этой записи не указано.';
      const staffCards = people => people.map(p=>`<button type="button" class="person-card" data-open-kp-person="${safe(p.staffId||p.id||'')}"><span>${p.posterUrl?`<img src="${safe(p.posterUrl)}" loading="lazy" alt="">`:'<span class="person-photo-empty">CINEVA</span>'}</span><strong>${safe(p.nameRu||p.nameEn||'Без имени')}</strong><span>${safe(p.description||p.professionText||'Кино')}</span></button>`).join('');
      
      const inWatch = isInWatchlist(id, isTv?'tv':'movie', 'kinopoisk');

      byId('detailContent').innerHTML = `
        <section class="detail-top"><div class="detail-main">${poster?`<img class="detail-poster" src="${safe(poster)}" alt="Постер: ${safe(title)}">`:'<div class="detail-poster" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}
        <div class="detail-copy"><div class="eyebrow">${isTv?'CINEVA · СЕРИАЛ':'CINEVA · ФИЛЬМ'}</div><h1>${safe(title)}${year?` <span style="font-size:.55em;color:#a5b0c5">(${safe(year)})</span>`:''}</h1>${original&&original!==title?`<div class="detail-original">${safe(original)}</div>`:''}${tagline?`<div class="detail-tagline">«${safe(tagline)}»</div>`:''}
        <div class="detail-meta">${[year,isTv?'Сериал':'Фильм',length,genres.join(' · ')].filter(Boolean).map(x=>`<span>${safe(x)}</span>`).join('')}</div><div class="detail-score"><strong>${rating>0?rating.toFixed(1):'—'}</strong><span>Кинопоиск<br>${votes.toLocaleString('ru-RU')} голосов</span></div>
        <h3>О произведении</h3><p class="overview">${safe(overview)}</p>${directors.length?`<h3>Режиссура</h3><p class="overview">${safe(directors.map(p=>p.nameRu||p.nameEn).filter(Boolean).join(', '))}</p>`:''}
        <div class="detail-actions">
          <button type="button" class="site-btn primary" data-rate-current>⭐ Оценить в CINEVA ↗</button>
          <button type="button" class="site-btn ${inWatch?'primary':''}" data-detail-watchlist="${safe(id)}" data-media-type="${isTv?'tv':'movie'}">${inWatch?'✓ В избранном':'🔖 В избранное'}</button>
          <button type="button" class="site-btn" data-share-title="${safe(title)}">🔗 Поделиться</button>
        </div></div></div></section>
        <section class="detail-section"><h2>Актёрский состав</h2>${cast.length?`<div class="people-row">${staffCards(cast)}</div>`:'<div class="notice-card">Информация об актёрском составе пока недоступна.</div>'}</section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные карточки и актёрского состава предоставлены API Кинопоиска. CINEVA не связан с Кинопоиском.</p>`;
    } catch(error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть карточку</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openKinopoiskPerson(id) {
    if (!id) return;
    showPage('detail');
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем профиль…</strong></div>';
    try {
      const p = await kpFetch('/v1/staff/'+encodeURIComponent(id));
      const name = p.nameRu||p.nameEn||'Без имени';
      const photo = p.posterUrl||'';
      const bio = p.biography||p.facts?.map(x=>typeof x==='string'?x:x.text||'').filter(Boolean).join('\n')||'';
      const works = (p.films||[]).slice(0,24);
      byId('detailContent').innerHTML=`<section class="person-hero">${photo?`<img class="person-profile" src="${safe(photo)}" alt="${safe(name)}">`:'<div class="person-profile" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}<div><div class="eyebrow">CINEVA · ПРОФИЛЬ</div><h1 style="font-size:clamp(30px,4vw,52px);letter-spacing:-.05em;margin:10px 0">${safe(name)}</h1>${bio?`<p class="person-bio">${safe(bio)}</p>`:'<p class="person-bio">Биография для этой записи не указана.</p>'}</div></section><section class="detail-section"><h2>Фильмография</h2><div class="filmography">${works.length?works.map(w=>posterCard(normalizeKpGlobal({...w,filmId:w.filmId||w.id}), 'movie')).join(''):'<div class="notice-card" style="grid-column:1/-1">Фильмография пока недоступна.</div>'}</div></section><p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные профиля предоставлены API Кинопоиска. CINEVA не связан с Кинопоиском.</p>`;
    } catch(error) {
      byId('detailContent').innerHTML=`<div class="notice-card"><strong>Не удалось открыть профиль</strong>${safe(error.message)}</div>`;
    }
  }

  function openEntity(type, id) {
    if (!id) return;
    if (type === 'person') openPerson(id);
    else if (type === 'movie' || type === 'tv') openTitle(id, type);
    else if (type === 'multi') {
      const found = lastSearchItems.find(x => String(x.id) === String(id));
      if (found) openEntity(found.media_type, id);
      else openTitle(id, 'movie');
    }
  }

  function rateCurrent() {
    if (!currentDetail || currentDetail.kind==='person') return;
    const d = currentDetail.details;
    const c = currentDetail.credits||{};
    const isKp = currentDetail.source==='kinopoisk';
    const isTv = currentDetail.kind==='tv';
    const title = isKp?(d.nameRu||d.nameOriginal||d.nameEn||''):(d.title||d.name||d.original_title||d.original_name||'');
    const date = isKp?String(d.year||''):(d.release_date||d.first_air_date||'');
    const genres = (d.genres||[]).map(g=>isKp?(typeof g==='string'?g:(g.genre||g.name||'')):g.name).filter(Boolean);
    let directors = isKp?(c.staff||[]).filter(p=>/DIRECTOR|Режисс/i.test(String(p.professionKey||'')+' '+String(p.professionText||''))).map(p=>p.nameRu||p.nameEn):(isTv?(d.created_by||[]).map(p=>p.name):(c.crew||[]).filter(p=>p.job==='Director').map(p=>p.name));
    if (!directors.length && c.crew) directors=c.crew.filter(p=>p.department==='Directing').slice(0,3).map(p=>p.name);
    
    $('title').value = title;
    $('director').value = directors.join(', ');
    $('year').value = date.slice(0,4);
    $('genre').value = genres.join(', ');
    const animated = genres.some(g=>/animation|анимац/i.test(g));
    $('kind').value = isTv ? (animated?'Анимационный сериал':'Сериал') : (animated?'Мультфильм':'Фильм');
    $('integFormat').value = '1.0';
    const voteCount = Number(isKp?d.ratingKinopoiskVoteCount:d.vote_count)||0;
    const vote = Number(isKp?d.ratingKinopoisk:d.vote_average)||0;
    if (voteCount>100000){ $('impactScale').value='2.5'; $('impactHype').value='2.5'; }
    else if (voteCount>30000){ $('impactScale').value='2.0'; $('impactHype').value='2.0'; }
    else if (voteCount>8000||vote>=8){ $('impactScale').value='1.5'; $('impactHype').value='1.5'; }
    else if (voteCount>1000){ $('impactScale').value='1.0'; $('impactHype').value='1.0'; }
    else { $('impactScale').value='0.5'; $('impactHype').value='0.5'; }
    
    $('editorDetails').hidden = false;
    $('resultCard').hidden = false;
    document.querySelector('#page-rating .layout').classList.add('has-preview');
    setMetadataMode(isKp ? 'kinopoisk' : 'tmdb');
    const url = isKp?(d.posterUrl||d.posterUrlPreview||''):posterUrl(d.poster_path,'w780');
    if (url) {
      if(imageUrl){ URL.revokeObjectURL(imageUrl); imageUrl=null; }
      $('posterFile').value = '';
      $('posterImg').dataset.imageType = 'poster';
      $('posterImg').removeAttribute('crossorigin');
      $('posterImg').src = url;
      $('posterImg').style.display = 'block';
      $('posterPlaceholder').style.display = 'none';
      setArtworkColors($('posterImg'));
    }
    update();
    showPage('rating');
    $('tmdbQuery').value = title;
    $('tmdbStatus').textContent = 'Карточка заполнена. Выстави критерии и скачай коллекционный PNG.';
    window.scrollTo({top:0, behavior:'smooth'});
    showToast('Данные загружены в калькулятор CINEVA', 'success');
  }

  // Quick rate directly from card
  async function quickRate(id, mediaType, source) {
    showToast('Подготавливаем карточку для оценки…', 'info');
    if (source === 'kinopoisk') {
      await openKinopoiskTitle(id);
    } else {
      await openTitle(id, mediaType);
    }
    rateCurrent();
  }

  // Keyboard support for media cards (quick-action buttons keep their native behavior).
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.media-card[role="button"][data-open-type][data-open-id]');
    if (!card || event.target.closest('button, a, input, select, textarea')) return;
    event.preventDefault();
    card.click();
  });

  // Global Click Delegations
  document.addEventListener('click', event => {
    // Page Links
    const pageBtn = event.target.closest('[data-page-link]');
    if (pageBtn) {
      const dest = pageBtn.dataset.pageLink;
      if (dest === 'search') goToSearch('multi');
      else if (dest === 'rating') showPage('rating');
      else if (dest === 'tierlist') showPage('tierlist');
      else if (dest === 'watchlist') showPage('watchlist');
      else { showPage('home'); loadHomeShelves(); }
      return;
    }
    
    // Search mode chips
    const modeBtn = event.target.closest('[data-search-mode]');
    if (modeBtn) {
      document.querySelectorAll('.filter-chip[data-search-mode]').forEach(c => c.classList.toggle('active', c === modeBtn));
      goToSearch(modeBtn.dataset.searchMode, lastSearchQuery);
      return;
    }

    // Go Search
    if (event.target.closest('[data-go-search]')) {
      goToSearch('multi');
      byId('pageSearchInput').focus();
      return;
    }

    // Random Movie
    if (event.target.closest('#randomMovieBtn') || event.target.closest('#heroRandomBtn')) {
      pickRandomMovie();
      return;
    }

    // Settings Modal
    if (event.target.closest('#settingsBtn') || event.target.closest('[data-open-settings]')) {
      showSettings();
      return;
    }
    if (event.target.closest('#settingsCloseBtn') || event.target.closest('.settings-overlay') === event.target) {
      hideSettings();
      return;
    }
    if (event.target.closest('#settingsResetDefault')) {
      saveApiKeys('', '');
      byId('settingTmdbKey').value = '';
      byId('settingKpKey').value = '';
      loadHomeShelves(true);
      showToast('Сохранённые API-ключи удалены. Оценивание доступно вручную.', 'info');
      return;
    }
    if (event.target.closest('#checkApiBtn')) {
      const btn = byId('checkApiBtn');
      const status = byId('apiCheckStatus');
      btn.disabled = true;
      btn.textContent = 'Проверяем…';
      status.textContent = 'Запрос к TMDB и Кинопоиску выполняется отдельно для каждого источника.';
      Promise.allSettled([
        tmdbFetch('/configuration', undefined, 8000),
        kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1', undefined, 8000)
      ]).then(results => {
        const labels = ['TMDB', 'Кинопоиск'];
        status.innerHTML = results.map((result, index) => result.status === 'fulfilled'
          ? `<span class="api-ok">✓ ${labels[index]}: подключение работает</span>`
          : `<span class="api-fail">✕ ${labels[index]}: ${safe(result.reason?.message || 'нет ответа API')}</span>`).join('\n');
      }).finally(() => { btn.disabled = false; btn.textContent = 'Проверить подключение'; });
      return;
    }

    if (event.target.closest('#settingsSaveBtn')) {
      const tmdbVal = byId('settingTmdbKey').value.trim();
      const kpVal = byId('settingKpKey').value.trim();
      saveApiKeys(tmdbVal, kpVal);
      hideSettings();
      loadHomeShelves(true);
      showToast(tmdbVal || kpVal ? 'Настройки API сохранены.' : 'API отключены. Оценивание доступно вручную.', 'success');
      return;
    }

    // Remove a saved work from the collection page.
    const removeWatch = event.target.closest('[data-watchlist-remove]');
    if (removeWatch) {
      event.preventDefault();
      event.stopPropagation();
      const id = removeWatch.dataset.watchlistRemove;
      const type = removeWatch.dataset.watchlistType || 'movie';
      const source = removeWatch.dataset.watchlistSource || 'tmdb';
      const item = getWatchlist().find(x => String(x.id) === String(id) && (x.media_type || x.type) === type && sourceOf(x) === source);
      if (item) toggleWatchlist({...item, id, media_type:type, source}, type);
      return;
    }

    // Legacy card toggle hook; poster overlays are intentionally not rendered.
    const watchToggle = event.target.closest('[data-watchlist-toggle]');
    if (watchToggle) {
      event.preventDefault();
      event.stopPropagation();
      const id = watchToggle.dataset.watchlistToggle;
      const type = watchToggle.dataset.mediaType || 'movie';
      const item = lastSearchItems.find(x => String(x.id || x.kinopoiskId) === String(id)) || { id, media_type: type };
      toggleWatchlist(item, type);
      return;
    }

    // Watchlist toggle from detail page
    const detailWatch = event.target.closest('[data-detail-watchlist]');
    if (detailWatch && currentDetail) {
      const d = currentDetail.details;
      toggleWatchlist({
        id: currentDetail.id,
        source: currentDetail.source || 'tmdb',
        media_type: currentDetail.kind,
        title: d.title || d.name || d.nameRu || d.nameOriginal,
        poster_path: d.poster_path,
        posterUrl: d.posterUrl || (d.poster_path ? posterUrl(d.poster_path, 'w500') : ''),
        ratingTmdb: d.vote_average,
        ratingKinopoisk: d.ratingKinopoisk,
        year: d.release_date || d.first_air_date || d.year
      }, currentDetail.kind);
      const active = isInWatchlist(currentDetail.id, currentDetail.kind, currentDetail.source || 'tmdb');
      detailWatch.textContent = active ? '✓ В избранном' : '🔖 В избранное';
      detailWatch.classList.toggle('primary', active);
      return;
    }

    // Clear Watchlist
    if (event.target.closest('#watchlistClearBtn')) {
      if (confirm('Очистить весь список избранного?')) {
        saveWatchlist([]);
        updateWatchlistUI();
        showToast('Список избранного очищен', 'info');
      }
      return;
    }

    // Quick Rate
    const quickRateBtn = event.target.closest('[data-quick-rate]');
    if (quickRateBtn) {
      event.preventDefault();
      event.stopPropagation();
      quickRate(quickRateBtn.dataset.quickRate, quickRateBtn.dataset.mediaType, quickRateBtn.dataset.openSource);
      return;
    }

    // Rate Current
    if (event.target.closest('[data-rate-current]')) {
      rateCurrent();
      return;
    }

    // Share title & deep link
    const shareBtn = event.target.closest('[data-share-title]');
    if (shareBtn) {
      const rawTitle = shareBtn.dataset.shareTitle || '';
      let text = rawTitle;
      if (currentDetail && currentDetail.details) {
        const d = currentDetail.details;
        const c = currentDetail.credits || {};
        const year = releaseYear(d);
        const isTv = currentDetail.kind === 'tv';
        let directors = [];
        if (currentDetail.source === 'kinopoisk') {
          directors = (c.staff || []).filter(p => /DIRECTOR|Режисс/i.test(String(p.professionKey || '') + ' ' + String(p.professionText || ''))).map(p => p.nameRu || p.nameEn);
        } else {
          directors = isTv ? (d.created_by || []).map(p => p.name) : (c.crew || []).filter(p => p.job === 'Director').map(p => p.name);
        }
        const directorStr = directors.slice(0, 2).filter(Boolean).join(', ');
        
        let webUrl = '';
        try {
          const origin = window.location.origin;
          if (origin && origin !== 'null' && window.location.protocol.startsWith('http')) {
            const qp = new URLSearchParams();
            qp.set('open', isTv ? 'tv' : 'movie');
            qp.set('id', currentDetail.id);
            if (currentDetail.source === 'kinopoisk') qp.set('source', 'kinopoisk');
            webUrl = `${origin}${window.location.pathname}?${qp.toString()}`;
          }
        } catch (_) {}

        const parts = [
          `«${rawTitle}»`,
          year ? `(${year})` : '',
          directorStr ? `· Реж. ${directorStr}` : '',
          '— CINEVA',
          webUrl ? webUrl : ''
        ].filter(Boolean);
        text = parts.join(' ');
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        showToast('Данные фильма и ссылка скопированы в буфер!', 'success');
      }
      return;
    }

    // Retry search
    const retryBtn = event.target.closest('[data-retry-query]');
    if (retryBtn) {
      runGlobalSearch(retryBtn.dataset.retryQuery, activeSearchMode, true);
      return;
    }

    // Execute search from suggestion
    const execSearch = event.target.closest('[data-execute-search]');
    if (execSearch) {
      const q = execSearch.dataset.executeSearch;
      const force = execSearch.dataset.force === 'true';
      byId('globalSearchInput').value = q;
      byId('pageSearchInput').value = q;
      runGlobalSearch(q, activeSearchMode, force);
      return;
    }

    // Entity Cards
    const entityBtn = event.target.closest('[data-open-type][data-open-id]');
    if (entityBtn) {
      if (entityBtn.dataset.openSource === 'kinopoisk') {
        const kpId = entityBtn.dataset.kpId || entityBtn.dataset.openId;
        if (kpId) openKinopoiskTitle(kpId);
        return;
      }
      openEntity(entityBtn.dataset.openType, entityBtn.dataset.openId);
      return;
    }

    // Kinopoisk person click
    const kpPersonBtn = event.target.closest('[data-open-kp-person]');
    if (kpPersonBtn) {
      openKinopoiskPerson(kpPersonBtn.dataset.openKpPerson);
      return;
    }

    // Live search outside click
    if (!event.target.closest('#globalSearchForm')) {
      byId('liveSearchResults').hidden = true;
    }
    if (event.target.closest('[data-open-all-results]')) {
      const q = byId('globalSearchInput').value.trim();
      byId('liveSearchResults').hidden = true;
      goToSearch('multi', q);
    }
  });

  // Global search input handling
  byId('globalSearchInput').addEventListener('input', () => {
    clearTimeout(liveSearchTimer);
    const q = byId('globalSearchInput').value.trim();
    const live = byId('liveSearchResults');
    if (q.length < 2) { live.hidden = true; live.innerHTML = ''; searchCounter++; return; }
    live.innerHTML = '<div class="live-search-message">Ищем фильмы, сериалы и людей кино…</div>';
    live.hidden = false;
    liveSearchTimer = setTimeout(() => runGlobalSearch(q, 'multi'), 280);
  });
  byId('globalSearchInput').addEventListener('focus', () => {
    if (byId('globalSearchInput').value.trim().length >= 2 && byId('liveSearchResults').innerHTML) {
      byId('liveSearchResults').hidden = false;
    }
  });

  byId('globalSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    const q = byId('globalSearchInput').value.trim();
    byId('liveSearchResults').hidden = true;
    goToSearch(activeSearchMode, q);
  });

  byId('pageSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    runGlobalSearch(byId('pageSearchInput').value, activeSearchMode);
  });
  byId('pageSearchInput').addEventListener('input', () => {
    clearTimeout(liveSearchTimer);
    liveSearchTimer = setTimeout(() => runGlobalSearch(byId('pageSearchInput').value, activeSearchMode), 280);
  });

  // Keyboard navigation & Esc
  byId('globalSearchInput').addEventListener('keydown', event => {
    if (event.key === 'Escape') byId('liveSearchResults').hidden = true;
  });
  byId('pageSearchInput').addEventListener('keydown', event => {
    if (event.key === 'Escape') byId('pageSearchInput').blur();
  });

  byId('detailBackBtn').addEventListener('click', () => {
    const target = previousPage || 'home';
    showPage(target, true);
    if (target === 'search' && lastSearchQuery) {
      byId('pageSearchInput').value = lastSearchQuery;
      byId('globalSearchInput').value = lastSearchQuery;
    }
  });

  // Scroll to top button handling
  const scrollTopBtn = byId('scrollTopBtn');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 320);
    }, {passive:true});
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({top:0, behavior:'smooth'});
    });
  }

  // Reviewer edit shortcut
  const reviewerEditBtn = byId('reviewerEdit');
  if (reviewerEditBtn) {
    reviewerEditBtn.addEventListener('click', () => {
      byId('reviewerNameInput').value = reviewerName || '';
      byId('reviewerOverlay').hidden = false;
      byId('reviewerNameInput').focus();
    });
  }


  // Unified image loading: stable placeholders, async decoding, priorities and fallbacks.
  function isDirectLoadingImage(img) {
    return img.matches('.detail-poster, .person-profile, .detail-backdrop, .tmdb-result img');
  }

  function prioritizeImage(img) {
    const card = img.closest('.media-card, .person-card');
    const grid = img.closest('#homeMovies, #homeTv, #homePeople, #searchResults, #watchlistGrid, #liveSearchResults, .filmography, .people-row');
    if (img.matches('.detail-poster, .person-profile, .detail-backdrop, .tmdb-result img')) {
      img.loading = 'eager';
      if (img.matches('.detail-poster, .person-profile')) img.fetchPriority = 'high';
      return;
    }
    if (card && grid) {
      const siblings = Array.from(grid.children).filter(node => node.matches('.media-card, .person-card'));
      const index = siblings.indexOf(card);
      const eagerCount = grid.id === 'homeMovies' ? 6 : (grid.id === 'liveSearchResults' ? 3 : (grid.id && grid.id.startsWith('home') ? 3 : 6));
      img.loading = index >= 0 && index < eagerCount ? 'eager' : 'lazy';
      if (index >= 0 && index < 2) img.fetchPriority = 'high';
      else img.fetchPriority = 'auto';
    } else {
      img.loading = 'lazy';
    }
  }

  function prepareImage(img) {
    if (!(img instanceof HTMLImageElement) || img.id === 'posterImg') return;
    if (!img.getAttribute('src') && !img.getAttribute('srcset')) return;
    img.decoding = 'async';
    prioritizeImage(img);
    if (img.dataset.cinevaImagePrepared !== 'true') {
      img.dataset.cinevaImagePrepared = 'true';
      if (isDirectLoadingImage(img)) {
        img.classList.add('cineva-direct-image', 'cineva-image-pending');
      } else {
        const frame = img.parentElement;
        if (frame && (frame.matches('.poster-wrap, .person-card > span') || frame.classList.contains('poster-wrap'))) {
          frame.classList.add('cineva-image-frame', 'cineva-image-loading');
          frame.setAttribute('aria-busy', 'true');
          img.classList.add('cineva-image-pending');
        } else {
          img.classList.add('cineva-direct-image', 'cineva-image-pending');
        }
      }
    }
    if (img.complete) {
      if (img.naturalWidth > 0) finishImageLoading(img);
      else if (img.currentSrc || img.src) handleImageLoadError(img);
    }
  }

  function finishImageLoading(img) {
    if (!(img instanceof HTMLImageElement) || img.id === 'posterImg' || !img.isConnected) return;
    img.classList.remove('cineva-image-pending');
    img.classList.add('cineva-image-loaded');
    const frame = img.parentElement;
    if (frame && frame.classList.contains('cineva-image-frame')) {
      frame.classList.remove('cineva-image-loading');
      frame.classList.add('cineva-image-loaded');
      frame.setAttribute('aria-busy', 'false');
    }
  }

  function handleImageLoadError(img) {
    if (!(img instanceof HTMLImageElement) || img.id === 'posterImg' || !img.isConnected) return;
    // TMDB search results already have a dedicated inline fallback.
    if (img.matches('.tmdb-result img')) {
      const frame = img.parentElement;
      if (frame) { frame.classList.remove('cineva-image-loading'); frame.classList.add('cineva-image-error'); frame.setAttribute('aria-busy', 'false'); }
      return;
    }
    if (img.classList.contains('cineva-image-error-handled')) return;
    img.classList.add('cineva-image-error-handled');
    const frame = img.parentElement;
    if (frame && frame.classList.contains('cineva-image-frame')) {
      frame.classList.remove('cineva-image-loading', 'cineva-image-loaded');
      frame.classList.add('cineva-image-error');
      frame.setAttribute('aria-busy', 'false');
    }

    if (img.classList.contains('detail-backdrop')) {
      img.remove();
      return;
    }

    const fallback = document.createElement(img.matches('.detail-poster, .person-profile') ? 'div' : 'span');
    if (img.classList.contains('detail-poster')) {
      fallback.className = 'detail-poster';
      fallback.textContent = 'CINEVA';
      fallback.style.cssText = 'display:grid;place-items:center;color:#8c96ac';
    } else if (img.classList.contains('person-profile')) {
      fallback.className = 'person-profile';
      fallback.textContent = 'CINEVA';
      fallback.style.cssText = 'display:grid;place-items:center;color:#8c96ac';
    } else if (frame && frame.classList.contains('poster-wrap')) {
      fallback.className = 'no-poster';
      const card = img.closest('.media-card');
      fallback.innerHTML = `CINEVA<br>${card && card.dataset.openType === 'person' ? 'PERSON' : 'CINEMA'}`;
    } else if (img.closest('.person-card')) {
      fallback.className = 'person-photo-empty';
      fallback.textContent = 'CINEVA';
    } else {
      fallback.className = 'no-poster';
      fallback.textContent = 'CINEVA';
    }
    img.replaceWith(fallback);
  }

  function watchForImageChanges(root) {
    if (!root) return;
    if (typeof HTMLImageElement !== 'undefined' && root instanceof HTMLImageElement) prepareImage(root);
    if (root.querySelectorAll) root.querySelectorAll('img').forEach(prepareImage);
  }

  // Capturing listeners also cover images created later with innerHTML.
  document.addEventListener('load', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.id === 'posterImg') return;
    prepareImage(img);
    const reveal = () => finishImageLoading(img);
    if (typeof img.decode === 'function') img.decode().then(reveal).catch(() => {
      if (img.naturalWidth > 0) reveal();
    });
    else reveal();
  }, true);
  document.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.id === 'posterImg') return;
    prepareImage(img);
    handleImageLoadError(img);
  }, true);

  watchForImageChanges(document);
  const imageObserver = new MutationObserver(records => {
    for (const record of records) {
      record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) watchForImageChanges(node);
      });
    }
  });
  imageObserver.observe(document.body, {childList:true, subtree:true});

  // First-run API setup: each provider is optional; empty fields disable that source.
  function openApiWelcomeIfNeeded(){
    const overlay = byId('apiWelcomeOverlay');
    if (!overlay) return true;
    if (isApiSetupComplete()) { overlay.hidden = true; return true; }
    byId('welcomeTmdbKey').value = getTmdbKey();
    byId('welcomeKpKey').value = getKpKey();
    overlay.hidden = false;
    return false;
  }
  function finishApiWelcome(manualOnly=false){
    const tmdb = manualOnly ? '' : byId('welcomeTmdbKey').value.trim();
    const kp = manualOnly ? '' : byId('welcomeKpKey').value.trim();
    saveApiKeys(tmdb, kp);
    byId('apiWelcomeOverlay').hidden = true;
    loadHomeShelves(true);
    if (tmdb || kp) showToast('Настройки источников сохранены в браузере.', 'success');
    else showToast('Работаем без API. Оценивание доступно через ручной ввод.', 'info', 4200);
  }
  byId('apiWelcomeSaveBtn')?.addEventListener('click', () => finishApiWelcome(false));
  byId('apiWelcomeManualBtn')?.addEventListener('click', () => finishApiWelcome(true));
  ['welcomeTmdbKey','welcomeKpKey'].forEach(id => byId(id)?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); finishApiWelcome(false); }
  }));

  // ==========================================
  // UNIFIED SEARCH FOR RATING & TIERLIST
  // ==========================================
  async function searchUnifiedMedia(rawQuery, mode='multi', signal) {
    const query = String(rawQuery || '').trim().replace(/\s+/g, ' ');
    if (query.length < 2) return { results: [], suggestion: null };

    const cacheKey = `${mode}:${query.toLowerCase()}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    const suggestion = detectGoogleCorrection(query);
    let effectiveQuery = (suggestion && suggestion.type === 'layout') ? suggestion.corrected : query;
    let wasAutoCorrected = Boolean(suggestion && suggestion.type === 'layout');

    let tmdbResults = [], kp = { results: [], error: null };
    try {
      try { tmdbResults = await searchTmdbGlobal(effectiveQuery, mode, signal); } catch (_) {}
      if (mode !== 'person') {
        try { kp = await getKpMatches(effectiveQuery, mode, signal); } catch (_) {}
      }

      if (!tmdbResults.length && !kp.results.length && suggestion && effectiveQuery === query) {
        effectiveQuery = suggestion.corrected;
        wasAutoCorrected = true;
        try { tmdbResults = await searchTmdbGlobal(effectiveQuery, mode, signal); } catch (_) {}
        if (mode !== 'person') {
          try { kp = await getKpMatches(effectiveQuery, mode, signal); } catch (_) {}
        }
      }

      const merged = [];
      const seen = new Set();
      for (const item of tmdbResults) {
        if (item.media_type === 'person') continue;
        const kpMatch = matchKpToTmdb(item, kp.results);
        const normalized = {
          ...item,
          ratingTmdb: Number(item.vote_average || item.ratingTmdb || 0),
          ratingKinopoisk: kpMatch ? Number(kpMatch.ratingKinopoisk || 0) : 0,
          kinopoiskId: kpMatch ? kpMatch.id : ''
        };
        const k = item.media_type + ':' + item.id;
        if (!seen.has(k)) { seen.add(k); merged.push(normalized); }
      }
      for (const kpItem of kp.results) {
        const duplicate = tmdbResults.some(t => t.media_type === kpItem.media_type && matchKpToTmdb(t, [kpItem]));
        const k = 'kp:' + kpItem.id;
        if (!duplicate && !seen.has(k)) { seen.add(k); merged.push(kpItem); }
      }

      const results = merged.slice(0, 30);
      const resObj = { results, suggestion, wasAutoCorrected };
      searchCache.set(cacheKey, resObj);
      return resObj;
    } catch (_) {
      return { results: [], suggestion: null };
    }
  }

  // Unified bridge for Rating page search
  const ratingQueryInput = byId('tmdbQuery');
  const ratingStatusEl = byId('tmdbStatus');
  const ratingResultsEl = byId('tmdbResults');
  let ratingBridgeDebounce = null;
  let ratingBridgeController = null;

  async function runRatingUnifiedSearch(query) {
    if (ratingBridgeController) ratingBridgeController.abort();
    ratingBridgeController = new AbortController();
    if (ratingStatusEl) ratingStatusEl.textContent = 'Ищем в единой базе TMDB и Кинопоиска…';

    const { results, suggestion } = await searchUnifiedMedia(query, 'multi', ratingBridgeController.signal);
    if (!results.length) {
      if (ratingStatusEl) ratingStatusEl.textContent = 'Совпадений не найдено. Попробуйте ручной ввод.';
      if (ratingResultsEl) ratingResultsEl.innerHTML = '';
      return;
    }

    if (ratingStatusEl) {
      let statusText = `Найдено вариантов: ${results.length}.`;
      if (suggestion) statusText += ` (Возможно, имелось в виду «${suggestion.corrected}»)`;
      ratingStatusEl.textContent = statusText;
    }

    // Set tmdbSearchResults for selectTmdbResult
    if (typeof tmdbSearchResults !== 'undefined') {
      window.tmdbSearchResults = results.map(r => ({
        ...r,
        nameRu: r.title || r.name || r.nameRu || '',
        nameEn: r.original_title || r.original_name || r.nameEn || '',
        year: releaseYear(r),
        posterUrl: r.posterUrl || posterUrl(r.poster_path, 'w500'),
        posterUrlPreview: r.posterUrlPreview || r.posterUrl || posterUrl(r.poster_path, 'w185')
      }));
      if (typeof renderTmdbResults === 'function') {
        renderTmdbResults(window.tmdbSearchResults);
      }
    }
  }

  if (ratingQueryInput) {
    ratingQueryInput.addEventListener('input', () => {
      clearTimeout(ratingBridgeDebounce);
      const q = ratingQueryInput.value.trim();
      if (q.length >= 2) {
        ratingBridgeDebounce = setTimeout(() => runRatingUnifiedSearch(q), 320);
      }
    });
  }

  // ==========================================

  // URL Auto-Routing on startup (for deep links)
  function checkUrlRouting() {
    try {
      const params = new URLSearchParams(window.location.search);
      const openType = params.get('open') || params.get('type') || (params.has('movie') ? 'movie' : null) || (params.has('tv') ? 'tv' : null);
      const openId = params.get('id') || params.get('movie') || params.get('tv');
      const source = params.get('source') || 'tmdb';
      const searchQuery = params.get('search') || params.get('q');
      const pageParam = params.get('page');
      const defaultPage = (document.body && document.body.dataset.defaultPage) ? document.body.dataset.defaultPage : null;

      if (openType && openId) {
        if (source === 'kinopoisk') openKinopoiskTitle(openId);
        else if (openType === 'person') openPerson(openId);
        else openTitle(openId, openType);
      } else if (searchQuery) {
        goToSearch('multi', searchQuery);
      } else if (pageParam && pageIds[pageParam]) {
        showPage(pageParam);
      } else if (defaultPage && pageIds[defaultPage]) {
        showPage(defaultPage);
      }
    } catch (_) {}
  }

  // Initialize Tier List Storage & URL routing
  if (typeof window.loadTierListStorage === 'function') window.loadTierListStorage();
  checkUrlRouting();
  if (typeof window.checkSharedTierFromUrl === 'function') window.checkSharedTierFromUrl();
  if (typeof window.checkSharedRatingFromUrl === 'function') window.checkSharedRatingFromUrl();

  // Initial load waits until the first-run source choice has been made.
  updateWatchlistCount();
  if (openApiWelcomeIfNeeded()) loadHomeShelves();

  // Expose helpers globally
  window.showPage = showPage;
  window.openTitle = openTitle;
  window.openPerson = openPerson;
  window.openKinopoiskTitle = openKinopoiskTitle;
  window.getWatchlist = getWatchlist;
})();
