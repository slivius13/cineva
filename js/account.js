/* === CINEVA ACCOUNT & MULTI-PROFILE SYSTEM (ZERO-DEPENDENCY JSON & CRYPTO) === */
(() => {
  const byId = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const showToast = (msg, type) => (typeof window.showToast === 'function' ? window.showToast(msg, type) : null);
  const posterUrl = (path, size = 'w500') => (typeof window.posterUrl === 'function' ? window.posterUrl(path, size) : (path ? `https://image.tmdb.org/t/p/${size}${path}` : ''));

  // Avatar presets
  const AVATAR_PRESETS = ['🎬', '🍿', '🎥', '🎞️', '🕶️', '⚡', '🌌', '🛸', '🍸', '🎭', '👑', '🤖', '👾', '🔥', '🔮', '📽️'];

  // Banner themes
  const BANNER_THEMES = [
    { id: 'deep-space', name: 'Глубокий космос', icon: '🌌', class: 'theme-deep-space', bg: 'linear-gradient(145deg, #161a29, #0e111a)' },
    { id: 'cyberpunk', name: 'Киберпанк', icon: '🌆', class: 'theme-cyberpunk', bg: 'linear-gradient(145deg, #231222, #0d0c16)' },
    { id: 'emerald', name: 'Изумрудный нуар', icon: '🌿', class: 'theme-emerald', bg: 'linear-gradient(145deg, #0d2218, #07130e)' },
    { id: 'gold', name: 'Золотой век', icon: '🎞️', class: 'theme-gold', bg: 'linear-gradient(145deg, #241d0f, #110e08)' },
    { id: 'amethyst', name: 'Неоновый аметист', icon: '💜', class: 'theme-amethyst', bg: 'linear-gradient(145deg, #201333, #0d0a17)' },
    { id: 'monochrome', name: 'Тёмный монохром', icon: '🌑', class: 'theme-monochrome', bg: 'linear-gradient(145deg, #161618, #0b0b0d)' }
  ];

  // ==========================================
  // CRYPTOGRAPHY (NATIVE WEB CRYPTO API SHA-256)
  // ==========================================
  async function hashPassword(password) {
    if (!password) return '';
    try {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {
      // Fallback simple hash if crypto.subtle is restricted
      let h = 0;
      for (let i = 0; i < password.length; i++) {
        h = ((h << 5) - h) + password.charCodeAt(i);
        h |= 0;
      }
      return 'f_' + Math.abs(h).toString(16);
    }
  }

  // Calculate Cinema Rank
  function calculateCinemaRank(account) {
    if (!account) return { title: 'Новичок кинозала', icon: '🍿', color: '#7f9bff' };
    if (account.customTitle && account.customTitle.trim()) {
      return { title: account.customTitle.trim(), icon: '✨', color: '#c5ff65', isCustom: true };
    }
    const ratingsCount = (account.ratings || []).length;
    const watchlistCount = (account.watchlist || []).length;
    const tierlistsCount = (account.tierlists || []).length;
    const totalScore = ratingsCount * 3 + tierlistsCount * 2 + watchlistCount;

    if (totalScore >= 35) return { title: 'Легенда авторского кино', icon: '👑', color: '#ff4d6d' };
    if (totalScore >= 18) return { title: 'Главный режиссёр', icon: '🎥', color: '#bd83ff' };
    if (totalScore >= 8)  return { title: 'Каннский критик', icon: '🎬', color: '#c5ff65' };
    if (totalScore >= 3)  return { title: 'Внимательный синефил', icon: '🎞️', color: '#5eead4' };
    return { title: 'Новичок кинозала', icon: '🍿', color: '#7f9bff' };
  }

  // Account Factory
  function createDefaultAccount(customName = 'Синефил CINEVA') {
    const handle = customName.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '').slice(0, 16) || 'cinephile';
    return {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      username: customName,
      handle,
      status: 'Кино — это жизнь, в которой вырезали всё скучное',
      bio: 'Исследую авторское кино, коллекционирую редкие шедевры и составляю тирлисты.',
      customTitle: '',
      bannerTheme: 'deep-space',
      bannerUrl: '',
      avatarType: 'emoji',
      avatar: '🎬',
      favoriteMovie: {
        id: '157336',
        title: 'Интерстеллар',
        year: '2014',
        poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
      },
      favoriteDirector: 'Кристофер Нолан',
      favoriteTv: 'Во все тяжкие',
      favoriteGenres: ['Фантастика', 'Драма', 'Триллер'],
      socialLinks: { kinopoisk: '', letterboxd: '', telegram: '' },
      joinedAt: new Date().toISOString(),
      passwordHash: '',
      pinnedRatingId: '',
      pinnedTierlistId: '',
      watchlist: [],
      ratings: [],
      tierlists: []
    };
  }

  // ==========================================
  // MULTI-ACCOUNT STORAGE & REGISTRY
  // ==========================================
  function getAccountsRegistry() {
    let registry = null;
    let activeId = null;

    try {
      const regRaw = localStorage.getItem('cineva_accounts_registry');
      if (regRaw) registry = JSON.parse(regRaw);
      activeId = localStorage.getItem('cineva_active_account_id');
    } catch (_) {}

    // Fallback: window.name JSON vault for file:// continuity
    if (!registry) {
      try {
        if (window.name && window.name.startsWith('{')) {
          const store = JSON.parse(window.name);
          if (store && Array.isArray(store.cineva_accounts_registry)) {
            registry = store.cineva_accounts_registry;
            activeId = store.cineva_active_account_id;
          }
        }
      } catch (_) {}
    }

    // Migration from single legacy account
    if (!Array.isArray(registry) || !registry.length) {
      let legacyAcc = null;
      try {
        const raw = localStorage.getItem('cineva_user_account');
        if (raw) legacyAcc = JSON.parse(raw);
      } catch (_) {}

      if (!legacyAcc) {
        try {
          if (window.name && window.name.startsWith('{')) {
            const store = JSON.parse(window.name);
            if (store && store.cineva_user_account) legacyAcc = store.cineva_user_account;
          }
        } catch (_) {}
      }

      if (legacyAcc && legacyAcc.username) {
        registry = [legacyAcc];
        activeId = legacyAcc.id;
      } else {
        const initial = createDefaultAccount();
        // Sync existing watchlist if any
        if (typeof window.getWatchlist === 'function') {
          const wl = window.getWatchlist();
          if (wl && wl.length) initial.watchlist = wl;
        }
        registry = [initial];
        activeId = initial.id;
      }
      saveAccountsRegistry(registry, activeId);
    }

    if (!activeId || !registry.some(a => a.id === activeId)) {
      activeId = registry[0].id;
    }

    return { accounts: registry, activeId };
  }

  function saveAccountsRegistry(accounts, activeId) {
    if (!Array.isArray(accounts) || !accounts.length) return;
    const currentActiveId = activeId || accounts[0].id;
    const activeAcc = accounts.find(a => a.id === currentActiveId) || accounts[0];

    try {
      localStorage.setItem('cineva_accounts_registry', JSON.stringify(accounts));
      localStorage.setItem('cineva_active_account_id', currentActiveId);
      // Dual-sync for backward compatibility
      localStorage.setItem('cineva_user_account', JSON.stringify(activeAcc));
    } catch (_) {}

    try {
      sessionStorage.setItem('cineva_accounts_registry', JSON.stringify(accounts));
      sessionStorage.setItem('cineva_active_account_id', currentActiveId);
      sessionStorage.setItem('cineva_user_account', JSON.stringify(activeAcc));
    } catch (_) {}

    try {
      let store = {};
      if (window.name && window.name.startsWith('{')) {
        try { store = JSON.parse(window.name); } catch (_) {}
      }
      store.cineva_accounts_registry = accounts;
      store.cineva_active_account_id = currentActiveId;
      store.cineva_user_account = activeAcc;
      window.name = JSON.stringify(store);
    } catch (_) {}

    // Synchronize active account watchlist and reviewer name
    if (Array.isArray(activeAcc.watchlist)) {
      try {
        localStorage.setItem('cineva_watchlist', JSON.stringify(activeAcc.watchlist));
      } catch (_) {}
    }
    if (activeAcc.username) {
      try {
        localStorage.setItem('cinevaReviewerName', activeAcc.username);
        window.reviewerName = activeAcc.username;
      } catch (_) {}
    }

    updateNavProfileBadge();

    try {
      window.dispatchEvent(new CustomEvent('cineva-account-updated', { detail: activeAcc }));
    } catch (_) {}
  }

  function getAccount() {
    const { accounts, activeId } = getAccountsRegistry();
    return accounts.find(a => a.id === activeId) || accounts[0];
  }

  function saveAccount(updatedAccount) {
    if (!updatedAccount || !updatedAccount.id) return;
    const { accounts, activeId } = getAccountsRegistry();
    const idx = accounts.findIndex(a => a.id === updatedAccount.id);
    if (idx >= 0) {
      accounts[idx] = updatedAccount;
    } else {
      accounts.unshift(updatedAccount);
    }
    saveAccountsRegistry(accounts, activeId);
  }

  // ==========================================
  // UNIVERSAL NATIVE MODAL DIALOGS
  // (REPLACES BROWSER prompt / alert / confirm)
  // ==========================================

  // Remove any active native modal
  function closeActiveNativeModal() {
    const existing = document.querySelectorAll('.cv-native-modal-overlay');
    existing.forEach(m => m.remove());
  }

  // Native Confirm Modal
  function showConfirmModal({ title, message, confirmText = 'Подтвердить', cancelText = 'Отмена', danger = false, onConfirm, onCancel }) {
    closeActiveNativeModal();
    const overlay = document.createElement('div');
    overlay.className = 'cv-native-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="cv-native-modal-card">
        <button type="button" class="cv-modal-close-btn" aria-label="Закрыть">✕</button>
        <div class="cv-modal-header">
          <div class="cv-modal-icon-badge ${danger ? 'danger' : ''}">${danger ? '⚠️' : '❓'}</div>
          <div>
            <h3 class="cv-modal-title">${safe(title)}</h3>
            <p class="cv-modal-desc">${safe(message)}</p>
          </div>
        </div>
        <div class="settings-actions" style="margin-top:22px">
          <button type="button" class="site-btn cv-modal-cancel-btn">${safe(cancelText)}</button>
          <button type="button" class="site-btn ${danger ? 'watchlist-clear-btn' : 'primary'} cv-modal-confirm-btn" style="${danger ? 'padding:8px 18px!important;font-size:12px!important' : ''}">${safe(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => { overlay.remove(); if (typeof onCancel === 'function') onCancel(); };
    overlay.querySelector('.cv-modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.cv-modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('.cv-modal-confirm-btn').addEventListener('click', () => {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    });

    const keyHandler = e => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', keyHandler); }
      if (e.key === 'Enter') {
        overlay.querySelector('.cv-modal-confirm-btn').click();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);
  }

  // Native Text Prompt Modal (For copy links, simple inputs)
  function showModalPrompt({ title, message, value = '', readonly = false, confirmText = 'Скопировать', onConfirm }) {
    closeActiveNativeModal();
    const overlay = document.createElement('div');
    overlay.className = 'cv-native-modal-overlay';
    overlay.setAttribute('role', 'dialog');

    overlay.innerHTML = `
      <div class="cv-native-modal-card">
        <button type="button" class="cv-modal-close-btn" aria-label="Закрыть">✕</button>
        <div class="cv-modal-header">
          <div class="cv-modal-icon-badge">🔗</div>
          <div>
            <h3 class="cv-modal-title">${safe(title)}</h3>
            <p class="cv-modal-desc">${safe(message)}</p>
          </div>
        </div>
        <div class="setting-field" style="margin:16px 0">
          <input type="text" id="cvPromptInp" value="${safe(value)}" ${readonly ? 'readonly' : ''} style="width:100%;font-size:13px;padding:12px;background:#090d18">
        </div>
        <div class="settings-actions">
          <button type="button" class="site-btn cv-modal-cancel-btn">Закрыть</button>
          <button type="button" class="site-btn primary cv-modal-confirm-btn">${safe(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const inp = overlay.querySelector('#cvPromptInp');
    inp.select();

    const close = () => overlay.remove();
    overlay.querySelector('.cv-modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.cv-modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    overlay.querySelector('.cv-modal-confirm-btn').addEventListener('click', () => {
      if (readonly) {
        if (navigator.clipboard) navigator.clipboard.writeText(value);
        showToast('Ссылка скопирована в буфер!', 'success');
      }
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm(inp.value);
    });
  }

  // Native Password Modal (Replaces browser prompt for passwords)
  // modes: 'verify' (single pass), 'set' (new + repeat), 'change' (old + new + repeat), 'remove' (current pass to remove)
  function showPasswordModal({ title, subtitle, mode = 'verify', onConfirm, onCancel }) {
    closeActiveNativeModal();
    const overlay = document.createElement('div');
    overlay.className = 'cv-native-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    let inputsHtml = '';
    if (mode === 'verify') {
      inputsHtml = `
        <div class="setting-field">
          <label for="cvPassInput">Пароль аккаунта</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassInput" type="password" placeholder="Введите пароль для входа" autocomplete="current-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
      `;
    } else if (mode === 'set') {
      inputsHtml = `
        <div class="setting-field">
          <label for="cvPassInput">Новый пароль</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassInput" type="password" placeholder="Придумайте пароль" autocomplete="new-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
        <div class="setting-field">
          <label for="cvPassRepeatInput">Повторите пароль</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassRepeatInput" type="password" placeholder="Повторите пароль" autocomplete="new-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
      `;
    } else if (mode === 'change') {
      inputsHtml = `
        <div class="setting-field">
          <label for="cvPassOldInput">Текущий пароль</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassOldInput" type="password" placeholder="Введите текущий пароль" autocomplete="current-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
        <div class="setting-field">
          <label for="cvPassInput">Новый пароль</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassInput" type="password" placeholder="Придумайте новый пароль" autocomplete="new-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
        <div class="setting-field">
          <label for="cvPassRepeatInput">Повторите новый пароль</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassRepeatInput" type="password" placeholder="Повторите новый пароль" autocomplete="new-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
      `;
    } else if (mode === 'remove') {
      inputsHtml = `
        <div class="setting-field">
          <label for="cvPassInput">Текущий пароль</label>
          <div class="cv-password-input-wrap">
            <input id="cvPassInput" type="password" placeholder="Введите текущий пароль для снятия защиты" autocomplete="current-password">
            <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
          </div>
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="cv-native-modal-card">
        <button type="button" class="cv-modal-close-btn" aria-label="Закрыть">✕</button>
        <div class="cv-modal-header">
          <div class="cv-modal-icon-badge">🔒</div>
          <div>
            <h3 class="cv-modal-title">${safe(title || 'Защита аккаунта')}</h3>
            <p class="cv-modal-desc">${safe(subtitle || 'Введите пароль для продолжения действия.')}</p>
          </div>
        </div>

        <form id="cvPasswordForm" onsubmit="return false">
          ${inputsHtml}
          <div class="cv-modal-error-box" id="cvPassErrorBox" style="display:none">
            <span>⚠️</span>
            <span id="cvPassErrorMsg">Неверный пароль</span>
          </div>

          <div class="settings-actions" style="margin-top:24px">
            <button type="button" class="site-btn cv-modal-cancel-btn">Отмена</button>
            <button type="submit" class="site-btn primary cv-modal-submit-btn">Подтвердить</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector('#cvPasswordForm');
    const firstInp = overlay.querySelector('input');
    if (firstInp) setTimeout(() => firstInp.focus(), 50);

    // Toggle password eye listeners
    overlay.querySelectorAll('.cv-password-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = btn.previousElementSibling;
        if (!input) return;
        if (input.type === 'password') {
          input.type = 'text';
          btn.textContent = '🙈';
        } else {
          input.type = 'password';
          btn.textContent = '👁️';
        }
      });
    });

    const showError = msg => {
      const errBox = overlay.querySelector('#cvPassErrorBox');
      const errMsg = overlay.querySelector('#cvPassErrorMsg');
      if (errBox && errMsg) {
        errMsg.textContent = msg;
        errBox.style.display = 'flex';
      }
    };

    const close = () => { overlay.remove(); if (typeof onCancel === 'function') onCancel(); };
    overlay.querySelector('.cv-modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.cv-modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const passInp = overlay.querySelector('#cvPassInput')?.value || '';
      const repeatInp = overlay.querySelector('#cvPassRepeatInput')?.value || '';
      const oldInp = overlay.querySelector('#cvPassOldInput')?.value || '';

      if (mode === 'set' || mode === 'change') {
        if (!passInp.trim()) {
          showError('Пароль не может быть пустым');
          return;
        }
        if (passInp !== repeatInp) {
          showError('Введённые пароли не совпадают');
          return;
        }
      }

      if (typeof onConfirm === 'function') {
        const success = await onConfirm({ password: passInp, repeat: repeatInp, oldPassword: oldInp });
        if (success === false) {
          showError('Неверный пароль. Попробуйте снова.');
          return;
        }
      }
      overlay.remove();
    });

    const escHandler = e => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
  }

  // Native Movie Picker Modal (Replaces browser prompt for "Фильм жизни")
  function showMoviePickerModal({ onSelect }) {
    closeActiveNativeModal();
    const overlay = document.createElement('div');
    overlay.className = 'cv-native-modal-overlay';
    overlay.setAttribute('role', 'dialog');

    overlay.innerHTML = `
      <div class="cv-native-modal-card" style="width:min(100%, 540px)">
        <button type="button" class="cv-modal-close-btn" aria-label="Закрыть">✕</button>
        <div class="cv-modal-header">
          <div class="cv-modal-icon-badge">🎬</div>
          <div>
            <h3 class="cv-modal-title">Выбор «Фильма жизни»</h3>
            <p class="cv-modal-desc">Найдите фильм в единой базе TMDB и Кинопоиска или введите вручную.</p>
          </div>
        </div>

        <div style="position:relative;margin:14px 0 10px">
          <input type="search" id="cvMoviePickerSearch" placeholder="Название фильма (например, Интерстеллар)..." style="width:100%;padding:12px 14px;background:#080c16;border:1px solid #333c52;border-radius:12px;color:#f3f6fc;font:inherit;outline:none">
        </div>

        <div class="cv-picker-results" id="cvMoviePickerResults">
          <div style="font-size:12px;color:#8590a8;text-align:center;padding:24px 0">Начните вводить название киношедевра...</div>
        </div>

        <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <button type="button" class="site-btn" id="cvMovieManualBtn" style="font-size:11.5px">Ввести название вручную</button>
          <button type="button" class="site-btn cv-modal-cancel-btn">Отмена</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const searchInp = overlay.querySelector('#cvMoviePickerSearch');
    const resultsContainer = overlay.querySelector('#cvMoviePickerResults');
    setTimeout(() => searchInp.focus(), 60);

    let debounceTimer = null;
    searchInp.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const q = searchInp.value.trim();
      if (!q) {
        resultsContainer.innerHTML = '<div style="font-size:12px;color:#8590a8;text-align:center;padding:24px 0">Начните вводить название киношедевра...</div>';
        return;
      }
      debounceTimer = setTimeout(async () => {
        resultsContainer.innerHTML = '<div style="font-size:12px;color:#8590a8;text-align:center;padding:24px 0">Ищем в каталоге…</div>';
        try {
          if (typeof window.searchUnifiedMedia === 'function') {
            const { results } = await window.searchUnifiedMedia(q, 'movie');
            if (!results.length) {
              resultsContainer.innerHTML = '<div style="font-size:12px;color:#8590a8;text-align:center;padding:20px 0">Ничего не найдено. Можно ввести название вручную ниже.</div>';
              return;
            }
            resultsContainer.innerHTML = results.slice(0, 10).map(m => {
              const poster = m.poster || m.posterUrl || (m.poster_path ? posterUrl(m.poster_path, 'w500') : '');
              const title = m.title || m.name || m.nameRu || 'Без названия';
              const year = m.year || (m.release_date || '').slice(0, 4) || '';
              const rating = Number(m.ratingKinopoisk || m.vote_average || 0).toFixed(1);
              return `
                <div class="cv-picker-result-item" data-movie-id="${safe(m.id)}" data-movie-title="${safe(title)}" data-movie-year="${safe(year)}" data-movie-poster="${safe(poster)}">
                  ${poster ? `<img class="cv-picker-thumb" src="${safe(poster)}" alt="${safe(title)}">` : '<div class="cv-picker-thumb" style="display:grid;place-items:center;font-size:11px">🎬</div>'}
                  <div class="cv-picker-info">
                    <strong>${safe(title)}</strong>
                    <small>${safe(year)} · ${rating > 0 ? '★ ' + rating : 'CINEVA'}</small>
                  </div>
                </div>
              `;
            }).join('');
          } else {
            resultsContainer.innerHTML = '<div style="font-size:12px;color:#8590a8;text-align:center;padding:20px 0">Модуль поиска недоступен. Воспользуйтесь ручным вводом.</div>';
          }
        } catch (err) {
          resultsContainer.innerHTML = `<div style="font-size:12px;color:#ff8ca3;text-align:center;padding:20px 0">Ошибка поиска: ${safe(err.message)}</div>`;
        }
      }, 350);
    });

    resultsContainer.addEventListener('click', e => {
      const item = e.target.closest('.cv-picker-result-item');
      if (!item) return;
      const movie = {
        id: item.dataset.movieId || String(Date.now()),
        title: item.dataset.movieTitle || 'Любимый фильм',
        year: item.dataset.movieYear || '',
        poster: item.dataset.moviePoster || ''
      };
      overlay.remove();
      if (typeof onSelect === 'function') onSelect(movie);
    });

    overlay.querySelector('#cvMovieManualBtn').addEventListener('click', () => {
      const manualName = searchInp.value.trim() || 'Фильм жизни';
      overlay.remove();
      if (typeof onSelect === 'function') {
        onSelect({ id: 'manual_' + Date.now(), title: manualName, year: '', poster: '' });
      }
    });

    const close = () => overlay.remove();
    overlay.querySelector('.cv-modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.cv-modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  }

  // Native Account Switcher & Manager Modal
  function showAccountSwitcherModal() {
    closeActiveNativeModal();
    const { accounts, activeId } = getAccountsRegistry();

    const overlay = document.createElement('div');
    overlay.className = 'cv-native-modal-overlay';
    overlay.setAttribute('role', 'dialog');

    const accountsHtml = accounts.map(acc => {
      const isActive = acc.id === activeId;
      const hasPass = Boolean(acc.passwordHash);
      const rank = calculateCinemaRank(acc);
      const itemsCount = (acc.ratings || []).length + (acc.tierlists || []).length + (acc.watchlist || []).length;
      const avatarHtml = (acc.avatarType === 'image' && acc.avatar)
        ? `<img src="${safe(acc.avatar)}" class="cv-account-item-avatar" alt="">`
        : `<div class="cv-account-item-avatar">${acc.avatar || '🎬'}</div>`;

      return `
        <div class="cv-account-item ${isActive ? 'active' : ''}" data-switch-id="${safe(acc.id)}" data-has-password="${hasPass ? '1' : '0'}">
          <div class="cv-account-item-left">
            ${avatarHtml}
            <div class="cv-account-item-info">
              <div class="cv-account-item-name">
                <span>${safe(acc.username)}</span>
                ${hasPass ? '<span title="Защищён паролем" style="font-size:12px">🔒</span>' : ''}
              </div>
              <div class="cv-account-item-meta">${safe(rank.title)} · ${itemsCount} записей</div>
            </div>
          </div>
          <div>
            ${isActive ? '<span class="cv-account-badge-active">✓ Активен</span>' : '<button type="button" class="site-btn" style="padding:6px 12px;font-size:11px">Войти</button>'}
          </div>
        </div>
      `;
    }).join('');

    overlay.innerHTML = `
      <div class="cv-native-modal-card" style="width:min(100%, 520px)">
        <button type="button" class="cv-modal-close-btn" aria-label="Закрыть">✕</button>
        <div class="cv-modal-header">
          <div class="cv-modal-icon-badge">👥</div>
          <div>
            <h3 class="cv-modal-title">Переключение профилей</h3>
            <p class="cv-modal-desc">Вы можете создавать независимые аккаунты для разных коллекций кино на этом устройстве.</p>
          </div>
        </div>

        <div class="cv-accounts-list">${accountsHtml}</div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08)">
          <button type="button" class="site-btn primary" id="cvCreateAccountBtn" style="font-size:12px;padding:8px 16px">➕ Создать новый профиль</button>
          <button type="button" class="site-btn" id="cvExportAllBtn" style="font-size:12px;padding:8px 14px">💾 Бэкап всех аккаунтов</button>
          <button type="button" class="site-btn cv-modal-cancel-btn" style="margin-left:auto">Закрыть</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector('.cv-modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.cv-modal-cancel-btn').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Handle account item click
    overlay.querySelectorAll('.cv-account-item').forEach(item => {
      item.addEventListener('click', async () => {
        const targetId = item.dataset.switchId;
        if (!targetId || targetId === activeId) {
          close();
          return;
        }
        const targetAcc = accounts.find(a => a.id === targetId);
        if (!targetAcc) return;

        if (targetAcc.passwordHash) {
          // Protected account: prompt with native modal
          showPasswordModal({
            title: `Вход в профиль «${targetAcc.username}»`,
            subtitle: 'Этот аккаунт защищён паролем. Введите пароль для переключения.',
            mode: 'verify',
            onConfirm: async ({ password }) => {
              const hash = await hashPassword(password);
              if (hash !== targetAcc.passwordHash) return false;
              saveAccountsRegistry(accounts, targetId);
              showToast(`Добро пожаловать, ${targetAcc.username}!`, 'success');
              if (window.renderProfilePage) window.renderProfilePage();
              return true;
            }
          });
        } else {
          // Open account: switch directly
          saveAccountsRegistry(accounts, targetId);
          showToast(`Переключено на профиль «${targetAcc.username}»`, 'success');
          close();
          if (window.renderProfilePage) window.renderProfilePage();
        }
      });
    });

    // Handle "Создать новый профиль"
    overlay.querySelector('#cvCreateAccountBtn').addEventListener('click', () => {
      close();
      openNewAccountDialog();
    });

    // Handle "Бэкап всех аккаунтов"
    overlay.querySelector('#cvExportAllBtn').addEventListener('click', () => {
      exportAllAccountsBundle();
    });
  }

  // Dialog for creating a new profile
  function openNewAccountDialog() {
    closeActiveNativeModal();
    const overlay = document.createElement('div');
    overlay.className = 'cv-native-modal-overlay';
    overlay.setAttribute('role', 'dialog');

    overlay.innerHTML = `
      <div class="cv-native-modal-card" style="width:min(100%, 500px)">
        <button type="button" class="cv-modal-close-btn" aria-label="Закрыть">✕</button>
        <div class="cv-modal-header">
          <div class="cv-modal-icon-badge">✨</div>
          <div>
            <h3 class="cv-modal-title">Создание нового профиля</h3>
            <p class="cv-modal-desc">Задайте имя и аватар для нового синефила. Пароль можно задать сразу или оставить профиль открытым.</p>
          </div>
        </div>

        <form id="cvNewAccountForm" onsubmit="return false">
          <div class="setting-field">
            <label for="cvNewAccName">Имя нового пользователя *</label>
            <input type="text" id="cvNewAccName" maxlength="32" placeholder="Например: Любитель Хорроров" required>
          </div>

          <div class="setting-field">
            <label>Аватарка профиля</label>
            <div class="avatar-presets-grid" id="cvNewAccAvatars">
              ${AVATAR_PRESETS.slice(0, 10).map((emoji, idx) => `
                <button type="button" class="avatar-preset-btn ${idx === 0 ? 'selected' : ''}" data-new-avatar="${emoji}">${emoji}</button>
              `).join('')}
            </div>
          </div>

          <div class="setting-field">
            <label for="cvNewAccPass">Защитный пароль (опционально)</label>
            <div class="cv-password-input-wrap">
              <input type="password" id="cvNewAccPass" placeholder="Оставьте пустым для открытого профиля">
              <button type="button" class="cv-password-toggle-btn" title="Показать/скрыть">👁️</button>
            </div>
          </div>

          <div class="settings-actions" style="margin-top:22px">
            <button type="button" class="site-btn cv-modal-cancel-btn">Отмена</button>
            <button type="submit" class="site-btn primary">Создать и переключиться</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    let selectedAvatar = '🎬';
    overlay.querySelectorAll('[data-new-avatar]').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('[data-new-avatar]').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = btn.dataset.newAvatar;
      });
    });

    overlay.querySelector('.cv-password-toggle-btn').addEventListener('click', e => {
      const inp = overlay.querySelector('#cvNewAccPass');
      if (inp.type === 'password') { inp.type = 'text'; e.target.textContent = '🙈'; }
      else { inp.type = 'password'; e.target.textContent = '👁️'; }
    });

    const close = () => overlay.remove();
    overlay.querySelector('.cv-modal-close-btn').addEventListener('click', close);
    overlay.querySelector('.cv-modal-cancel-btn').addEventListener('click', close);

    overlay.querySelector('#cvNewAccountForm').addEventListener('submit', async () => {
      const name = overlay.querySelector('#cvNewAccName')?.value.trim();
      if (!name) return;
      const pass = overlay.querySelector('#cvNewAccPass')?.value || '';

      const newAcc = createDefaultAccount(name);
      newAcc.avatar = selectedAvatar;
      if (pass) {
        newAcc.passwordHash = await hashPassword(pass);
      }

      const { accounts } = getAccountsRegistry();
      accounts.push(newAcc);
      saveAccountsRegistry(accounts, newAcc.id);

      overlay.remove();
      showToast(`Профиль «${name}» успешно создан!`, 'success');
      if (window.renderProfilePage) window.renderProfilePage();
    });
  }

  // Export all accounts bundle
  function exportAllAccountsBundle() {
    const { accounts, activeId } = getAccountsRegistry();
    const bundle = {
      version: '2.5',
      appName: 'CINEVA Multi-Account Vault',
      exportedAt: new Date().toISOString(),
      activeId,
      accounts
    };
    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `cineva-vault-all-accounts-${new Date().toISOString().slice(0, 10)}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Резервная копия всех аккаунтов (${accounts.length}) сохранена!`, 'success');
  }

  // ==========================================
  // EXPORT & IMPORT ACCOUNT JSON
  // ==========================================
  function exportAccountJson() {
    const acc = getAccount();
    const exportBundle = {
      version: '2.5',
      appName: 'CINEVA Cinema Index',
      exportedAt: new Date().toISOString(),
      account: acc
    };

    const jsonStr = JSON.stringify(exportBundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (acc.handle || acc.username || 'user').toLowerCase().replace(/[^a-z0-9а-яё]/gi, '-');
    a.download = `cineva-account-${safeName}.json`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Файл аккаунта JSON успешно сохранён!', 'success');
  }

  async function importAccountJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const parsed = JSON.parse(e.target.result);

        // Check if multi-vault format
        if (Array.isArray(parsed.accounts) && parsed.accounts.length) {
          const { accounts } = getAccountsRegistry();
          let addedCount = 0;
          parsed.accounts.forEach(imp => {
            if (!imp.id || !imp.username) return;
            const existingIdx = accounts.findIndex(a => a.id === imp.id);
            if (existingIdx >= 0) {
              accounts[existingIdx] = imp;
            } else {
              accounts.push(imp);
              addedCount++;
            }
          });
          const targetActive = parsed.activeId || parsed.accounts[0].id;
          saveAccountsRegistry(accounts, targetActive);
          showToast(`Импортировано аккаунтов: ${parsed.accounts.length}!`, 'success');
          if (window.renderProfilePage) window.renderProfilePage();
          return;
        }

        const importedAcc = parsed.account || (parsed.username ? parsed : null);
        if (!importedAcc || !importedAcc.username) {
          throw new Error('Некорректная структура файла аккаунта CINEVA.');
        }

        // If account has passwordHash, verify using native password modal
        if (importedAcc.passwordHash) {
          showPasswordModal({
            title: `Импорт профиля «${importedAcc.username}»`,
            subtitle: 'Этот аккаунт защищён паролем. Введите пароль для подтверждения импорта.',
            mode: 'verify',
            onConfirm: async ({ password }) => {
              const enteredHash = await hashPassword(password);
              if (enteredHash !== importedAcc.passwordHash) return false;
              saveAccount(importedAcc);
              showToast(`Добро пожаловать, ${importedAcc.username}! Профиль успешно импортирован.`, 'success');
              if (window.renderProfilePage) window.renderProfilePage();
              return true;
            }
          });
          return;
        }

        saveAccount(importedAcc);
        showToast(`Добро пожаловать, ${importedAcc.username}! Профиль успешно загружен.`, 'success');
        if (window.renderProfilePage) window.renderProfilePage();
      } catch (err) {
        showToast('Ошибка импорта: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  // ==========================================
  // PROFILE CONTENT OPERATIONS
  // ==========================================
  function addRatingToProfile(ratingItem) {
    const acc = getAccount();
    if (!Array.isArray(acc.ratings)) acc.ratings = [];

    const idx = acc.ratings.findIndex(r => String(r.id) === String(ratingItem.id));
    if (idx >= 0) {
      acc.ratings[idx] = ratingItem;
    } else {
      acc.ratings.unshift(ratingItem);
    }

    saveAccount(acc);
    showToast(`⭐ Оценка «${ratingItem.title}» сохранена в профиль!`, 'success');
    if (window.renderProfilePage) window.renderProfilePage();
  }

  function deleteRatingFromProfile(ratingId) {
    const acc = getAccount();
    if (!Array.isArray(acc.ratings)) return;
    acc.ratings = acc.ratings.filter(r => String(r.id) !== String(ratingId));
    if (acc.pinnedRatingId === ratingId) acc.pinnedRatingId = '';
    saveAccount(acc);
    showToast('Оценка удалена из профиля', 'info');
    if (window.renderProfilePage) window.renderProfilePage();
  }

  function addTierlistToProfile(tierlistData) {
    const acc = getAccount();
    if (!Array.isArray(acc.tierlists)) acc.tierlists = [];

    const existingIdx = acc.tierlists.findIndex(t => t.id === tierlistData.id);
    if (existingIdx >= 0) {
      acc.tierlists[existingIdx] = tierlistData;
    } else {
      acc.tierlists.unshift(tierlistData);
    }

    saveAccount(acc);
    showToast(`🏆 Тирлист «${tierlistData.title}» сохранён в профиль!`, 'success');
    if (window.renderProfilePage) window.renderProfilePage();
  }

  function deleteTierlistFromProfile(tierlistId) {
    const acc = getAccount();
    if (!Array.isArray(acc.tierlists)) return;
    acc.tierlists = acc.tierlists.filter(t => t.id !== tierlistId);
    if (acc.pinnedTierlistId === tierlistId) acc.pinnedTierlistId = '';
    saveAccount(acc);
    showToast('Тирлист удалён из профиля', 'info');
    if (window.renderProfilePage) window.renderProfilePage();
  }

  // ==========================================
  // TOPBAR BADGE SYNCHRONIZATION
  // ==========================================
  function updateNavProfileBadge() {
    const acc = getAccount();
    const avatarEl = byId('navProfileAvatar');
    const nameEl = byId('navProfileName');
    const countEl = byId('navWatchlistCount');

    if (avatarEl) {
      if (acc.avatarType === 'image' && acc.avatar) {
        avatarEl.innerHTML = `<img src="${safe(acc.avatar)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">`;
      } else {
        avatarEl.textContent = acc.avatar || '👤';
      }
    }
    if (nameEl) {
      nameEl.textContent = acc.username ? (acc.username.length > 14 ? acc.username.slice(0, 12) + '…' : acc.username) : 'Профиль';
    }
    if (countEl) {
      const totalActivities = (acc.watchlist || []).length;
      countEl.textContent = String(totalActivities);
    }
  }

  // ==========================================
  // PROFILE PAGE RENDERER (PROFILE.HTML)
  // ==========================================
  function renderProfilePage() {
    const profileMain = byId('page-profile');
    if (!profileMain) return;

    const acc = getAccount();
    const rank = calculateCinemaRank(acc);

    // 0. Banner Theme / Custom Background
    const heroCard = document.querySelector('.profile-hero');
    if (heroCard) {
      // Remove all theme classes first
      BANNER_THEMES.forEach(t => heroCard.classList.remove(t.class));
      heroCard.classList.remove('has-custom-banner');
      heroCard.style.backgroundImage = '';

      if (acc.bannerUrl && acc.bannerUrl.trim()) {
        heroCard.classList.add('has-custom-banner');
        heroCard.style.backgroundImage = `url("${safe(acc.bannerUrl.trim())}")`;
      } else if (acc.bannerTheme) {
        const matched = BANNER_THEMES.find(t => t.id === acc.bannerTheme);
        if (matched) heroCard.classList.add(matched.class);
      }
    }

    // 1. Avatar
    const avatarEl = byId('profileAvatarDisplay');
    if (avatarEl) {
      if (acc.avatarType === 'image' && acc.avatar) {
        avatarEl.innerHTML = `<img src="${safe(acc.avatar)}" style="width:100%;height:100%;border-radius:26px;object-fit:cover" alt="Аватар">`;
      } else {
        avatarEl.textContent = acc.avatar || '🎬';
      }
    }

    // 2. Name, Handle & Rank
    if (byId('profileUsername')) byId('profileUsername').textContent = acc.username;
    if (byId('profileHandle')) byId('profileHandle').textContent = `@${acc.handle || 'user'}`;
    if (byId('profileRankPill')) {
      byId('profileRankPill').innerHTML = `${rank.icon} <span>${safe(rank.title)}</span>`;
      byId('profileRankPill').style.borderColor = rank.color;
      byId('profileRankPill').style.color = rank.color;
    }

    // 3. Status & Bio
    if (byId('profileStatusText')) byId('profileStatusText').textContent = acc.status || 'Кино — это жизнь, в которой вырезали всё скучное';
    if (byId('profileBioText')) byId('profileBioText').textContent = acc.bio || 'Пока нет описания профиля.';

    // 4. Statistics
    const ratings = acc.ratings || [];
    const watchlist = acc.watchlist || [];
    const tierlists = acc.tierlists || [];

    let avgScore = '—';
    if (ratings.length) {
      const sum = ratings.reduce((a, r) => a + Number(r.score || 0), 0);
      avgScore = Math.round(sum / ratings.length) + ' / 90';
    }

    if (byId('statWatchlistCount')) byId('statWatchlistCount').textContent = String(watchlist.length);
    if (byId('statRatingsCount')) byId('statRatingsCount').textContent = String(ratings.length);
    if (byId('statTierlistsCount')) byId('statTierlistsCount').textContent = String(tierlists.length);
    if (byId('statAvgScore')) byId('statAvgScore').textContent = avgScore;

    // Tab badges count
    if (byId('tabCountWatchlist')) byId('tabCountWatchlist').textContent = String(watchlist.length);
    if (byId('tabCountRatings')) byId('tabCountRatings').textContent = String(ratings.length);
    if (byId('tabCountTierlists')) byId('tabCountTierlists').textContent = String(tierlists.length);

    // 5. Showcase Tab
    renderShowcaseTab(acc);

    // 6. Watchlist Tab
    renderWatchlistTab(watchlist);

    // 7. Ratings Tab
    renderRatingsTab(ratings, acc);

    // 8. Tierlists Tab
    renderTierlistsTab(tierlists, acc);

    // 9. Security Status & Backup Tab
    renderSecurityTab(acc);

    // 10. Sync Active Tab from URL hash
    syncTabFromHash();
  }

  function renderShowcaseTab(acc) {
    const fav = acc.favoriteMovie;
    const favContainer = byId('profileFavMovieContainer');
    if (favContainer) {
      if (fav && fav.title) {
        favContainer.innerHTML = `
          <div class="favorite-movie-hero">
            <img class="fav-movie-poster" src="${safe(fav.poster || '')}" alt="${safe(fav.title)}" onerror="this.src=''">
            <div class="fav-movie-info">
              <div class="fav-movie-kicker">ФИЛЬМ ЖИЗНИ КИНОМАНА</div>
              <h3 class="fav-movie-title">${safe(fav.title)}</h3>
              <div class="fav-movie-meta">${safe(fav.year || 'Год не указан')} · Главный фаворит</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                <a href="search.html?open=movie&id=${safe(fav.id || '')}" class="site-btn" style="text-decoration:none;padding:7px 13px;font-size:11.5px">Открыть карточку ↗</a>
                <button type="button" class="site-btn" id="changeFavMovieBtn" style="padding:7px 13px;font-size:11.5px">Сменить фильм</button>
              </div>
            </div>
          </div>
        `;
      } else {
        favContainer.innerHTML = `
          <div class="notice-card" style="padding:22px">
            <strong>Фильм жизни не выбран</strong>
            Выберите фильм, который больше всего повлиял на ваше мировоззрение, и он станет визитной карточкой вашего профиля.
            <div style="margin-top:12px">
              <button class="site-btn primary" id="setFavMovieBtn" type="button">🎬 Выбрать любимый фильм</button>
            </div>
          </div>
        `;
      }
    }

    // Genre cloud
    const genreCloud = byId('profileGenresCloud');
    if (genreCloud) {
      const genres = acc.favoriteGenres || ['Фантастика', 'Драма', 'Триллер'];
      genreCloud.innerHTML = genres.map(g => `<span class="genre-tag">${safe(g)}</span>`).join('');
    }

    // Extra Favorites (Director, TV series, Socials)
    const extraContainer = byId('profileExtraDetails');
    if (extraContainer) {
      const director = acc.favoriteDirector || '';
      const tv = acc.favoriteTv || '';
      const socials = acc.socialLinks || {};

      let html = '';
      if (director || tv) {
        html += `
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:16px">
            ${director ? `<div style="font-size:12px;color:#9bb0d3">🎬 Любимый режиссёр: <strong style="color:#f3f6fc">${safe(director)}</strong></div>` : ''}
            ${tv ? `<div style="font-size:12px;color:#9bb0d3">📺 Любимый сериал: <strong style="color:#f3f6fc">${safe(tv)}</strong></div>` : ''}
          </div>
        `;
      }
      if (socials.kinopoisk || socials.letterboxd || socials.telegram) {
        html += `
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
            ${socials.letterboxd ? `<a href="https://letterboxd.com/${safe(socials.letterboxd)}" target="_blank" rel="noopener" class="site-btn" style="text-decoration:none;font-size:11px;padding:5px 10px">Letterboxd: ${safe(socials.letterboxd)} ↗</a>` : ''}
            ${socials.kinopoisk ? `<a href="https://www.kinopoisk.ru/user/${safe(socials.kinopoisk)}" target="_blank" rel="noopener" class="site-btn" style="text-decoration:none;font-size:11px;padding:5px 10px">Кинопоиск ↗</a>` : ''}
            ${socials.telegram ? `<a href="https://t.me/${safe(socials.telegram.replace('@',''))}" target="_blank" rel="noopener" class="site-btn" style="text-decoration:none;font-size:11px;padding:5px 10px">Telegram ↗</a>` : ''}
          </div>
        `;
      }
      extraContainer.innerHTML = html;
    }

    // Pinned rating or tierlist on showcase
    const pinnedContainer = byId('profilePinnedContainer');
    if (pinnedContainer) {
      const pinnedRating = acc.pinnedRatingId ? (acc.ratings || []).find(r => r.id === acc.pinnedRatingId) : null;
      const pinnedTier = acc.pinnedTierlistId ? (acc.tierlists || []).find(t => t.id === acc.pinnedTierlistId) : null;

      if (pinnedRating || pinnedTier) {
        pinnedContainer.style.display = 'block';
        let pinnedHtml = '<div style="font-size:11px;letter-spacing:.12em;font-weight:900;color:var(--cv-accent);margin-bottom:8px">📌 ЗАКРЕПЛЕНО НА ВИТРИНЕ</div><div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px">';

        if (pinnedRating) {
          pinnedHtml += `
            <div class="rating-history-card" style="margin:0">
              <img class="rating-card-thumb" src="${safe(pinnedRating.posterUrl || '')}" alt="${safe(pinnedRating.title)}" onerror="this.src=''">
              <div class="rating-card-details">
                <div>
                  <h4 class="rating-card-title">${safe(pinnedRating.title)}</h4>
                  <div class="rating-card-meta">${safe(pinnedRating.year || '')} · Избранная рецензия</div>
                  <div class="rating-card-scores-row">
                    <span class="rating-card-score-pill">⭐ ${safe(pinnedRating.score)}/90</span>
                    <span class="rating-card-tier-pill" style="background:${safe(pinnedRating.tierColor || '#34d399')}22;color:${safe(pinnedRating.tierColor || '#34d399')}">${safe(pinnedRating.tierShort || pinnedRating.tier || 'Ранг')}</span>
                  </div>
                </div>
                <div class="rating-card-actions">
                  <button type="button" class="rating-card-btn" data-load-rating-id="${safe(pinnedRating.id)}">В калькулятор ↗</button>
                  <button type="button" class="rating-card-btn" data-unpin-rating="${safe(pinnedRating.id)}" title="Открепить">📌 Открепить</button>
                </div>
              </div>
            </div>
          `;
        }

        if (pinnedTier) {
          const rows = pinnedTier.rows || [];
          const stripes = rows.map(r => `<span class="tierlist-card-stripe" style="background:${safe(r.color || '#ff4466')}"></span>`).join('');
          pinnedHtml += `
            <div class="tierlist-history-card" style="margin:0">
              <div class="tierlist-card-stripes">${stripes}</div>
              <div class="tierlist-card-head">
                <h3 class="tierlist-card-title">${safe(pinnedTier.title || 'Тирлист')}</h3>
              </div>
              <div style="display:flex;gap:8px;margin-top:auto">
                <button type="button" class="site-btn primary" style="padding:6px 11px;font-size:11px" data-load-tierlist-id="${safe(pinnedTier.id)}">Открыть тирлист ↗</button>
                <button type="button" class="site-btn" style="padding:6px 11px;font-size:11px" data-unpin-tierlist="${safe(pinnedTier.id)}">📌 Открепить</button>
              </div>
            </div>
          `;
        }

        pinnedHtml += '</div>';
        pinnedContainer.innerHTML = pinnedHtml;
      } else {
        pinnedContainer.style.display = 'none';
        pinnedContainer.innerHTML = '';
      }
    }
  }

  function renderWatchlistTab(list) {
    const grid = byId('profileWatchlistGrid');
    const status = byId('profileWatchlistStatus');
    const clearBtn = byId('watchlistClearBtn');
    if (!grid || !status) return;

    if (!list.length) {
      status.textContent = 'Список избранного пуст.';
      grid.innerHTML = '<div class="notice-card" style="grid-column:1/-1"><strong>Пока ничего не сохранено</strong>Открывайте карточки в каталоге или поиске и нажимайте «В избранное».</div>';
      if (clearBtn) clearBtn.style.display = 'none';
      return;
    }

    status.textContent = `Сохранено произведений: ${list.length}`;
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    grid.innerHTML = list.map(item => {
      const type = item.media_type || item.type || 'movie';
      const source = item.source || (item.kinopoiskId ? 'kinopoisk' : 'tmdb');
      const poster = item.poster || item.posterUrl || (item.poster_path ? posterUrl(item.poster_path, 'w500') : '');
      const title = item.title || item.name || item.nameRu || 'Без названия';
      const year = item.year || '';
      const kpAttr = source === 'kinopoisk' ? `data-open-source="kinopoisk" data-kp-id="${safe(item.id)}"` : '';

      return `
        <div class="watchlist-entry">
          <article class="media-card" role="button" tabindex="0" data-open-type="${safe(type)}" data-open-id="${safe(item.id)}" ${kpAttr}>
            <span class="poster-wrap">
              ${poster ? `<img src="${safe(poster)}" alt="${safe(title)}" loading="lazy">` : `<span class="no-poster">CINEVA</span>`}
            </span>
            <span class="media-title">${safe(title)}</span>
            <span class="media-meta">${safe(year)} · ${type === 'tv' ? 'Сериал' : 'Фильм'} · ${source === 'kinopoisk' ? 'КП' : 'TMDB'}</span>
          </article>
          <button class="watchlist-remove" type="button" data-watchlist-remove="${safe(item.id)}" data-watchlist-type="${safe(type)}" data-watchlist-source="${safe(source)}">Убрать из коллекции</button>
        </div>
      `;
    }).join('');
  }

  function renderRatingsTab(ratings, acc) {
    const grid = byId('profileRatingsGrid');
    const status = byId('profileRatingsStatus');
    if (!grid || !status) return;

    if (!ratings.length) {
      status.textContent = 'Вы пока не сохранили ни одной оценки.';
      grid.innerHTML = `
        <div class="notice-card" style="grid-column:1/-1">
          <strong>Оценок пока нет</strong>
          Перейдите в калькулятор «Оценка CINEVA», выставьте критерии для фильма и нажмите «Сохранить в профиль».
          <div style="margin-top:12px">
            <a href="rating.html" class="site-btn primary" style="text-decoration:none">Перейти к оценке кино ↗</a>
          </div>
        </div>
      `;
      return;
    }

    status.textContent = `Всего рецензий и оценок: ${ratings.length}`;
    grid.innerHTML = ratings.map(r => {
      const poster = r.posterUrl || '';
      const dateStr = r.ratedAt ? new Date(r.ratedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const isPinned = acc && acc.pinnedRatingId === r.id;

      return `
        <div class="rating-history-card">
          <img class="rating-card-thumb" src="${safe(poster)}" alt="${safe(r.title)}" onerror="this.src=''">
          <div class="rating-card-details">
            <div>
              <h4 class="rating-card-title" title="${safe(r.title)}">${safe(r.title)}</h4>
              <div class="rating-card-meta">${safe(r.year || '')} · ${safe(r.director || 'Режиссёр')}</div>
              <div class="rating-card-scores-row">
                <span class="rating-card-score-pill">⭐ ${safe(r.score)}/90</span>
                <span class="rating-card-tier-pill" style="background:${safe(r.tierColor || '#34d399')}22;color:${safe(r.tierColor || '#34d399')};border:1px solid ${safe(r.tierColor || '#34d399')}44">
                  ${safe(r.tierShort || r.tier || 'Ранг')}
                </span>
                <span style="font-size:11px;color:#8591ab;margin-left:auto">${safe(dateStr)}</span>
              </div>
            </div>
            <div class="rating-card-actions">
              <button type="button" class="rating-card-btn" data-load-rating-id="${safe(r.id)}">Открыть в калькуляторе ↗</button>
              <button type="button" class="rating-card-btn" data-toggle-pin-rating="${safe(r.id)}" title="${isPinned ? 'Открепить от витрины' : 'Закрепить на витрине'}">${isPinned ? '📌 Закреплено' : '📌'}</button>
              <button type="button" class="rating-card-btn del" data-delete-rating-id="${safe(r.id)}" title="Удалить оценку">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTierlistsTab(tierlists, acc) {
    const grid = byId('profileTierlistsGrid');
    const status = byId('profileTierlistsStatus');
    if (!grid || !status) return;

    if (!tierlists.length) {
      status.textContent = 'Сохранённых тирлистов пока нет.';
      grid.innerHTML = `
        <div class="notice-card" style="grid-column:1/-1">
          <strong>Тирлисты не сохранены</strong>
          Создайте ранжирование в разделе «Тирлисты» и нажмите «Сохранить в профиль».
          <div style="margin-top:12px">
            <a href="tierlist.html" class="site-btn primary" style="text-decoration:none">Создать кинотирлист ↗</a>
          </div>
        </div>
      `;
      return;
    }

    status.textContent = `Сохранённых тирлистов: ${tierlists.length}`;
    grid.innerHTML = tierlists.map(t => {
      const rows = t.rows || [];
      const totalItems = rows.reduce((a, row) => a + (row.items || []).length, 0);
      const stripes = rows.map(r => `<span class="tierlist-card-stripe" style="background:${safe(r.color || '#ff4466')}"></span>`).join('');
      const dateStr = t.savedAt ? new Date(t.savedAt).toLocaleDateString('ru-RU') : '';
      const isPinned = acc && acc.pinnedTierlistId === t.id;

      return `
        <div class="tierlist-history-card">
          <div class="tierlist-card-stripes">${stripes}</div>
          <div class="tierlist-card-head">
            <div>
              <h3 class="tierlist-card-title">${safe(t.title || 'Тирлист')}</h3>
              <div class="tierlist-card-meta">${t.kind === 'actors' ? '🎭 Актёры' : '🎬 Фильмы'} · ${totalItems} элементов · ${dateStr}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:auto;flex-wrap:wrap">
            <button type="button" class="site-btn primary" style="padding:7px 12px;font-size:11.5px" data-load-tierlist-id="${safe(t.id)}">Открыть ↗</button>
            <button type="button" class="site-btn" style="padding:7px 11px;font-size:11.5px" data-toggle-pin-tierlist="${safe(t.id)}">${isPinned ? '📌' : '📌 Закрепить'}</button>
            <button type="button" class="site-btn" style="padding:7px 11px;font-size:11.5px" data-export-tierlist-id="${safe(t.id)}">JSON</button>
            <button type="button" class="rating-card-btn del" style="padding:7px 10px" data-delete-tierlist-id="${safe(t.id)}" title="Удалить тирлист">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSecurityTab(acc) {
    const statusWrap = byId('securityStatusWrap');
    if (!statusWrap) return;

    const isProtected = Boolean(acc.passwordHash);
    statusWrap.innerHTML = `
      <div class="cv-security-status-card">
        <div>
          <div style="font-size:11px;font-weight:900;letter-spacing:0.1em;color:#8590a8;text-transform:uppercase;margin-bottom:6px">СТАТУС ЗАЩИТЫ АККАУНТА</div>
          <div class="cv-security-status-badge ${isProtected ? 'protected' : 'open'}">
            ${isProtected ? '🔒 Защищён паролем (SHA-256)' : '🔓 Открытый профиль (пароль не требуется)'}
          </div>
          <p style="font-size:12px;color:#9da8be;margin:8px 0 0;line-height:1.5">
            ${isProtected
              ? 'Пароль надёжно захеширован через Web Crypto API. Он потребуется для смены аккаунта и импорта.'
              : 'Этот аккаунт свободен для входа. Вы можете установить пароль в любой момент.'}
          </p>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${isProtected ? `
            <button type="button" class="site-btn" id="secChangePasswordBtn">🔑 Сменить пароль</button>
            <button type="button" class="site-btn" id="secRemovePasswordBtn" style="color:#ff8ca3;border-color:rgba(255,77,109,0.3)">🔓 Снять пароль</button>
          ` : `
            <button type="button" class="site-btn primary" id="secSetPasswordBtn">🔒 Установить пароль</button>
          `}
        </div>
      </div>
    `;
  }

  // ==========================================
  // PROFILE TABS CONTROLLER
  // ==========================================
  function switchProfileTab(tabName) {
    document.querySelectorAll('.profile-tab-btn').forEach(btn => {
      const active = btn.dataset.profileTab === tabName;
      btn.classList.toggle('active', active);
    });

    document.querySelectorAll('.profile-panel').forEach(panel => {
      panel.hidden = panel.id !== `tab-panel-${tabName}`;
    });

    try {
      history.replaceState(null, '', `#tab=${tabName}`);
    } catch (_) {}
  }

  function syncTabFromHash() {
    const hash = window.location.hash || '';
    const params = new URLSearchParams(window.location.search);
    let tab = 'overview';

    if (hash.includes('tab=')) {
      tab = hash.split('tab=')[1].split('&')[0];
    } else if (params.get('tab')) {
      tab = params.get('tab');
    }

    if (tab && byId(`tab-panel-${tab}`)) {
      switchProfileTab(tab);
    }
  }

  // ==========================================
  // EDIT PROFILE MODAL
  // ==========================================
  function openEditProfileModal() {
    const modal = byId('editProfileOverlay');
    if (!modal) return;

    const acc = getAccount();
    if (byId('editUsernameInp')) byId('editUsernameInp').value = acc.username || '';
    if (byId('editHandleInp')) byId('editHandleInp').value = acc.handle || '';
    if (byId('editCustomTitleInp')) byId('editCustomTitleInp').value = acc.customTitle || '';
    if (byId('editStatusInp')) byId('editStatusInp').value = acc.status || '';
    if (byId('editBioInp')) byId('editBioInp').value = acc.bio || '';
    if (byId('editFavDirectorInp')) byId('editFavDirectorInp').value = acc.favoriteDirector || '';
    if (byId('editFavTvInp')) byId('editFavTvInp').value = acc.favoriteTv || '';
    if (byId('editBannerUrlInp')) byId('editBannerUrlInp').value = acc.bannerUrl || '';

    const socials = acc.socialLinks || {};
    if (byId('editSocialKpInp')) byId('editSocialKpInp').value = socials.kinopoisk || '';
    if (byId('editSocialLetterboxdInp')) byId('editSocialLetterboxdInp').value = socials.letterboxd || '';
    if (byId('editSocialTgInp')) byId('editSocialTgInp').value = socials.telegram || '';

    // Render avatar presets
    const presetsGrid = byId('avatarPresetsGrid');
    if (presetsGrid) {
      presetsGrid.innerHTML = AVATAR_PRESETS.map(emoji => `
        <button type="button" class="avatar-preset-btn ${acc.avatar === emoji ? 'selected' : ''}" data-preset-avatar="${emoji}">${emoji}</button>
      `).join('');
    }

    // Render banner theme choices
    const themeGrid = byId('bannerThemePickerGrid');
    if (themeGrid) {
      themeGrid.innerHTML = BANNER_THEMES.map(theme => `
        <button type="button" class="cv-theme-preset-btn ${acc.bannerTheme === theme.id ? 'selected' : ''}" data-select-theme="${theme.id}" title="${theme.name}" style="background:${theme.bg}">
          ${theme.icon}
        </button>
      `).join('');
    }

    // Render genre choices
    const genreWrap = byId('genreChoicesWrap');
    if (genreWrap) {
      const allGenres = ['Фантастика', 'Драма', 'Триллер', 'Криминал', 'Киберпанк', 'Нуар', 'Детектив', 'Комедия', 'Анимация', 'Артхаус', 'Хоррор', 'Приключения', 'Документальное', 'Вестерн'];
      const currentGenres = new Set(acc.favoriteGenres || []);
      genreWrap.innerHTML = allGenres.map(g => `
        <button type="button" class="genre-select-chip ${currentGenres.has(g) ? 'active' : ''}" data-toggle-genre="${g}">${g}</button>
      `).join('');
    }

    modal.hidden = false;
  }

  function closeEditProfileModal() {
    const modal = byId('editProfileOverlay');
    if (modal) modal.hidden = true;
  }

  async function saveEditedProfile() {
    const acc = getAccount();
    const newName = byId('editUsernameInp')?.value.trim();
    if (!newName) {
      showToast('Имя пользователя не может быть пустым', 'error');
      return;
    }

    acc.username = newName;
    acc.handle = (byId('editHandleInp')?.value.trim() || acc.handle || 'user').replace(/[^a-z0-9_-]/gi, '');
    acc.customTitle = byId('editCustomTitleInp')?.value.trim() || '';
    acc.status = byId('editStatusInp')?.value.trim() || '';
    acc.bio = byId('editBioInp')?.value.trim() || '';
    acc.favoriteDirector = byId('editFavDirectorInp')?.value.trim() || '';
    acc.favoriteTv = byId('editFavTvInp')?.value.trim() || '';
    acc.bannerUrl = byId('editBannerUrlInp')?.value.trim() || '';

    acc.socialLinks = {
      kinopoisk: byId('editSocialKpInp')?.value.trim() || '',
      letterboxd: byId('editSocialLetterboxdInp')?.value.trim() || '',
      telegram: byId('editSocialTgInp')?.value.trim() || ''
    };

    // Selected theme
    const activeThemeBtn = document.querySelector('.cv-theme-preset-btn.selected');
    if (activeThemeBtn) {
      acc.bannerTheme = activeThemeBtn.dataset.selectTheme;
    }

    // Selected genres
    const activeGenres = [...(byId('genreChoicesWrap')?.querySelectorAll('.genre-select-chip.active') || [])].map(el => el.dataset.toggleGenre);
    if (activeGenres.length) acc.favoriteGenres = activeGenres;

    saveAccount(acc);
    closeEditProfileModal();
    renderProfilePage();
    showToast('Профиль успешно обновлён!', 'success');
  }

  // ==========================================
  // EVENT LISTENERS & DELEGATION
  // ==========================================
  document.addEventListener('click', async event => {
    // 1. Profile Tabs
    const tabBtn = event.target.closest('[data-profile-tab]');
    if (tabBtn) {
      switchProfileTab(tabBtn.dataset.profileTab);
      return;
    }

    // 2. Open Edit Profile Modal
    if (event.target.closest('#openEditProfileBtn') || event.target.closest('#profileAvatarEditBtn')) {
      openEditProfileModal();
      return;
    }
    if (event.target.closest('#closeEditProfileBtn') || event.target.closest('.modal-backdrop-close') === event.target) {
      closeEditProfileModal();
      return;
    }
    if (event.target.closest('#saveProfileBtn')) {
      await saveEditedProfile();
      return;
    }

    // 3. Avatar Preset Selection
    const presetBtn = event.target.closest('[data-preset-avatar]');
    if (presetBtn) {
      document.querySelectorAll('.avatar-preset-btn').forEach(b => b.classList.remove('selected'));
      presetBtn.classList.add('selected');
      const acc = getAccount();
      acc.avatarType = 'emoji';
      acc.avatar = presetBtn.dataset.presetAvatar;
      saveAccount(acc);
      return;
    }

    // 4. Banner Theme Selection
    const themeBtn = event.target.closest('[data-select-theme]');
    if (themeBtn) {
      document.querySelectorAll('.cv-theme-preset-btn').forEach(b => b.classList.remove('selected'));
      themeBtn.classList.add('selected');
      return;
    }

    // 5. Genre Select Toggle in Modal
    const genreChip = event.target.closest('[data-toggle-genre]');
    if (genreChip) {
      genreChip.classList.toggle('active');
      return;
    }

    // 6. Account Switcher Trigger
    if (event.target.closest('#openAccountSwitcherBtn')) {
      showAccountSwitcherModal();
      return;
    }

    // 7. Security: Set Password
    if (event.target.closest('#secSetPasswordBtn') || event.target.closest('#modalManagePasswordBtn')) {
      const acc = getAccount();
      showPasswordModal({
        title: 'Установка пароля аккаунта',
        subtitle: 'Придумайте надёжный пароль для защиты профиля. Хеширование выполняется локально (SHA-256).',
        mode: 'set',
        onConfirm: async ({ password }) => {
          acc.passwordHash = await hashPassword(password);
          saveAccount(acc);
          showToast('Пароль успешно установлен!', 'success');
          renderProfilePage();
          return true;
        }
      });
      return;
    }

    // 8. Security: Change Password
    if (event.target.closest('#secChangePasswordBtn')) {
      const acc = getAccount();
      showPasswordModal({
        title: 'Смена пароля аккаунта',
        subtitle: 'Введите текущий пароль, затем новый пароль.',
        mode: 'change',
        onConfirm: async ({ oldPassword, password }) => {
          const oldHash = await hashPassword(oldPassword);
          if (oldHash !== acc.passwordHash) return false;
          acc.passwordHash = await hashPassword(password);
          saveAccount(acc);
          showToast('Пароль успешно изменён!', 'success');
          renderProfilePage();
          return true;
        }
      });
      return;
    }

    // 9. Security: Remove Password (make open)
    if (event.target.closest('#secRemovePasswordBtn')) {
      const acc = getAccount();
      showPasswordModal({
        title: 'Снятие пароля аккаунта',
        subtitle: 'Введите текущий пароль, чтобы сделать этот профиль открытым (без пароля).',
        mode: 'remove',
        onConfirm: async ({ password }) => {
          const hash = await hashPassword(password);
          if (hash !== acc.passwordHash) return false;
          acc.passwordHash = '';
          saveAccount(acc);
          showToast('Пароль удалён. Профиль теперь открыт!', 'info');
          renderProfilePage();
          return true;
        }
      });
      return;
    }

    // 10. Delete Current Profile
    if (event.target.closest('#secDeleteAccountBtn')) {
      const { accounts, activeId } = getAccountsRegistry();
      const acc = accounts.find(a => a.id === activeId) || accounts[0];

      const doDelete = () => {
        const remaining = accounts.filter(a => a.id !== activeId);
        if (!remaining.length) {
          const fresh = createDefaultAccount();
          saveAccountsRegistry([fresh], fresh.id);
        } else {
          saveAccountsRegistry(remaining, remaining[0].id);
        }
        showToast('Профиль удалён', 'info');
        renderProfilePage();
      };

      if (acc.passwordHash) {
        showPasswordModal({
          title: `Удаление профиля «${acc.username}»`,
          subtitle: 'Этот профиль защищён паролем. Введите пароль для подтверждения удаления.',
          mode: 'verify',
          onConfirm: async ({ password }) => {
            const h = await hashPassword(password);
            if (h !== acc.passwordHash) return false;
            doDelete();
            return true;
          }
        });
      } else {
        showConfirmModal({
          title: `Удалить профиль «${acc.username}»?`,
          message: 'Все сохранённые в этом профиле оценки, тирлисты и история будут безвозвратно удалены.',
          confirmText: 'Да, удалить профиль',
          danger: true,
          onConfirm: doDelete
        });
      }
      return;
    }

    // 11. Export JSON
    if (event.target.closest('#exportProfileJsonBtn') || event.target.closest('#exportProfileJsonBtn2')) {
      exportAccountJson();
      return;
    }

    // 12. Import JSON trigger
    const importBtn = event.target.closest('#importProfileJsonTrigger');
    if (importBtn) {
      byId('importProfileJsonInput')?.click();
      return;
    }

    // 13. Favorite movie button (Native Movie Picker!)
    if (event.target.closest('#changeFavMovieBtn') || event.target.closest('#setFavMovieBtn')) {
      showMoviePickerModal({
        onSelect: movie => {
          const acc = getAccount();
          acc.favoriteMovie = movie;
          saveAccount(acc);
          renderProfilePage();
          showToast(`«${movie.title}» установлен как Фильм жизни!`, 'success');
        }
      });
      return;
    }

    // 14. Load Rating to Calculator from Profile
    const loadRatingBtn = event.target.closest('[data-load-rating-id]');
    if (loadRatingBtn) {
      const rId = loadRatingBtn.dataset.loadRatingId;
      const acc = getAccount();
      const item = (acc.ratings || []).find(r => String(r.id) === String(rId));
      if (item) {
        try {
          sessionStorage.setItem('cineva_rate_item', JSON.stringify(item));
        } catch (_) {}
        window.location.href = `rating.html?rateId=${encodeURIComponent(rId)}`;
      }
      return;
    }

    // 15. Delete Rating from Profile (Native Confirm)
    const delRatingBtn = event.target.closest('[data-delete-rating-id]');
    if (delRatingBtn) {
      const rId = delRatingBtn.dataset.deleteRatingId;
      showConfirmModal({
        title: 'Удалить оценку?',
        message: 'Эта оценка CINEVA будет удалена из архива вашего профиля.',
        confirmText: 'Удалить',
        danger: true,
        onConfirm: () => deleteRatingFromProfile(rId)
      });
      return;
    }

    // 16. Toggle Pin Rating to Showcase
    const pinRatingBtn = event.target.closest('[data-toggle-pin-rating]');
    if (pinRatingBtn) {
      const rId = pinRatingBtn.dataset.togglePinRating;
      const acc = getAccount();
      acc.pinnedRatingId = acc.pinnedRatingId === rId ? '' : rId;
      saveAccount(acc);
      showToast(acc.pinnedRatingId ? 'Оценка закреплена на витрине!' : 'Оценка откреплена', 'success');
      renderProfilePage();
      return;
    }
    const unpinRatingBtn = event.target.closest('[data-unpin-rating]');
    if (unpinRatingBtn) {
      const acc = getAccount();
      acc.pinnedRatingId = '';
      saveAccount(acc);
      renderProfilePage();
      return;
    }

    // 17. Load Tierlist from Profile to Editor
    const loadTierBtn = event.target.closest('[data-load-tierlist-id]');
    if (loadTierBtn) {
      const tId = loadTierBtn.dataset.loadTierlistId;
      const acc = getAccount();
      const item = (acc.tierlists || []).find(t => String(t.id) === String(tId));
      if (item) {
        const key = item.kind === 'actors' ? 'cineva_tierlist_actors' : 'cineva_tierlist_movies';
        try {
          localStorage.setItem(key, JSON.stringify(item));
        } catch (_) {}
        window.location.href = `tierlist.html?kind=${item.kind || 'movies'}`;
      }
      return;
    }

    // 18. Toggle Pin Tierlist to Showcase
    const pinTierBtn = event.target.closest('[data-toggle-pin-tierlist]');
    if (pinTierBtn) {
      const tId = pinTierBtn.dataset.togglePinTierlist;
      const acc = getAccount();
      acc.pinnedTierlistId = acc.pinnedTierlistId === tId ? '' : tId;
      saveAccount(acc);
      showToast(acc.pinnedTierlistId ? 'Тирлист закреплён на витрине!' : 'Тирлист откреплён', 'success');
      renderProfilePage();
      return;
    }
    const unpinTierBtn = event.target.closest('[data-unpin-tierlist]');
    if (unpinTierBtn) {
      const acc = getAccount();
      acc.pinnedTierlistId = '';
      saveAccount(acc);
      renderProfilePage();
      return;
    }

    // 19. Export single tierlist JSON from Profile
    const expTierBtn = event.target.closest('[data-export-tierlist-id]');
    if (expTierBtn) {
      const tId = expTierBtn.dataset.exportTierlistId;
      const acc = getAccount();
      const item = (acc.tierlists || []).find(t => String(t.id) === String(tId));
      if (item) {
        const jsonStr = JSON.stringify(item, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.download = `cineva-tierlist-${(item.title || 'list').replace(/[^a-z0-9а-яё]/gi, '-')}.json`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }
      return;
    }

    // 20. Delete Tierlist from Profile (Native Confirm)
    const delTierBtn = event.target.closest('[data-delete-tierlist-id]');
    if (delTierBtn) {
      const tId = delTierBtn.dataset.deleteTierlistId;
      showConfirmModal({
        title: 'Удалить тирлист?',
        message: 'Этот тирлист будет удалён из архива вашего профиля.',
        confirmText: 'Удалить',
        danger: true,
        onConfirm: () => deleteTierlistFromProfile(tId)
      });
      return;
    }

    // 21. Save Rating to Profile button (in rating.html)
    if (event.target.closest('#saveRatingToProfileBtn')) {
      const title = byId('title')?.value.trim();
      if (!title) {
        showToast('Сначала введите или выберите название фильма!', 'error');
        return;
      }

      const ratingObj = {
        id: ('rate_' + title.toLowerCase().replace(/[^a-zа-я0-9]/gi, '_') + '_' + (byId('year')?.value || '')),
        title,
        director: byId('director')?.value.trim() || '',
        year: byId('year')?.value.trim() || '',
        genre: byId('genre')?.value.trim() || '',
        kind: byId('kind')?.value || 'Фильм',
        posterUrl: byId('posterImg')?.getAttribute('src') || '',
        score: byId('score')?.textContent || '50',
        valueScore: byId('valueScore')?.textContent || '15.00',
        tier: byId('tierPill')?.textContent || 'ИЗУМРУДНЫЙ ФИЛЬМ',
        tierShort: byId('previewTierShort')?.textContent || 'Изумруд',
        tierColor: getComputedStyle(document.documentElement).getPropertyValue('--tier-color').trim() || '#34d399',
        ratedAt: new Date().toISOString(),
        criteria: {
          story: byId('story')?.value || 5,
          structure: byId('structure')?.value || 5,
          craft: byId('craft')?.value || 5,
          characters: byId('characters')?.value || 5,
          vibe: byId('vibe')?.value || 5,
          rarityGenre: byId('rarityGenre')?.value || 1,
          rarityFormat: byId('rarityFormat')?.value || 1,
          integFormat: byId('integFormat')?.value || 1,
          integGenre: byId('integGenre')?.value || 1.5,
          integMeaning: byId('integMeaning')?.value || 1,
          depth: byId('depth')?.value || 3,
          impactScale: byId('impactScale')?.value || 2,
          impactHype: byId('impactHype')?.value || 2
        }
      };

      addRatingToProfile(ratingObj);
      return;
    }

    // 22. Save Tierlist to Profile button (in tierlist.html)
    if (event.target.closest('#tierSaveToProfileBtn')) {
      if (typeof window.saveTierListStorage === 'function') window.saveTierListStorage();
      const title = byId('tierlistTitleInput')?.value.trim() || 'Мой тирлист';
      const author = byId('tierlistAuthorInput')?.value.trim() || (window.reviewerName || '');
      const board = byId('tierBoard');
      if (!board) return;

      const activeKind = document.querySelector('.tier-mode-btn.active')?.dataset.tierKind || 'movies';
      const key = activeKind === 'actors' ? 'cineva_tierlist_actors' : 'cineva_tierlist_movies';
      let data = null;
      if (typeof window.getActiveTierData === 'function') {
        data = window.getActiveTierData();
      } else {
        try {
          data = JSON.parse(localStorage.getItem(key) || '{}');
        } catch (_) {}
      }

      if (data && Array.isArray(data.rows)) {
        const tierlistRecord = {
          id: 'tier_' + Date.now().toString(36),
          title,
          author,
          kind: activeKind,
          rows: data.rows,
          unranked: data.unranked || [],
          savedAt: new Date().toISOString()
        };
        addTierlistToProfile(tierlistRecord);
      }
      return;
    }
  });

  // Handle avatar image file upload
  const avatarFileInput = byId('avatarFileInput');
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 256;
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);

          const acc = getAccount();
          acc.avatarType = 'image';
          acc.avatar = compressed;
          saveAccount(acc);
          renderProfilePage();
          showToast('Аватарка успешно обновлена!', 'success');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Handle import account file input
  const importInput = byId('importProfileJsonInput');
  if (importInput) {
    importInput.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (file) importAccountJson(file);
      importInput.value = '';
    });
  }
  const importInput2 = byId('importProfileJsonInput2');
  if (importInput2) {
    importInput2.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (file) importAccountJson(file);
      importInput2.value = '';
    });
  }

  // Hash change tab listener
  window.addEventListener('hashchange', syncTabFromHash);

  // Initialize
  updateNavProfileBadge();
  if (document.body.dataset.page === 'profile') {
    renderProfilePage();
  }

  // Global Exports
  window.showConfirmModal = showConfirmModal;
  window.showModalPrompt = showModalPrompt;
  window.showPasswordModal = showPasswordModal;
  window.showMoviePickerModal = showMoviePickerModal;
  window.showAccountSwitcherModal = showAccountSwitcherModal;

  window.accountManager = {
    getAccount,
    saveAccount,
    getAccountsRegistry,
    saveAccountsRegistry,
    showPasswordModal,
    showConfirmModal,
    showMoviePickerModal,
    showAccountSwitcherModal,
    exportAccountJson,
    importAccountJson,
    exportAllAccountsBundle,
    addRatingToProfile,
    deleteRatingFromProfile,
    addTierlistToProfile,
    deleteTierlistFromProfile,
    calculateCinemaRank,
    renderProfilePage,
    updateNavProfileBadge
  };
  window.CINEVA_ACCOUNT = window.accountManager;
})();
