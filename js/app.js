/* === CINEVA CORE APPLICATION & ROUTER === */
(() => {
  const byId = id => document.getElementById(id);
  const $ = byId;
  window.$ = $;
  window.byId = byId;

  // Safe string escaping for HTML
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const posterUrl = (path, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : '';
  const ratingText = value => value && Number(value) > 0 ? Number(value).toFixed(1) : '—';
  const releaseYear = item => String((item.release_date || item.first_air_date || item.releaseDate || item.year || '').slice(0, 4));
  const titleYear = item => String(item.release_date || item.first_air_date || item.year || '').slice(0, 4);
  const titleName = item => item.title || item.name || item.original_title || item.original_name || item.nameRu || item.nameEn || item.nameOriginal || '';

  // Current page detection from body attribute
  const currentPageKey = document.body ? (document.body.dataset.page || 'home') : 'home';

  // Global search state
  let activeSearchMode = 'multi';
  let liveSearchTimer = null;
  let lastSearchQuery = '';
  let lastSearchItems = [];
  let currentDetail = null;
  let searchCounter = 0;
  let previousView = null;

  // In-memory cache for search queries
  const searchCache = new Map();

  // ==========================================
  // MULTI-LAYER STORAGE ADAPTER
  // (localStorage + sessionStorage + window.name + memory)
  // Ensures 100% persistence on file:/// in all browsers (Chrome, Firefox, Edge, Safari)
  // ==========================================
  const inMemoryStore = {};

  function getStoredValue(key) {
    // 1. Check in-memory store
    if (inMemoryStore[key]) return inMemoryStore[key];

    // 2. Check localStorage
    try {
      const v = localStorage.getItem(key);
      if (v !== null && v !== undefined && v !== '') {
        const val = String(v).trim();
        inMemoryStore[key] = val;
        return val;
      }
    } catch (_) {}

    // 3. Check sessionStorage
    try {
      const v = sessionStorage.getItem(key);
      if (v !== null && v !== undefined && v !== '') {
        const val = String(v).trim();
        inMemoryStore[key] = val;
        return val;
      }
    } catch (_) {}

    // 4. Check window.name (guaranteed cross-page persistence on file:/// across all origins in same tab)
    try {
      if (window.name && window.name.startsWith('{') && window.name.endsWith('}')) {
        const parsed = JSON.parse(window.name);
        if (parsed && parsed[key] !== undefined && parsed[key] !== '') {
          const val = String(parsed[key]).trim();
          inMemoryStore[key] = val;
          return val;
        }
      }
    } catch (_) {}

    return '';
  }

  function setStoredValue(key, value) {
    const str = String(value || '').trim();
    if (str) inMemoryStore[key] = str;
    else delete inMemoryStore[key];

    // 1. localStorage
    try {
      if (str) localStorage.setItem(key, str);
      else localStorage.removeItem(key);
    } catch (_) {}

    // 2. sessionStorage
    try {
      if (str) sessionStorage.setItem(key, str);
      else sessionStorage.removeItem(key);
    } catch (_) {}

    // 3. window.name (JSON bundle for tab persistence)
    try {
      let store = {};
      if (window.name && window.name.startsWith('{') && window.name.endsWith('}')) {
        try { store = JSON.parse(window.name); } catch (_) {}
      }
      if (str) store[key] = str;
      else delete store[key];
      window.name = JSON.stringify(store);
    } catch (_) {}
  }

  // API KEYS MANAGEMENT
  const KINOPOISK_BASE = 'https://kinopoiskapiunofficial.tech/api';

  function getTmdbKey() {
    return getStoredValue('cineva_tmdb_key');
  }

  function getKpKey() {
    return getStoredValue('cineva_kp_key');
  }

  function isApiSetupComplete() {
    return getStoredValue('cineva_api_setup_complete') === 'true';
  }

  function saveApiKeys(tmdbValue, kpValue) {
    const cleanTmdb = String(tmdbValue || '').trim().replace(/^["']|["']$/g, '');
    const cleanKp = String(kpValue || '').trim().replace(/^["']|["']$/g, '');

    setStoredValue('cineva_tmdb_key', cleanTmdb);
    setStoredValue('cineva_kp_key', cleanKp);
    setStoredValue('cineva_api_setup_complete', 'true');

    updateApiStatusBadges();

    // Notify other components/tabs
    try {
      window.dispatchEvent(new CustomEvent('cineva-keys-updated', { detail: { tmdb: cleanTmdb, kp: cleanKp } }));
    } catch (_) {}
  }

  function updateApiStatusBadges() {
    const tmdb = getTmdbKey();
    const kp = getKpKey();
    const settingsBtn = byId('settingsBtn');
    if (settingsBtn) {
      if (tmdb || kp) {
        settingsBtn.title = 'Настройки API (источники подключены)';
        settingsBtn.innerHTML = '⚙️ Настройки API';
        settingsBtn.classList.remove('primary');
      } else {
        settingsBtn.title = 'Настройки API (источники не подключены)';
        settingsBtn.innerHTML = '⚙️ Ключи API';
      }
    }
  }

  // ==========================================
  // TOAST NOTIFICATIONS
  // ==========================================
  function showToast(msg, type = 'info', duration = 3200) {
    let container = byId('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    t.innerHTML = `<span class="toast-icon">${icon}</span><span>${safe(msg)}</span>`;
    container.appendChild(t);
    const close = () => {
      t.classList.add('hiding');
      setTimeout(() => t.remove(), 320);
    };
    t.addEventListener('click', close);
    setTimeout(close, duration);
  }

  // ==========================================
  // WATCHLIST STORAGE & UI
  // ==========================================
  function getWatchlist() {
    const raw = getStoredValue('cineva_watchlist');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
    return [];
  }

  function saveWatchlist(list) {
    const arr = Array.isArray(list) ? list : [];
    setStoredValue('cineva_watchlist', JSON.stringify(arr));
    if (window.CINEVA_ACCOUNT && typeof window.CINEVA_ACCOUNT.getAccount === 'function' && typeof window.CINEVA_ACCOUNT.saveAccount === 'function') {
      try {
        const acc = window.CINEVA_ACCOUNT.getAccount();
        acc.watchlist = arr;
        window.CINEVA_ACCOUNT.saveAccount(acc);
      } catch (_) {}
    }
    updateWatchlistCount();
    return true;
  }

  function sourceOf(item) { return item.source || 'tmdb'; }

  function isInWatchlist(id, type, source = '') {
    return getWatchlist().some(item =>
      String(item.id) === String(id) &&
      (item.media_type || item.type) === type &&
      (!source || sourceOf(item) === source)
    );
  }

  function toggleWatchlist(item, type) {
    let list = getWatchlist();
    const mediaType = item.media_type || type || 'movie';
    const id = String(item.id || item.kinopoiskId || '');
    const source = sourceOf(item);
    if (!id) {
      showToast('Не удалось определить ID произведения.', 'error');
      return;
    }
    const exists = list.some(x => String(x.id) === id && (x.media_type || x.type) === mediaType && sourceOf(x) === source);
    let notice = '';
    let noticeType = 'success';

    if (exists) {
      list = list.filter(x => !(String(x.id) === id && (x.media_type || x.type) === mediaType && sourceOf(x) === source));
      notice = 'Удалено из избранного';
      noticeType = 'info';
      if (window.CinevaAPI && window.CinevaAPI.isOnline && window.CinevaAPI.token) {
        window.CinevaAPI.removeFromWatchlist(id, mediaType).catch(() => {});
      }
    } else {
      const title = item.title || item.name || item.nameRu || 'Без названия';
      const poster = item.poster || (item.poster_path ? posterUrl(item.poster_path, 'w500') : (item.posterUrl || item.posterUrlPreview || ''));
      const addedItem = {
        id, media_type: mediaType, title, year: releaseYear(item), poster,
        poster_path: item.poster_path || '', posterUrl: item.posterUrl || '',
        ratingTmdb: item.ratingTmdb || item.vote_average || 0,
        ratingKinopoisk: item.ratingKinopoisk || 0, source
      };
      list.unshift(addedItem);
      notice = `«${title}» добавлено в избранное`;
      if (window.CinevaAPI && window.CinevaAPI.isOnline && window.CinevaAPI.token) {
        window.CinevaAPI.addToWatchlist(addedItem).catch(() => {});
      }
    }

    saveWatchlist(list);
    showToast(notice, noticeType);
    if (currentPageKey === 'watchlist') updateWatchlistUI();

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
    const navBadge = byId('navWatchlistCount');
    if (navBadge) navBadge.textContent = String(list.length);
    if (window.CINEVA_ACCOUNT && typeof window.CINEVA_ACCOUNT.updateNavProfileBadge === 'function') {
      window.CINEVA_ACCOUNT.updateNavProfileBadge();
    }
  }

  function updateWatchlistUI() {
    updateWatchlistCount();
    if (window.CINEVA_ACCOUNT && typeof window.CINEVA_ACCOUNT.renderProfilePage === 'function' && document.body.dataset.page === 'profile') {
      window.CINEVA_ACCOUNT.renderProfilePage();
    }
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

  // ==========================================
  // FETCH UTILITIES (TMDB & KINOPOISK)
  // ==========================================
  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const parentSignal = options.signal;
    const relayAbort = () => controller.abort();
    if (parentSignal) {
      if (parentSignal.aborted) controller.abort();
      else parentSignal.addEventListener('abort', relayAbort, { once: true });
    }
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch (_) {}
        throw new Error(`HTTP ${response.status}${detail ? ' — ' + detail.slice(0, 120) : ''}`);
      }
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted && !parentSignal?.aborted) {
        throw new Error(`Превышено время ожидания ответа API (${Math.round(timeoutMs / 1000)} сек.).`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener('abort', relayAbort);
    }
  }

  async function tmdbFetch(path, signal, timeoutMs = 10000, keyOverride = null) {
    const key = (keyOverride || getTmdbKey()).trim();
    if (!key) throw new Error('Ключ TMDB не задан.');
    const headers = { accept: 'application/json' };
    let url = 'https://api.themoviedb.org/3' + path;
    if (key.length > 100) headers.Authorization = 'Bearer ' + key;
    else url += (url.includes('?') ? '&' : '?') + 'api_key=' + encodeURIComponent(key);
    return fetchJsonWithTimeout(url, { headers, signal }, timeoutMs);
  }

  async function kpFetch(path, signal, timeoutMs = 10000, keyOverride = null) {
    const key = (keyOverride || getKpKey()).trim();
    if (!key) throw new Error('Ключ Кинопоиска не задан.');
    return fetchJsonWithTimeout(KINOPOISK_BASE + path, {
      headers: { 'X-API-KEY': key, 'Accept': 'application/json' },
      signal
    }, timeoutMs);
  }

  function normalizeTmdb(item) {
    const isTv = item.media_type === 'tv' || item.media_type === 'TV';
    return {
      source: 'tmdb',
      id: item.id,
      media_type: isTv ? 'tv' : 'movie',
      type: isTv ? 'TV_SERIES' : 'FILM',
      nameRu: item.title || item.name || item.original_title || item.original_name || '',
      nameEn: item.original_title || item.original_name || '',
      nameOriginal: item.original_title || item.original_name || '',
      year: String((item.release_date || item.first_air_date || '').slice(0, 4) || ''),
      posterUrl: item.poster_path ? posterUrl(item.poster_path, 'w500') : '',
      posterUrlPreview: item.poster_path ? posterUrl(item.poster_path, 'w185') : '',
      ratingTmdb: item.vote_average || 0,
      voteCountTmdb: item.vote_count || 0
    };
  }

  function normalizeKpGlobal(item) {
    const kpId = item.filmId || item.kinopoiskId || item.film_id || item.id;
    const isTv = ['TV_SERIES', 'MINI_SERIES', 'TV_MINI_SERIES', 'TV_SHOW'].includes(item.type);
    return {
      source: 'kinopoisk',
      id: String(kpId || ''),
      kinopoiskId: String(kpId || ''),
      media_type: isTv ? 'tv' : 'movie',
      title: item.nameRu || item.name || item.nameEn || item.nameOriginal || 'Без названия',
      name: item.nameRu || item.name || item.nameEn || item.nameOriginal || 'Без названия',
      original_title: item.nameOriginal || item.nameEn || '',
      release_date: String(item.year || ''),
      year: String(item.year || ''),
      posterUrl: item.posterUrl || '',
      posterUrlPreview: item.posterUrlPreview || '',
      ratingKinopoisk: Number(item.ratingKinopoisk || item.rating || 0),
      vote_average: 0,
      vote_count: Number(item.ratingKinopoiskVoteCount || item.ratingVoteCount || 0)
    };
  }

  // ==========================================
  // TEXT & SEARCH NORMALIZATION ALGORITHMS
  // ==========================================
  function normalizeSearchText(value) {
    if (!value) return '';
    return String(value)
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/[éèêë]/g, 'e').replace(/[àáâãäå]/g, 'a').replace(/[óòôõö]/g, 'o').replace(/[íìîï]/g, 'i').replace(/[úùûü]/g, 'u').replace(/ç/g, 'c')
      .replace(/[^0-9a-zа-яё]+/giu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function switchKeyboardLayout(value) {
    const en = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./';
    const ru = 'ёйцукенгшщзхъфывапролджэячсмитьбю.';
    const chars = Array.from(String(value || ''));
    return chars.map(char => {
      const lower = char.toLocaleLowerCase();
      let i = ru.indexOf(lower);
      if (i >= 0) {
        const converted = en[i] || char;
        return char !== lower ? converted.toLocaleUpperCase() : converted;
      }
      i = en.indexOf(lower);
      if (i >= 0) {
        const converted = ru[i] || char;
        return char !== lower ? converted.toLocaleUpperCase() : converted;
      }
      return char;
    }).join('');
  }

  function titleMatchScore(query, item) {
    const q = normalizeSearchText(query);
    if (!q) return 0;
    const names = [item.nameRu, item.nameEn, item.nameOriginal, item.title, item.name].filter(Boolean).map(normalizeSearchText);
    let best = 0;
    for (const name of names) {
      if (!name) continue;
      if (name === q) best = Math.max(best, 1);
      else if (name.startsWith(q) || q.startsWith(name)) best = Math.max(best, 0.88);
      else if (name.includes(q) || q.includes(name)) best = Math.max(best, 0.78);
      const qt = q.split(' ').filter(Boolean);
      const nt = name.split(' ').filter(Boolean);
      if (qt.length && nt.length) {
        const overlap = qt.filter(t => nt.some(n => n === t || n.includes(t) || t.includes(n))).length / qt.length;
        best = Math.max(best, overlap * 0.72);
      }
      if (q.length >= 5 && name.length >= 5 && Math.abs(name.length - q.length) <= 3) {
        let prev = Array.from({ length: name.length + 1 }, (_, i) => i);
        for (let i = 1; i <= q.length; i++) {
          const curr = [i];
          for (let j = 1; j <= name.length; j++) {
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + (q[i - 1] === name[j - 1] ? 0 : 1));
          }
          prev = curr;
        }
        best = Math.max(best, 1 - prev[name.length] / Math.max(q.length, name.length));
      }
    }
    return best;
  }

  // ==========================================
  // ALGORITHMIC TYPO & STRING SIMILARITY (ZERO HARDCODED DICTIONARIES)
  // ==========================================
  function damerauLevenshtein(a, b) {
    const s1 = String(a || '');
    const s2 = String(b || '');
    const len1 = s1.length;
    const len2 = s2.length;
    if (!len1) return len2;
    if (!len2) return len1;

    const d = [];
    for (let i = 0; i <= len1; i++) d[i] = [i];
    for (let j = 0; j <= len2; j++) d[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,       // deletion
          d[i][j - 1] + 1,       // insertion
          d[i - 1][j - 1] + cost  // substitution
        );
        if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
        }
      }
    }
    return d[len1][len2];
  }

  function calcStringSimilarity(strA, strB) {
    const a = normalizeSearchText(strA);
    const b = normalizeSearchText(strB);
    if (!a || !b) return 0;
    if (a === b) return 1.0;
    if (a.startsWith(b) || b.startsWith(a)) return 0.92;
    if (a.includes(b) || b.includes(a)) return 0.85;

    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1.0;
    const dist = damerauLevenshtein(a, b);
    return Math.max(0, 1 - dist / maxLen);
  }

  function detectLayoutSuggestion(rawQuery) {
    const raw = String(rawQuery || '').trim();
    if (raw.length < 2) return null;
    const flipped = switchKeyboardLayout(raw).trim();
    if (!flipped || normalizeSearchText(flipped) === normalizeSearchText(raw)) return null;

    const hasLatin = /[a-z]/i.test(raw);
    const hasCyrillic = /[а-яё]/i.test(raw);
    if (hasLatin && !hasCyrillic) {
      return { type: 'layout', corrected: flipped, original: raw };
    }
    return null;
  }

  // ==========================================
  // SEARCH EXECUTION & AGGREGATION
  // ==========================================
  async function searchTmdbGlobal(query, mode, signal) {
    const path = mode === 'person' ? '/search/person' : mode === 'movie' ? '/search/movie' : mode === 'tv' ? '/search/tv' : '/search/multi';
    const data = await tmdbFetch(path + '?query=' + encodeURIComponent(query) + '&include_adult=false&language=ru-RU&page=1', signal, 9000);
    return (data.results || []).filter(item => mode === 'multi' ? ['movie', 'tv', 'person'].includes(item.media_type) : true)
      .map(item => ({
        ...item,
        source: 'tmdb',
        media_type: mode === 'person' ? 'person' : mode === 'movie' ? 'movie' : mode === 'tv' ? 'tv' : item.media_type
      }));
  }

  async function getKpMatches(query, mode, signal) {
    if (mode === 'person') return { results: [], error: null };
    try {
      const data = await kpFetch('/v2.1/films/search-by-keyword?keyword=' + encodeURIComponent(query) + '&page=1', signal, 8000);
      return {
        results: (data.films || data.items || data.results || []).map(normalizeKpGlobal).filter(x => x.id && (mode === 'multi' || x.media_type === mode)),
        error: null
      };
    } catch (error) {
      return { results: [], error: error.message || String(error) };
    }
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
      let score = titleMatchScore(name, { ...kp, nameRu: kp.title, nameEn: kp.original_title });
      const kpYear = titleYear(kp);
      if (year && kpYear) score += year === kpYear ? 0.12 : -0.15;
      if (score > bestScore) { bestScore = score; best = kp; }
    }
    return bestScore >= 0.78 ? best : null;
  }

  async function searchUnifiedMedia(rawQuery, mode = 'multi', signal) {
    const query = String(rawQuery || '').trim().replace(/\s+/g, ' ');
    if (query.length < 2) return { results: [] };

    const cacheKey = `${mode}:${query.toLowerCase()}`;
    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey);
    }

    let tmdbResults = [], kp = { results: [], error: null };
    try {
      try { tmdbResults = await searchTmdbGlobal(query, mode, signal); } catch (_) {}
      if (mode !== 'person') {
        try { kp = await getKpMatches(query, mode, signal); } catch (_) {}
      }

      const merged = [];
      const seen = new Set();
      for (const item of tmdbResults) {
        if (item.media_type === 'person') {
          const k = 'person:' + item.id;
          if (!seen.has(k)) { seen.add(k); merged.push(item); }
          continue;
        }
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
      if (mode !== 'person') {
        for (const kpItem of kp.results) {
          const duplicate = tmdbResults.some(t => t.media_type === kpItem.media_type && matchKpToTmdb(t, [kpItem]));
          const k = 'kp:' + kpItem.id;
          if (!duplicate && !seen.has(k)) { seen.add(k); merged.push(kpItem); }
        }
      }

      const results = merged.slice(0, 30);
      const resObj = { results };
      searchCache.set(cacheKey, resObj);
      return resObj;
    } catch (_) {
      return { results: [] };
    }
  }

  // ==========================================
  // CARDS & SKELETON RENDERING
  // ==========================================
  function renderSkeletons(targetId, count = 6) {
    const el = byId(targetId);
    if (!el) return;
    el.innerHTML = Array.from({ length: count }, () => `
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
    const metaText = person ? (item.known_for_department || 'Кино') : `${year || 'Год неизвестен'}${type === 'tv' ? ' · Сериал' : type === 'movie' ? ' · Фильм' : ''}${isKp ? ' · Кинопоиск' : ''}`;
    const id = String(item.id || item.kinopoiskId || '');

    return `<article class="media-card" role="button" tabindex="0" ${attrs} data-open-type="${safe(type)}" data-open-id="${safe(id)}" aria-label="Открыть ${safe(title)}"><span class="poster-wrap">${url ? `<img src="${safe(url)}" loading="lazy" alt="${alt}: ${safe(title)}">` : `<span class="no-poster">CINEVA<br>${person ? 'PERSON' : 'CINEMA'}</span>`}${metric}</span><span class="media-title">${safe(title)}</span><span class="media-meta">${safe(metaText)}</span></article>`;
  }

  function personCard(person, job = '') {
    const img = posterUrl(person.profile_path, 'w185');
    const name = person.name || 'Без имени';
    return `<button type="button" class="person-card" data-open-type="person" data-open-id="${safe(person.id)}"><span>${img ? `<img src="${safe(img)}" loading="lazy" alt="${safe(name)}">` : `<span class="person-photo-empty">CINEVA</span>`}</span><strong>${safe(name)}</strong><span>${safe(job || person.known_for_department || 'Кино')}</span></button>`;
  }

  function renderCast(people) {
    if (!people || !people.length) return '<div class="notice-card">Информация о составе пока недоступна.</div>';
    return `<div class="people-row">${people.slice(0, 12).map(p => personCard(p, p.character || (p.roles || []).map(r => r.character).filter(Boolean).join(', ') || p.known_for_department || 'Участник съёмочной группы')).join('')}</div>`;
  }

  function renderCrew(crew, isTv) {
    const names = (crew || []).filter(p => isTv ? ['Creator', 'Director', 'Executive Producer'].includes(p.job) : p.job === 'Director' || p.job === 'Writer' || p.job === 'Screenplay').slice(0, 10);
    if (!names.length) return '';
    return `<section class="detail-section"><h2>${isTv ? 'Создатели' : 'Режиссура и сценарий'}</h2><div class="people-row">${names.map(p => personCard(p, p.job)).join('')}</div></section>`;
  }

  // ==========================================
  // HOME SHELVES (INDEX.HTML)
  // ==========================================
  function setShelf(id, items, type) {
    const target = byId(id);
    if (!target) return;
    if (!items || !items.length) {
      target.innerHTML = `
        <div class="notice-card" style="grid-column:1/-1">
          <strong>Пока нет данных</strong>
          Не получилось загрузить подборку. Попробуйте поиск или проверьте ключи API.
          <div style="margin-top:10px">
            <button class="site-btn primary" type="button" data-open-settings>🔑 Настроить ключи API</button>
          </div>
        </div>
      `;
      return;
    }
    target.innerHTML = items.slice(0, 6).map(item => posterCard({ ...item, media_type: item.media_type || type }, type)).join('');
  }

  async function loadHomeShelves(force = false) {
    const markers = ['homeMovies', 'homeTv', 'homePeople'];
    if (!markers.some(id => byId(id))) return;
    if (!force && markers.every(id => byId(id)?.dataset.loaded === 'true')) return;

    if (!getTmdbKey() && !getKpKey()) {
      markers.forEach(id => {
        const el = byId(id);
        if (!el) return;
        el.dataset.loaded = 'true';
        el.innerHTML = `
          <div class="notice-card" style="grid-column:1/-1">
            <strong>Источники не подключены</strong>
            Для загрузки каталога и поиска подключите API-ключ TMDB или Кинопоиска (или оба). Оценивание также доступно в ручном режиме.
            <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
              <button class="site-btn primary" type="button" data-open-settings>🔑 Ввести API-ключи</button>
              <a href="rating.html" class="site-btn" style="text-decoration:none">Оценить фильм вручную</a>
            </div>
          </div>
        `;
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
      let movieItems = (movies?.results || []).map(x => ({ ...x, source: 'tmdb', media_type: 'movie', ratingTmdb: Number(x.vote_average || 0) }));
      let tvItems = (tv?.results || []).map(x => ({ ...x, source: 'tmdb', media_type: 'tv', ratingTmdb: Number(x.vote_average || 0) }));

      if (!movieItems.length) {
        try {
          const fallback = await kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1');
          movieItems = (fallback.items || fallback.films || []).map(normalizeKpGlobal);
        } catch (_) {}
      }
      if (!tvItems.length) {
        try {
          const fallback = await kpFetch('/v2.2/films/collections?type=POPULAR_SERIES&page=1');
          tvItems = (fallback.items || fallback.films || []).map(normalizeKpGlobal).map(x => ({ ...x, media_type: 'tv' }));
        } catch (_) {}
      }

      setShelf('homeMovies', movieItems, 'movie');
      setShelf('homeTv', tvItems, 'tv');
      setShelf('homePeople', (people?.results || []).map(x => ({ ...x, source: 'tmdb', media_type: 'person' })), 'person');
      markers.forEach(id => { const el = byId(id); if (el) el.dataset.loaded = 'true'; });

      // Enrich ratings with second provider in background
      if (movieItems.length || tvItems.length) {
        Promise.all([
          kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1').catch(() => null),
          kpFetch('/v2.2/films/collections?type=POPULAR_SERIES&page=1').catch(() => null)
        ]).then(([kpMovies, kpTv]) => {
          if (byId('homeMovies')?.dataset.loaded !== 'true') return;
          const kpMovieItems = (kpMovies?.items || kpMovies?.films || []).map(normalizeKpGlobal).map(x => ({ ...x, media_type: 'movie' }));
          const kpTvItems = (kpTv?.items || kpTv?.films || []).map(normalizeKpGlobal).map(x => ({ ...x, media_type: 'tv' }));

          const enrich = (tmdbItems, kpList, containerId, type) => {
            const grid = byId(containerId);
            if (!grid) return;
            tmdbItems.forEach(item => {
              const title = titleName(item);
              const year = titleYear(item);
              const match = kpList.map(k => ({ item: k, score: titleMatchScore(title, k) + (year && k.year ? (year === k.year ? 0.12 : -0.15) : 0) }))
                .filter(x => x.score >= 0.78).sort((a, b) => b.score - a.score)[0]?.item;
              if (!match) return;
              item.ratingKinopoisk = Number(match.ratingKinopoisk || 0);
              item.kinopoiskId = match.id;
              const card = [...grid.querySelectorAll('.media-card')].find(el => el.dataset.openType === type && el.dataset.openId === String(item.id));
              if (!card) return;
              let chip = card.querySelector('.media-rating');
              if (!chip) {
                chip = document.createElement('span');
                chip.className = 'media-rating';
                card.querySelector('.poster-wrap')?.appendChild(chip);
              }
              const scores = [];
              if (Number(item.ratingTmdb || item.vote_average) > 0) scores.push('TMDB ' + ratingText(item.ratingTmdb || item.vote_average));
              if (item.ratingKinopoisk > 0) scores.push('КП ' + ratingText(item.ratingKinopoisk));
              chip.textContent = scores.join(' · ');
            });
          };
          enrich(movieItems, kpMovieItems, 'homeMovies', 'movie');
          enrich(tvItems, kpTvItems, 'homeTv', 'tv');
        }).catch(() => {});
      }
    } catch (_) {
      markers.forEach(id => {
        setShelf(id, [], 'movie');
        const el = byId(id);
        if (el) el.dataset.loaded = 'true';
      });
    }
  }

  // ==========================================
  // RANDOM MOVIE PICKER
  // ==========================================
  async function pickRandomMovie() {
    showToast('Выбираем случайный фильм…', 'info', 1800);
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

  // ==========================================
  // SEARCH PAGE EXECUTION (SEARCH.HTML)
  // ==========================================
  async function runGlobalSearch(rawQuery, mode = activeSearchMode) {
    const query = String(rawQuery || '').trim().replace(/\s+/g, ' ');
    activeSearchMode = mode;
    lastSearchQuery = query;

    if (currentPageKey !== 'search') {
      window.location.href = `search.html?q=${encodeURIComponent(query)}&mode=${encodeURIComponent(mode)}`;
      return;
    }

    if (byId('globalSearchInput')) byId('globalSearchInput').value = query;
    if (byId('pageSearchInput')) byId('pageSearchInput').value = query;

    if (query.length < 2) {
      if (byId('searchStatus')) byId('searchStatus').textContent = 'Введи хотя бы два символа.';
      if (byId('searchResults')) byId('searchResults').innerHTML = '';
      return;
    }

    if (!getTmdbKey() && !getKpKey()) {
      if (byId('searchStatus')) byId('searchStatus').textContent = 'Источники отключены.';
      if (byId('searchResults')) {
        byId('searchResults').innerHTML = `
          <div class="notice-card" style="grid-column:1/-1">
            <strong>API-ключи не найдены</strong>
            Для поиска по каталогу необходимо подключить TMDB или Кинопоиск.
            <div style="margin-top:12px">
              <button class="site-btn primary" type="button" data-open-settings>🔑 Настроить ключи API</button>
            </div>
          </div>
        `;
      }
      return;
    }

    const token = ++searchCounter;
    renderSkeletons('searchResults', 10);
    if (byId('searchStatus')) {
      byId('searchStatus').textContent = mode === 'person' ? 'Ищем людей в TMDB…' : 'Ищем в TMDB и Кинопоиске…';
    }

    try {
      const u = new URL(window.location.href);
      u.searchParams.set('q', query);
      u.searchParams.set('mode', mode);
      window.history.replaceState(null, '', u.toString());
    } catch (_) {}

    const { results } = await searchUnifiedMedia(query, mode);
    if (token !== searchCounter) return;

    lastSearchItems = results || [];

    const resultsGrid = byId('searchResults');
    const searchStatus = byId('searchStatus');

    if (results && results.length) {
      if (resultsGrid) {
        resultsGrid.innerHTML = results.map(item => posterCard(item, mode === 'movie' ? 'movie' : mode === 'tv' ? 'tv' : mode === 'person' ? 'person' : 'multi')).join('');
      }
      if (searchStatus) searchStatus.textContent = `Найдено результатов: ${results.length}.`;
    } else {
      if (searchStatus) searchStatus.textContent = 'Ничего не найдено. Попробуй другое написание или оригинальное название.';
      if (resultsGrid) {
        resultsGrid.innerHTML = '<div class="notice-card" style="grid-column:1/-1"><strong>Совпадений нет</strong>Попробуйте ввести оригинальное название на английском или проверить опечатки.</div>';
      }
    }
  }

  // ==========================================
  // DETAIL VIEW & DEEP ROUTING
  // ==========================================
  function showDetailContainer() {
    const detailEl = byId('page-detail');
    if (!detailEl) return false;

    const mainSection = document.querySelector('.site-page:not(#page-detail)');
    if (mainSection && mainSection.style.display !== 'none') {
      previousView = mainSection;
      mainSection.style.display = 'none';
    }
    detailEl.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }

  function closeDetail() {
    const detailEl = byId('page-detail');
    if (detailEl) detailEl.style.display = 'none';
    if (previousView) {
      previousView.style.display = 'block';
      previousView = null;
    } else {
      const mainSection = document.querySelector('.site-page:not(#page-detail)');
      if (mainSection) mainSection.style.display = 'block';
    }
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('open');
      u.searchParams.delete('id');
      u.searchParams.delete('source');
      window.history.pushState(null, '', u.toString());
    } catch (_) {}
  }

  async function openTitle(id, type = 'movie') {
    if (!byId('page-detail')) {
      window.location.href = `search.html?open=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
      return;
    }

    showDetailContainer();
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем карточку…</strong>Собираем описание, рейтинги и съёмочную группу.</div>';

    try {
      const u = new URL(window.location.href);
      u.searchParams.set('open', type);
      u.searchParams.set('id', id);
      window.history.pushState(null, '', u.toString());
    } catch (_) {}

    try {
      const base = type === 'tv' ? '/tv/' : '/movie/';
      const [d, c, v] = await Promise.all([
        tmdbFetch(base + encodeURIComponent(id) + '?language=ru-RU'),
        tmdbFetch(base + encodeURIComponent(id) + (type === 'tv' ? '/aggregate_credits' : '/credits') + '?language=ru-RU').catch(() => ({ cast: [], crew: [] })),
        tmdbFetch(base + encodeURIComponent(id) + '/videos?language=ru-RU').catch(() => ({ results: [] }))
      ]);

      let kpMatch = null;
      try {
        const kpr = await getKpMatches(d.title || d.name || d.original_title || d.original_name || '', type, new AbortController().signal);
        kpMatch = matchKpToTmdb({ ...d, media_type: type }, kpr.results);
      } catch (_) {}

      d.ratingKinopoisk = Number(kpMatch?.ratingKinopoisk || 0);
      d.kinopoiskId = kpMatch?.id || '';
      currentDetail = { source: 'tmdb', kind: type, id: String(id), details: d, credits: c };

      const title = d.title || d.name || d.original_title || d.original_name || 'Без названия';
      const original = d.original_title || d.original_name || '';
      const date = d.release_date || d.first_air_date || '';
      const genres = (d.genres || []).map(g => g.name).filter(Boolean);
      const runtime = type === 'tv' ? (d.episode_run_time || [])[0] : d.runtime;
      const runtimeText = runtime ? `${runtime} мин.` : '';
      const poster = posterUrl(d.poster_path, 'w500');
      const backdrop = posterUrl(d.backdrop_path, 'w1280');
      const cast = c.cast || [];
      const crew = c.crew || [];
      const directors = type === 'tv' ? (d.created_by || []).map(p => p.name) : crew.filter(p => p.job === 'Director').map(p => p.name);
      const creatorsText = directors.slice(0, 4).join(', ');
      const video = (v.results || []).find(x => x.site === 'YouTube' && (x.type === 'Trailer' || x.type === 'Teaser'));
      const stats = [date.slice(0, 4), type === 'tv' ? 'Сериал' : 'Фильм', runtimeText, d.number_of_seasons ? `${d.number_of_seasons} сез.` : '', genres.join(' · ')].filter(Boolean);
      const companies = (d.production_companies || []).map(x => x.name).filter(Boolean).slice(0, 4).join(' · ');
      const countries = (d.production_countries || []).map(x => x.name).filter(Boolean).join(', ');
      const languages = (d.spoken_languages || []).map(x => x.english_name || x.name).filter(Boolean).join(', ');

      const inWatch = isInWatchlist(id, type, 'tmdb');

      byId('detailContent').innerHTML = `
        <section class="detail-top">${backdrop ? `<img class="detail-backdrop" src="${safe(backdrop)}" alt="">` : ''}<div class="detail-main">
          ${poster ? `<img class="detail-poster" src="${safe(poster)}" alt="Постер: ${safe(title)}">` : '<div class="detail-poster" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}
          <div class="detail-copy"><div class="eyebrow">${type === 'tv' ? 'CINEVA · СЕРИАЛ' : 'CINEVA · ФИЛЬМ'}</div><h1>${safe(title)}${date ? ` <span style="font-size:.55em;color:#a5b0c5">(${safe(date.slice(0, 4))})</span>` : ''}</h1>${original && original !== title ? `<div class="detail-original">${safe(original)}</div>` : ''}${d.tagline ? `<div class="detail-tagline">«${safe(d.tagline)}»</div>` : ''}
          <div class="detail-meta">${stats.map(s => `<span>${safe(s)}</span>`).join('')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <div class="detail-score"><strong>${ratingText(d.vote_average)}</strong><span>TMDB<br>${Number(d.vote_count || 0).toLocaleString('ru-RU')} голосов</span></div>
            <div class="detail-score"><strong>${Number(d.ratingKinopoisk) > 0 ? Number(d.ratingKinopoisk).toFixed(1) : '—'}</strong><span>Кинопоиск<br>${d.kinopoiskId ? 'Найдено совпадение' : 'Оценка недоступна'}</span></div>
          </div>
          <h3>О произведении</h3><p class="overview">${safe(d.overview || 'Описание пока недоступно на русском языке.')}</p>${creatorsText ? `<h3>${type === 'tv' ? 'Создатели' : 'Режиссёр'}</h3><p class="overview">${safe(creatorsText)}</p>` : ''}
          <div class="detail-actions">
            <button type="button" class="site-btn primary" data-rate-current>⭐ Оценить в CINEVA ↗</button>
            <button type="button" class="site-btn ${inWatch ? 'primary' : ''}" data-detail-watchlist="${safe(id)}" data-media-type="${safe(type)}">${inWatch ? '✓ В избранном' : '🔖 В избранное'}</button>
            <button type="button" class="site-btn" data-share-title="${safe(title)}">🔗 Поделиться</button>
            ${video ? `<a class="site-btn" href="https://www.youtube.com/watch?v=${safe(video.key)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none">▶ Трейлер ↗</a>` : ''}
          </div></div>
        </div></section>
        ${renderCrew(crew, type === 'tv')}
        <section class="detail-section"><h2>Актёрский состав</h2>${renderCast(cast)}</section>
        <section class="detail-section"><h2>Информация</h2><div class="notice-card" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">${[['Статус', d.status], ['Страна', countries], ['Языки', languages], ['Студии', companies], ['Бюджет', d.budget ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(d.budget) : '—'], ['Сборы', d.revenue ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(d.revenue) : '—']].map(([k, val]) => `<div><span style="display:block;font-size:10px;color:#7f8aa2;margin-bottom:5px">${safe(k)}</span><strong style="font-size:12px;color:#e2e7f4">${safe(val || '—')}</strong></div>`).join('')}</div></section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные карточки предоставляются TMDB и Кинопоиском. CINEVA не связан с правообладателями.</p>`;
    } catch (error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть карточку</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openKinopoiskPerson(id) {
    if (!id) return;
    if (!byId('page-detail')) {
      window.location.href = `search.html?open=person&id=${encodeURIComponent(id)}&source=kinopoisk`;
      return;
    }

    showDetailContainer();
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем профиль создателя…</strong>Получаем данные из Кинопоиска.</div>';

    try {
      const u = new URL(window.location.href);
      u.searchParams.set('open', 'person');
      u.searchParams.set('id', id);
      u.searchParams.set('source', 'kinopoisk');
      window.history.pushState(null, '', u.toString());
    } catch (_) {}

    try {
      const p = await kpFetch('/v1/staff/' + encodeURIComponent(id));
      currentDetail = { kind: 'person', id: String(id), source: 'kinopoisk', details: p };
      const name = p.nameRu || p.nameEn || 'Без имени';
      const photo = p.posterUrl || '';
      const facts = [p.profession, p.birthday ? `Родился: ${p.birthday}` : '', p.birthplace, p.death ? `Умер: ${p.death}` : ''].filter(Boolean);
      const rawFilms = p.films || [];
      const seen = new Set();
      const uniqueFilms = [];
      for (const f of rawFilms) {
        if (!f.filmId || seen.has(f.filmId)) continue;
        seen.add(f.filmId);
        uniqueFilms.push({
          id: f.filmId,
          title: f.nameRu || f.nameEn || 'Без названия',
          year: '',
          posterUrl: '',
          ratingKinopoisk: Number(f.rating || 0),
          source: 'kinopoisk',
          media_type: 'movie'
        });
      }
      const topFilms = uniqueFilms.slice(0, 24);

      byId('detailContent').innerHTML = `
        <section class="person-hero">
          ${photo ? `<img class="person-profile" src="${safe(photo)}" alt="${safe(name)}">` : '<div class="person-profile" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}
          <div>
            <div class="eyebrow">CINEVA · КИНОПОИСК · ПЕРСОНА</div>
            <h1 style="font-size:clamp(30px,4vw,52px);letter-spacing:-.05em;margin:10px 0">${safe(name)}</h1>
            <div class="person-facts">${facts.map(f => `<span>${safe(f)}</span>`).join('')}</div>
            <p class="person-bio">${p.facts && p.facts.length ? safe(p.facts[0]) : 'Профиль персоны из базы Кинопоиска. Ниже представлен список кинопроектов.'}</p>
          </div>
        </section>
        <section class="detail-section">
          <h2>Фильмография</h2>
          <p style="font-size:11px;color:#8d98af;margin:-7px 0 15px">Проекты с участием персоны из базы Кинопоиска.</p>
          <div class="filmography">
            ${topFilms.length ? topFilms.map(w => posterCard(w, 'movie')).join('') : '<div class="notice-card" style="grid-column:1/-1">Фильмография пока недоступна.</div>'}
          </div>
        </section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные персоны предоставлены Кинопоиском. CINEVA не связан с правообладателями.</p>
      `;
    } catch (error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть профиль</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openPerson(id) {
    if (!byId('page-detail')) {
      window.location.href = `search.html?open=person&id=${encodeURIComponent(id)}`;
      return;
    }

    showDetailContainer();
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем профиль…</strong>Получаем биографию и фильмографию.</div>';

    try {
      const u = new URL(window.location.href);
      u.searchParams.set('open', 'person');
      u.searchParams.set('id', id);
      window.history.pushState(null, '', u.toString());
    } catch (_) {}

    try {
      let p, credits;
      try {
        [p, credits] = await Promise.all([
          tmdbFetch('/person/' + encodeURIComponent(id) + '?language=ru-RU'),
          tmdbFetch('/person/' + encodeURIComponent(id) + '/combined_credits?language=ru-RU')
        ]);
      } catch (_) {
        [p, credits] = await Promise.all([
          tmdbFetch('/person/' + encodeURIComponent(id) + '?language=en-US'),
          tmdbFetch('/person/' + encodeURIComponent(id) + '/combined_credits?language=en-US')
        ]);
      }
      currentDetail = { kind: 'person', id: String(id), details: p, credits };
      const name = p.name || 'Без имени';
      const photo = posterUrl(p.profile_path, 'w500');
      let bio = p.biography || '';
      if (!bio) {
        try {
          const en = await tmdbFetch('/person/' + encodeURIComponent(id) + '?language=en-US');
          bio = en.biography || '';
        } catch (_) {}
      }
      const works = [...(credits.cast || []), ...(credits.crew || [])].filter(w => w && w.id && (w.title || w.name)).sort((a, b) => String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || '')));
      const seen = new Set();
      const uniqueWorks = works.filter(w => {
        const k = (w.media_type || '') + ':' + w.id;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 24);
      const facts = [p.known_for_department, p.birthday ? `Родился: ${p.birthday}` : '', p.place_of_birth, p.deathday ? `Умер: ${p.deathday}` : ''].filter(Boolean);
      const knownAs = (p.also_known_as || []).slice(0, 5).join(', ');

      byId('detailContent').innerHTML = `
        <section class="person-hero">${photo ? `<img class="person-profile" src="${safe(photo)}" alt="${safe(name)}">` : '<div class="person-profile" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}<div><div class="eyebrow">CINEVA · ПРОФИЛЬ</div><h1 style="font-size:clamp(30px,4vw,52px);letter-spacing:-.05em;margin:10px 0">${safe(name)}</h1><div class="person-facts">${facts.map(f => `<span>${safe(f)}</span>`).join('')}</div>${bio ? `<p class="person-bio">${safe(bio)}</p>` : '<p class="person-bio">Биография для этой записи не указана. Ниже доступна фильмография и список проектов.</p>'}${knownAs ? `<p style="font-size:10px;color:#8590a8;margin-top:14px">Также известен как: ${safe(knownAs)}</p>` : ''}</div></section>
        <section class="detail-section"><h2>Фильмография</h2><p style="font-size:11px;color:#8d98af;margin:-7px 0 15px">Показаны ключевые проекты из базы данных TMDB.</p><div class="filmography">${uniqueWorks.length ? uniqueWorks.map(w => posterCard({ ...w, media_type: w.media_type || 'movie' }, w.media_type || 'movie')).join('') : '<div class="notice-card" style="grid-column:1/-1">Фильмография пока недоступна.</div>'}</div></section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Биография и фильмография предоставлены TMDB. CINEVA не связан с TMDB.</p>`;
    } catch (error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть профиль</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openKinopoiskTitle(id) {
    if (!id) return;
    if (!byId('page-detail')) {
      window.location.href = `search.html?open=movie&id=${encodeURIComponent(id)}&source=kinopoisk`;
      return;
    }

    showDetailContainer();
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем карточку…</strong>Получаем описание и актёрский состав из Кинопоиска.</div>';

    try {
      const [d, staff] = await Promise.all([
        kpFetch('/v2.2/films/' + encodeURIComponent(id)),
        kpFetch('/v1/staff?filmId=' + encodeURIComponent(id)).catch(() => [])
      ]);
      currentDetail = { source: 'kinopoisk', kind: ['TV_SERIES', 'MINI_SERIES', 'TV_SHOW', 'TV_MINI_SERIES'].includes(d.type) ? 'tv' : 'movie', id: String(id), details: d, credits: { staff } };

      const title = d.nameRu || d.nameOriginal || d.nameEn || 'Без названия';
      const original = d.nameOriginal || d.nameEn || '';
      const year = d.year ? String(d.year) : '';
      const isTv = ['TV_SERIES', 'MINI_SERIES', 'TV_SHOW', 'TV_MINI_SERIES'].includes(d.type);
      const genres = (d.genres || []).map(g => typeof g === 'string' ? g : (g.genre || g.name || '')).filter(Boolean);
      const poster = d.posterUrl || d.posterUrlPreview || '';
      const rating = Number(d.ratingKinopoisk || 0);
      const votes = Number(d.ratingKinopoiskVoteCount || 0);
      const length = d.filmLength ? `${d.filmLength} мин.` : '';
      const tagline = d.slogan || '';
      const cast = (staff || []).filter(p => /ACTOR|VOICE|Акт|озвуч/i.test(String(p.professionKey || '') + ' ' + String(p.professionText || ''))).slice(0, 18);
      const directors = (staff || []).filter(p => /DIRECTOR|Режисс/i.test(String(p.professionKey || '') + ' ' + String(p.professionText || ''))).slice(0, 5);
      const overview = d.description || d.shortDescription || 'Описание для этой записи не указано.';
      const staffCards = people => people.map(p => `<button type="button" class="person-card" data-open-kp-person="${safe(p.staffId || p.id || '')}"><span>${p.posterUrl ? `<img src="${safe(p.posterUrl)}" loading="lazy" alt="">` : '<span class="person-photo-empty">CINEVA</span>'}</span><strong>${safe(p.nameRu || p.nameEn || 'Без имени')}</strong><span>${safe(p.description || p.professionText || 'Кино')}</span></button>`).join('');

      const inWatch = isInWatchlist(id, isTv ? 'tv' : 'movie', 'kinopoisk');

      byId('detailContent').innerHTML = `
        <section class="detail-top"><div class="detail-main">${poster ? `<img class="detail-poster" src="${safe(poster)}" alt="Постер: ${safe(title)}">` : '<div class="detail-poster" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}
        <div class="detail-copy"><div class="eyebrow">${isTv ? 'CINEVA · СЕРИАЛ' : 'CINEVA · ФИЛЬМ'}</div><h1>${safe(title)}${year ? ` <span style="font-size:.55em;color:#a5b0c5">(${safe(year)})</span>` : ''}</h1>${original && original !== title ? `<div class="detail-original">${safe(original)}</div>` : ''}${tagline ? `<div class="detail-tagline">«${safe(tagline)}»</div>` : ''}
        <div class="detail-meta">${[year, isTv ? 'Сериал' : 'Фильм', length, genres.join(' · ')].filter(Boolean).map(x => `<span>${safe(x)}</span>`).join('')}</div><div class="detail-score"><strong>${rating > 0 ? rating.toFixed(1) : '—'}</strong><span>Кинопоиск<br>${votes.toLocaleString('ru-RU')} голосов</span></div>
        <h3>О произведении</h3><p class="overview">${safe(overview)}</p>${directors.length ? `<h3>Режиссура</h3><p class="overview">${safe(directors.map(p => p.nameRu || p.nameEn).filter(Boolean).join(', '))}</p>` : ''}
        <div class="detail-actions">
          <button type="button" class="site-btn primary" data-rate-current>⭐ Оценить в CINEVA ↗</button>
          <button type="button" class="site-btn ${inWatch ? 'primary' : ''}" data-detail-watchlist="${safe(id)}" data-media-type="${isTv ? 'tv' : 'movie'}">${inWatch ? '✓ В избранном' : '🔖 В избранное'}</button>
          <button type="button" class="site-btn" data-share-title="${safe(title)}">🔗 Поделиться</button>
        </div></div></div></section>
        <section class="detail-section"><h2>Актёрский состав</h2>${cast.length ? `<div class="people-row">${staffCards(cast)}</div>` : '<div class="notice-card">Информация об актёрском составе пока недоступна.</div>'}</section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные карточки и актёрского состава предоставлены API Кинопоиска. CINEVA не связан с Кинопоиском.</p>`;
    } catch (error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть карточку</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
    }
  }

  async function openKinopoiskPerson(id) {
    if (!id) return;
    if (!byId('page-detail')) {
      window.location.href = `search.html?open=person&id=${encodeURIComponent(id)}&source=kinopoisk`;
      return;
    }

    showDetailContainer();
    byId('detailContent').innerHTML = '<div class="notice-card"><strong>Загружаем профиль создателя…</strong>Получаем данные из Кинопоиска.</div>';

    try {
      const u = new URL(window.location.href);
      u.searchParams.set('open', 'person');
      u.searchParams.set('id', id);
      u.searchParams.set('source', 'kinopoisk');
      window.history.pushState(null, '', u.toString());
    } catch (_) {}

    try {
      const p = await kpFetch('/v1/staff/' + encodeURIComponent(id));
      currentDetail = { kind: 'person', id: String(id), source: 'kinopoisk', details: p };
      const name = p.nameRu || p.nameEn || 'Без имени';
      const photo = p.posterUrl || '';
      const facts = [p.profession, p.birthday ? `Родился: ${p.birthday}` : '', p.birthplace, p.death ? `Умер: ${p.death}` : ''].filter(Boolean);
      const rawFilms = p.films || [];
      const seen = new Set();
      const uniqueFilms = [];
      for (const f of rawFilms) {
        if (!f.filmId || seen.has(f.filmId)) continue;
        seen.add(f.filmId);
        uniqueFilms.push({
          id: f.filmId,
          title: f.nameRu || f.nameEn || 'Без названия',
          year: '',
          posterUrl: '',
          ratingKinopoisk: Number(f.rating || 0),
          source: 'kinopoisk',
          media_type: 'movie'
        });
      }
      const topFilms = uniqueFilms.slice(0, 24);

      byId('detailContent').innerHTML = `
        <section class="person-hero">
          ${photo ? `<img class="person-profile" src="${safe(photo)}" alt="${safe(name)}">` : '<div class="person-profile" style="display:grid;place-items:center;color:#8c96ac">CINEVA</div>'}
          <div>
            <div class="eyebrow">CINEVA · КИНОПОИСК · ПЕРСОНА</div>
            <h1 style="font-size:clamp(30px,4vw,52px);letter-spacing:-.05em;margin:10px 0">${safe(name)}</h1>
            <div class="person-facts">${facts.map(f => `<span>${safe(f)}</span>`).join('')}</div>
            <p class="person-bio">${p.facts && p.facts.length ? safe(p.facts[0]) : 'Профиль персоны из базы Кинопоиска. Ниже представлен список кинопроектов.'}</p>
          </div>
        </section>
        <section class="detail-section">
          <h2>Фильмография</h2>
          <p style="font-size:11px;color:#8d98af;margin:-7px 0 15px">Проекты с участием персоны из базы Кинопоиска.</p>
          <div class="filmography">
            ${topFilms.length ? topFilms.map(w => posterCard(w, 'movie')).join('') : '<div class="notice-card" style="grid-column:1/-1">Фильмография пока недоступна.</div>'}
          </div>
        </section>
        <p style="font-size:10px;color:#6f7a92;line-height:1.7">Данные персоны предоставлены Кинопоиском. CINEVA не связан с правообладателями.</p>
      `;
    } catch (error) {
      byId('detailContent').innerHTML = `<div class="notice-card"><strong>Не удалось открыть профиль</strong>${safe(error.message)}<br><button class="site-btn primary" style="margin-top:12px" data-open-settings>Проверить настройки API</button></div>`;
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

  // ==========================================
  // NAVIGATION ROUTING & URL PARAMETER PARSER
  // ==========================================
  function checkUrlRouting() {
    try {
      const params = new URLSearchParams(window.location.search);
      const openType = params.get('open') || params.get('type');
      const openId = params.get('id');
      const source = params.get('source') || 'tmdb';
      const searchQuery = params.get('q') || params.get('search');
      const searchMode = params.get('mode') || 'multi';

      if (openType && openId) {
        if (source === 'kinopoisk') {
          if (openType === 'person') openKinopoiskPerson(openId);
          else openKinopoiskTitle(openId);
        }
        else if (openType === 'person') openPerson(openId);
        else openTitle(openId, openType);
      } else if (searchQuery && currentPageKey === 'search') {
        runGlobalSearch(searchQuery, searchMode);
      }
    } catch (_) {}
  }

  // ==========================================
  // API WELCOME & SETTINGS OVERLAY
  // ==========================================
  function openApiWelcomeIfNeeded() {
    const overlay = byId('apiWelcomeOverlay');
    if (overlay) overlay.hidden = true;
    return true;
  }

  function finishApiWelcome(manualOnly = false) {
    const tmdb = manualOnly ? '' : (byId('welcomeTmdbKey')?.value.trim() || '');
    const kp = manualOnly ? '' : (byId('welcomeKpKey')?.value.trim() || '');
    saveApiKeys(tmdb, kp);
    const overlay = byId('apiWelcomeOverlay');
    if (overlay) overlay.hidden = true;
    if (currentPageKey === 'home') loadHomeShelves(true);
    if (tmdb || kp) showToast('Настройки источников сохранены в браузере.', 'success');
    else showToast('Работаем без API. Оценивание доступно через ручной ввод.', 'info', 4200);
  }

  function showSettings() {
    const modal = byId('settingsOverlay');
    if (!modal) return;
    if (byId('settingTmdbKey')) byId('settingTmdbKey').value = getTmdbKey();
    if (byId('settingKpKey')) byId('settingKpKey').value = getKpKey();
    modal.hidden = false;
    setTimeout(() => byId('settingTmdbKey')?.focus(), 50);
  }

  function hideSettings() {
    const modal = byId('settingsOverlay');
    if (modal) modal.hidden = true;
  }

  // ==========================================
  // GLOBAL EVENT DELEGATIONS & CLICK ROUTING
  // ==========================================
  document.addEventListener('click', event => {
    // 1. Navigation to search
    if (event.target.closest('[data-go-search]')) {
      if (currentPageKey !== 'search') {
        window.location.href = 'search.html';
      } else if (byId('pageSearchInput')) {
        byId('pageSearchInput').focus();
      }
      return;
    }

    // 2. Search mode filter chips (e.g. Movies, TV, Persons)
    const modeBtn = event.target.closest('[data-search-mode]');
    if (modeBtn) {
      const mode = modeBtn.dataset.searchMode;
      document.querySelectorAll('.filter-chip[data-search-mode]').forEach(c => c.classList.toggle('active', c === modeBtn));
      if (currentPageKey === 'search') {
        runGlobalSearch(lastSearchQuery || byId('pageSearchInput')?.value || '', mode);
      } else {
        window.location.href = `search.html?mode=${encodeURIComponent(mode)}`;
      }
      return;
    }

    // 3. Random movie button
    if (event.target.closest('#randomMovieBtn') || event.target.closest('#heroRandomBtn')) {
      pickRandomMovie();
      return;
    }

    // 4. Settings modal controls
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
      if (byId('settingTmdbKey')) byId('settingTmdbKey').value = '';
      if (byId('settingKpKey')) byId('settingKpKey').value = '';
      if (currentPageKey === 'home') loadHomeShelves(true);
      showToast('Сохранённые API-ключи удалены. Оценивание доступно вручную.', 'info');
      return;
    }

    // Check API button: tests the inputs currently typed into modal!
    if (event.target.closest('#checkApiBtn')) {
      const btn = byId('checkApiBtn');
      const status = byId('apiCheckStatus');
      const currentTmdb = (byId('settingTmdbKey')?.value || '').trim().replace(/^["']|["']$/g, '');
      const currentKp = (byId('settingKpKey')?.value || '').trim().replace(/^["']|["']$/g, '');

      btn.disabled = true;
      btn.textContent = 'Проверяем…';
      status.textContent = 'Тестируем введённые ключи...';

      const tmdbCheck = currentTmdb
        ? tmdbFetch('/configuration', undefined, 8000, currentTmdb)
        : Promise.reject(new Error('Ключ TMDB не введён'));

      const kpCheck = currentKp
        ? kpFetch('/v2.2/films/collections?type=TOP_POPULAR_MOVIES&page=1', undefined, 8000, currentKp)
        : Promise.reject(new Error('Ключ Кинопоиска не введён'));

      Promise.allSettled([tmdbCheck, kpCheck]).then(results => {
        const labels = ['TMDB', 'Кинопоиск'];
        status.innerHTML = results.map((result, index) => {
          if (result.status === 'fulfilled') {
            return `<span class="api-ok">✓ ${labels[index]}: подключение работает</span>`;
          } else {
            return `<span class="api-fail">✕ ${labels[index]}: ${safe(result.reason?.message || 'ошибка запроса')}</span>`;
          }
        }).join('\n');
      }).finally(() => {
        btn.disabled = false;
        btn.textContent = 'Проверить подключение';
      });
      return;
    }

    // Save API keys button
    if (event.target.closest('#settingsSaveBtn')) {
      const tmdbVal = byId('settingTmdbKey')?.value.trim() || '';
      const kpVal = byId('settingKpKey')?.value.trim() || '';
      saveApiKeys(tmdbVal, kpVal);
      hideSettings();
      if (currentPageKey === 'home') loadHomeShelves(true);
      if (currentPageKey === 'search') runGlobalSearch(lastSearchQuery || byId('pageSearchInput')?.value || '');
      showToast(tmdbVal || kpVal ? 'Настройки API сохранены!' : 'API отключены. Оценивание доступно вручную.', 'success');
      return;
    }

    // 5. Watchlist card removal button
    const removeWatch = event.target.closest('[data-watchlist-remove]');
    if (removeWatch) {
      event.preventDefault();
      event.stopPropagation();
      const id = removeWatch.dataset.watchlistRemove;
      const type = removeWatch.dataset.watchlistType || 'movie';
      const source = removeWatch.dataset.watchlistSource || 'tmdb';
      const item = getWatchlist().find(x => String(x.id) === String(id) && (x.media_type || x.type) === type && sourceOf(x) === source);
      if (item) toggleWatchlist({ ...item, id, media_type: type, source }, type);
      return;
    }

    // 6. Watchlist toggle from detail page
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

    // 7. Clear entire Watchlist
    if (event.target.closest('#watchlistClearBtn')) {
      const doClear = () => {
        saveWatchlist([]);
        updateWatchlistUI();
        showToast('Список избранного очищен', 'info');
      };
      if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal({
          title: 'Очистить избранное?',
          message: 'Все сохранённые фильмы, сериалы и персоны будут удалены из списка вашей коллекции.',
          confirmText: 'Да, очистить всё',
          danger: true,
          onConfirm: doClear
        });
      } else if (confirm('Очистить весь список избранного?')) {
        doClear();
      }
      return;
    }

    // 8. "⭐ Оценить в CINEVA ↗" button on detail card
    if (event.target.closest('[data-rate-current]')) {
      if (!currentDetail || currentDetail.kind === 'person') return;
      const d = currentDetail.details;
      const c = currentDetail.credits || {};
      const isKp = currentDetail.source === 'kinopoisk';
      const isTv = currentDetail.kind === 'tv';
      const title = isKp ? (d.nameRu || d.nameOriginal || d.nameEn || '') : (d.title || d.name || d.original_title || d.original_name || '');
      const date = isKp ? String(d.year || '') : (d.release_date || d.first_air_date || '');
      const genres = (d.genres || []).map(g => isKp ? (typeof g === 'string' ? g : (g.genre || g.name || '')) : g.name).filter(Boolean);
      let directors = isKp
        ? (c.staff || []).filter(p => /DIRECTOR|Режисс/i.test(String(p.professionKey || '') + ' ' + String(p.professionText || ''))).map(p => p.nameRu || p.nameEn)
        : (isTv ? (d.created_by || []).map(p => p.name) : (c.crew || []).filter(p => p.job === 'Director').map(p => p.name));
      if (!directors.length && c.crew) directors = c.crew.filter(p => p.department === 'Directing').slice(0, 3).map(p => p.name);

      const ratePayload = {
        id: currentDetail.id,
        source: currentDetail.source || 'tmdb',
        kind: currentDetail.kind,
        title,
        director: directors.join(', '),
        year: date.slice(0, 4),
        genre: genres.join(', '),
        posterUrl: isKp ? (d.posterUrl || d.posterUrlPreview || '') : (d.poster_path ? posterUrl(d.poster_path, 'w780') : ''),
        voteCount: Number(isKp ? d.ratingKinopoiskVoteCount : d.vote_count) || 0,
        rating: Number(isKp ? d.ratingKinopoisk : d.vote_average) || 0
      };

      try {
        sessionStorage.setItem('cineva_rate_item', JSON.stringify(ratePayload));
      } catch (_) {}

      if (currentPageKey === 'rating' && typeof window.loadRatingItem === 'function') {
        window.loadRatingItem(ratePayload);
      } else {
        window.location.href = `rating.html?rateId=${encodeURIComponent(currentDetail.id)}&type=${encodeURIComponent(currentDetail.kind)}&source=${encodeURIComponent(currentDetail.source || 'tmdb')}`;
      }
      return;
    }

    // 9. Share movie detail link
    const shareBtn = event.target.closest('[data-share-title]');
    if (shareBtn) {
      const rawTitle = shareBtn.dataset.shareTitle || '';
      let text = rawTitle;
      if (currentDetail && currentDetail.details) {
        const d = currentDetail.details;
        const year = releaseYear(d);
        let webUrl = '';
        try {
          const origin = window.location.origin;
          if (origin && origin !== 'null' && window.location.protocol.startsWith('http')) {
            const qp = new URLSearchParams();
            qp.set('open', currentDetail.kind);
            qp.set('id', currentDetail.id);
            if (currentDetail.source === 'kinopoisk') qp.set('source', 'kinopoisk');
            webUrl = `${origin}${window.location.pathname.replace(/[^/]*$/, 'search.html')}?${qp.toString()}`;
          }
        } catch (_) {}

        const parts = [`«${rawTitle}»`, year ? `(${year})` : '', '— CINEVA', webUrl].filter(Boolean);
        text = parts.join(' ');
      }
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        showToast('Ссылка на карточку скопирована в буфер обмена!', 'success');
      }
      return;
    }

    // 10. Retry search banner button
    const retryBtn = event.target.closest('[data-retry-query]');
    if (retryBtn) {
      runGlobalSearch(retryBtn.dataset.retryQuery, activeSearchMode, true);
      return;
    }

    // 11. Entity poster card clicks (open details)
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

    // Kinopoisk staff member click
    const kpPersonBtn = event.target.closest('[data-open-kp-person]');
    if (kpPersonBtn) {
      const pid = kpPersonBtn.dataset.openKpPerson;
      if (pid) openKinopoiskPerson(pid);
      return;
    }

    // 13. Back button from detail card
    if (event.target.closest('#detailBackBtn')) {
      closeDetail();
      return;
    }
  });

  // Global search input submission in topbar
  const globalSearchForm = byId('globalSearchForm');
  if (globalSearchForm) {
    globalSearchForm.addEventListener('submit', event => {
      event.preventDefault();
      const q = byId('globalSearchInput')?.value.trim() || '';
      const live = byId('liveSearchResults');
      if (live) live.hidden = true;
      runGlobalSearch(q, activeSearchMode);
    });
  }

  const globalSearchInput = byId('globalSearchInput');
  const liveResultsContainer = byId('liveSearchResults');
  let topbarLiveTimer = null;

  if (globalSearchInput && liveResultsContainer) {
    globalSearchInput.addEventListener('input', () => {
      clearTimeout(topbarLiveTimer);
      const q = globalSearchInput.value.trim();
      if (q.length < 2) {
        liveResultsContainer.hidden = true;
        liveResultsContainer.innerHTML = '';
        return;
      }
      topbarLiveTimer = setTimeout(async () => {
        try {
          const { results } = await searchUnifiedMedia(q, 'multi');
          if (!results || !results.length) {
            liveResultsContainer.innerHTML = '<div style="font-size:11.5px;color:#8591ab;padding:12px;text-align:center">Ничего не найдено (Нажмите Enter для поиска)</div>';
            liveResultsContainer.hidden = false;
            return;
          }
          liveResultsContainer.innerHTML = results.slice(0, 5).map(item => {
            const isPerson = item.media_type === 'person';
            const img = item.poster || item.posterUrl || (isPerson ? (item.profile_path ? posterUrl(item.profile_path, 'w185') : '') : (item.poster_path ? posterUrl(item.poster_path, 'w185') : ''));
            const title = item.title || item.name || item.nameRu || 'Без названия';
            const year = isPerson ? (item.known_for_department || 'Кино') : (item.year || releaseYear(item) || '');
            const kpAttr = item.source === 'kinopoisk' ? `data-open-source="kinopoisk" data-kp-id="${safe(item.id)}"` : '';
            return `
              <div class="live-search-item" data-open-type="${safe(item.media_type || 'movie')}" data-open-id="${safe(item.id)}" ${kpAttr} role="button" tabindex="0" style="display:flex;align-items:center;gap:10px;padding:8px 10px;cursor:pointer;border-radius:10px;transition:background .15s ease">
                ${img ? `<img src="${safe(img)}" style="width:30px;height:44px;border-radius:6px;object-fit:cover;flex:0 0 30px" alt="">` : '<div style="width:30px;height:44px;border-radius:6px;background:#171c2b;display:grid;place-items:center;font-size:9px;color:#7886a0;flex:0 0 30px">CINEVA</div>'}
                <div style="min-width:0;flex:1">
                  <strong style="display:block;font-size:12.5px;color:#f3f6fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${safe(title)}</strong>
                  <span style="font-size:10.5px;color:#8c98af">${safe(year)} · ${isPerson ? 'Персона' : (item.media_type === 'tv' ? 'Сериал' : 'Фильм')}</span>
                </div>
              </div>
            `;
          }).join('');
          liveResultsContainer.hidden = false;
        } catch (_) {}
      }, 250);
    });

    document.addEventListener('click', e => {
      if (!e.target.closest('#globalSearchForm')) {
        liveResultsContainer.hidden = true;
      }
    });
    globalSearchInput.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        liveResultsContainer.hidden = true;
      }
    });
  }

  // Search input on search.html
  const pageSearchForm = byId('pageSearchForm');
  if (pageSearchForm) {
    pageSearchForm.addEventListener('submit', event => {
      event.preventDefault();
      const q = byId('pageSearchInput')?.value.trim() || '';
      runGlobalSearch(q, activeSearchMode);
    });
  }

  const pageSearchInput = byId('pageSearchInput');
  if (pageSearchInput) {
    pageSearchInput.addEventListener('input', () => {
      clearTimeout(liveSearchTimer);
      liveSearchTimer = setTimeout(() => {
        runGlobalSearch(pageSearchInput.value, activeSearchMode);
      }, 300);
    });
  }

  // Scroll to top button
  const scrollTopBtn = byId('scrollTopBtn');
  if (scrollTopBtn) {
    window.addEventListener('scroll', () => {
      scrollTopBtn.classList.toggle('visible', window.scrollY > 320);
    }, { passive: true });
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Keyboard navigation & accessibility
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (byId('settingsOverlay') && !byId('settingsOverlay').hidden) {
        hideSettings();
      } else if (byId('page-detail') && byId('page-detail').style.display === 'block') {
        closeDetail();
      }
    }
    if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button, a, input, select, textarea')) {
      const card = event.target.closest('.media-card[role="button"][data-open-type][data-open-id]');
      if (card) {
        event.preventDefault();
        card.click();
      }
    }
  });

  // Support pressing Enter in settings inputs to save immediately
  ['settingTmdbKey', 'settingKpKey'].forEach(id => {
    byId(id)?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        byId('settingsSaveBtn')?.click();
      }
    });
  });

  // Sync Watchlist badge & keys across multiple browser tabs
  window.addEventListener('storage', event => {
    if (event.key === 'cineva_watchlist') updateWatchlistCount();
    if (event.key === 'cineva_tmdb_key' || event.key === 'cineva_kp_key') {
      updateApiStatusBadges();
      if (currentPageKey === 'home') loadHomeShelves(true);
    }
  });

  // First-run welcome modal hooks
  byId('apiWelcomeSaveBtn')?.addEventListener('click', () => finishApiWelcome(false));
  byId('apiWelcomeManualBtn')?.addEventListener('click', () => finishApiWelcome(true));
  ['welcomeTmdbKey', 'welcomeKpKey'].forEach(id => byId(id)?.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); finishApiWelcome(false); }
  }));

  // ==========================================
  // PAGE INITIALIZATION RUNNER
  // ==========================================
  updateWatchlistCount();
  updateApiStatusBadges();

  if (currentPageKey === 'home') {
    if (openApiWelcomeIfNeeded()) loadHomeShelves();
  } else if (currentPageKey === 'watchlist') {
    updateWatchlistUI();
  }

  // URL Deep Links check on all pages
  checkUrlRouting();

  // Export core API to window for page-specific modules
  window.CINEVA = {
    getTmdbKey, getKpKey, saveApiKeys, isApiSetupComplete,
    showToast,
    tmdbFetch, kpFetch, fetchJsonWithTimeout,
    searchUnifiedMedia, searchTmdbGlobal, getKpMatches, matchKpToTmdb,
    titleMatchScore, normalizeSearchText, switchKeyboardLayout,
    posterUrl, ratingText, releaseYear, safe,
    openTitle, openPerson, openKinopoiskTitle,
    getWatchlist, saveWatchlist, isInWatchlist, toggleWatchlist,
    pickRandomMovie, runGlobalSearch, showSettings, hideSettings
  };

  window.showToast = showToast;
  window.getTmdbKey = getTmdbKey;
  window.getKpKey = getKpKey;
  window.saveApiKeys = saveApiKeys;
  window.isApiSetupComplete = isApiSetupComplete;
  window.openTitle = openTitle;
  window.openPerson = openPerson;
  window.openKinopoiskTitle = openKinopoiskTitle;
  window.getWatchlist = getWatchlist;
  window.searchUnifiedMedia = searchUnifiedMedia;
  window.tmdbFetch = tmdbFetch;
  window.kpFetch = kpFetch;
  window.posterUrl = posterUrl;
  window.releaseYear = releaseYear;
  window.safe = safe;
  window.showSettings = showSettings;
  window.hideSettings = hideSettings;
})();
