/* === CINEVA ACCOUNT & PROFILE SYSTEM (ZERO-DEPENDENCY JSON & CRYPTO) === */
(() => {
  const byId = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const showToast = (msg, type) => (typeof window.showToast === 'function' ? window.showToast(msg, type) : null);
  const posterUrl = (path, size = 'w500') => (typeof window.posterUrl === 'function' ? window.posterUrl(path, size) : (path ? `https://image.tmdb.org/t/p/${size}${path}` : ''));

  // Preset movie avatars
  const AVATAR_PRESETS = ['🎬', '🍿', '🎥', '🎞️', '🕶️', '⚡', '🌌', '🛸', '🍸', '🎭', '👑', '🤖'];

  // Native SHA-256 hashing
  async function hashPassword(password) {
    if (!password) return '';
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Calculate Cinema Rank
  function calculateCinemaRank(account) {
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

  // Initial account template
  function createDefaultAccount() {
    return {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      username: 'Синефил CINEVA',
      handle: 'cinephile',
      status: 'Кино — это жизнь, в которой вырезали всё скучное',
      bio: 'Исследую кино по авторской системе CINEVA, коллекционирую редкие шедевры и составляю тирлисты.',
      avatarType: 'emoji',
      avatar: '🎬',
      favoriteMovie: {
        id: '157336',
        title: 'Интерстеллар',
        year: '2014',
        poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
      },
      favoriteGenres: ['Фантастика', 'Драма', 'Триллер'],
      joinedAt: new Date().toISOString(),
      passwordHash: '',
      watchlist: [],
      ratings: [],
      tierlists: []
    };
  }

  // ==========================================
  // MULTI-LAYER STORAGE FOR ACCOUNT
  // ==========================================
  function getAccount() {
    let acc = null;
    // 1. Try localStorage
    try {
      const raw = localStorage.getItem('cineva_user_account');
      if (raw) acc = JSON.parse(raw);
    } catch (_) {}

    // 2. Try window.name fallback (for file:// multi-page continuity)
    if (!acc) {
      try {
        if (window.name && window.name.startsWith('{')) {
          const store = JSON.parse(window.name);
          if (store && store.cineva_user_account) acc = store.cineva_user_account;
        }
      } catch (_) {}
    }

    if (!acc) {
      acc = createDefaultAccount();
      // Sync initial watchlist from legacy store if exists
      if (typeof window.getWatchlist === 'function') {
        const wl = window.getWatchlist();
        if (wl.length) acc.watchlist = wl;
      }
      saveAccount(acc);
    }

    // Two-way sync: keep account.watchlist and cineva_watchlist in lockstep
    try {
      const wlRaw = localStorage.getItem('cineva_watchlist');
      if (wlRaw) {
        const parsedWl = JSON.parse(wlRaw);
        if (Array.isArray(parsedWl) && parsedWl.length && (!acc.watchlist || !acc.watchlist.length)) {
          acc.watchlist = parsedWl;
        }
      }
    } catch (_) {}

    return acc;
  }

  function saveAccount(account) {
    if (!account) return;
    try {
      localStorage.setItem('cineva_user_account', JSON.stringify(account));
    } catch (_) {}

    try {
      sessionStorage.setItem('cineva_user_account', JSON.stringify(account));
    } catch (_) {}

    try {
      let store = {};
      if (window.name && window.name.startsWith('{')) {
        try { store = JSON.parse(window.name); } catch (_) {}
      }
      store.cineva_user_account = account;
      window.name = JSON.stringify(store);
    } catch (_) {}

    // Also sync watchlist store for compatibility
    if (Array.isArray(account.watchlist)) {
      try {
        localStorage.setItem('cineva_watchlist', JSON.stringify(account.watchlist));
      } catch (_) {}
    }

    // Also sync reviewer name if defined
    if (account.username) {
      try {
        localStorage.setItem('cinevaReviewerName', account.username);
        window.reviewerName = account.username;
      } catch (_) {}
    }

    updateNavProfileBadge();

    try {
      window.dispatchEvent(new CustomEvent('cineva-account-updated', { detail: account }));
    } catch (_) {}
  }

  // ==========================================
  // EXPORT & IMPORT ACCOUNT JSON
  // ==========================================
  function exportAccountJson() {
    const acc = getAccount();
    const exportBundle = {
      version: '2.0',
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
        const importedAcc = parsed.account || (parsed.username ? parsed : null);
        if (!importedAcc || !importedAcc.username) {
          throw new Error('Некорректная структура файла аккаунта CINEVA.');
        }

        // If account has passwordHash, prompt for verification
        if (importedAcc.passwordHash) {
          const pass = prompt('Этот аккаунт защищён паролем. Введите пароль для входа:');
          if (pass === null) return;
          const enteredHash = await hashPassword(pass);
          if (enteredHash !== importedAcc.passwordHash) {
            showToast('Неверный пароль аккаунта!', 'error');
            return;
          }
        }

        saveAccount(importedAcc);
        showToast(`Добро пожаловать, ${importedAcc.username}! Профиль успешно загружен.`, 'success');
        setTimeout(() => window.location.reload(), 400);
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

    // Replace if same ID already rated, else unshift
    const idx = acc.ratings.findIndex(r => String(r.id) === String(ratingItem.id));
    if (idx >= 0) {
      acc.ratings[idx] = ratingItem;
    } else {
      acc.ratings.unshift(ratingItem);
    }

    saveAccount(acc);
    showToast(`⭐ Оценка «${ratingItem.title}» сохранена в профиль!`, 'success');
  }

  function deleteRatingFromProfile(ratingId) {
    const acc = getAccount();
    if (!Array.isArray(acc.ratings)) return;
    acc.ratings = acc.ratings.filter(r => String(r.id) !== String(ratingId));
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
  }

  function deleteTierlistFromProfile(tierlistId) {
    const acc = getAccount();
    if (!Array.isArray(acc.tierlists)) return;
    acc.tierlists = acc.tierlists.filter(t => t.id !== tierlistId);
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

    // 1. Render Avatar
    const avatarContainer = byId('profileAvatarDisplay');
    if (avatarContainer) {
      if (acc.avatarType === 'image' && acc.avatar) {
        avatarContainer.innerHTML = `<img src="${safe(acc.avatar)}" style="width:100%;height:100%;border-radius:24px;object-fit:cover" alt="">`;
      } else {
        avatarContainer.textContent = acc.avatar || '🎬';
      }
    }

    // 2. Name & Handle
    if (byId('profileUsername')) byId('profileUsername').textContent = acc.username;
    if (byId('profileHandle')) byId('profileHandle').textContent = `@${acc.handle || 'user'}`;
    if (byId('profileRankPill')) {
      byId('profileRankPill').innerHTML = `${rank.icon} <span>${safe(rank.title)}</span>`;
      byId('profileRankPill').style.borderColor = rank.color;
      byId('profileRankPill').style.color = rank.color;
    }

    // 3. Status & Bio
    if (byId('profileStatusText')) byId('profileStatusText').textContent = acc.status || 'Киноман платформы CINEVA';
    if (byId('profileBioText')) byId('profileBioText').textContent = acc.bio || 'Пока нет описания профиля.';

    // 4. Statistics
    const ratings = acc.ratings || [];
    const watchlist = acc.watchlist || [];
    const tierlists = acc.tierlists || [];

    let avgScore = '—';
    if (ratings.length) {
      const sum = ratings.reduce((acc, r) => acc + Number(r.score || 0), 0);
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

    // 5. Showcase (Overview Tab)
    renderShowcaseTab(acc);

    // 6. Watchlist Tab
    renderWatchlistTab(watchlist);

    // 7. Ratings Tab
    renderRatingsTab(ratings);

    // 8. Tierlists Tab
    renderTierlistsTab(tierlists);

    // 9. Sync Active Tab from URL hash
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
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a href="search.html?open=movie&id=${safe(fav.id || '')}" class="site-btn" style="text-decoration:none;padding:8px 14px;font-size:12px">Открыть карточку ↗</a>
                <button type="button" class="site-btn" id="changeFavMovieBtn" style="padding:8px 14px;font-size:12px">Сменить фильм</button>
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
      const poster = item.poster || item.posterUrl || (item.poster_path ? posterUrl(item.poster_path, 'w500') : '');
      const title = item.title || item.name || item.nameRu || 'Без названия';
      const year = item.year || '';
      return `
        <div class="watchlist-entry">
          <article class="media-card" role="button" tabindex="0" data-open-type="${safe(type)}" data-open-id="${safe(item.id)}">
            <span class="poster-wrap">
              ${poster ? `<img src="${safe(poster)}" alt="${safe(title)}" loading="lazy">` : `<span class="no-poster">CINEVA</span>`}
            </span>
            <span class="media-title">${safe(title)}</span>
            <span class="media-meta">${safe(year)} · ${type === 'tv' ? 'Сериал' : 'Фильм'}</span>
          </article>
          <button class="watchlist-remove" type="button" data-watchlist-remove="${safe(item.id)}" data-watchlist-type="${safe(type)}">Убрать из коллекции</button>
        </div>
      `;
    }).join('');
  }

  function renderRatingsTab(ratings) {
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
              <button type="button" class="rating-card-btn del" data-delete-rating-id="${safe(r.id)}" title="Удалить оценку">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderTierlistsTab(tierlists) {
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
      const totalItems = rows.reduce((acc, row) => acc + (row.items || []).length, 0);
      const stripes = rows.map(r => `<span class="tierlist-card-stripe" style="background:${safe(r.color || '#ff4466')}"></span>`).join('');
      const dateStr = t.savedAt ? new Date(t.savedAt).toLocaleDateString('ru-RU') : '';

      return `
        <div class="tierlist-history-card">
          <div class="tierlist-card-stripes">${stripes}</div>
          <div class="tierlist-card-head">
            <div>
              <h3 class="tierlist-card-title">${safe(t.title || 'Тирлист')}</h3>
              <div class="tierlist-card-meta">${t.kind === 'actors' ? '🎭 Актёры' : '🎬 Фильмы'} · ${totalItems} элементов · ${dateStr}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:auto">
            <button type="button" class="site-btn primary" style="padding:7px 12px;font-size:11.5px" data-load-tierlist-id="${safe(t.id)}">Открыть в тирлисте ↗</button>
            <button type="button" class="site-btn" style="padding:7px 12px;font-size:11.5px" data-export-tierlist-id="${safe(t.id)}">JSON</button>
            <button type="button" class="rating-card-btn del" style="padding:7px 10px" data-delete-tierlist-id="${safe(t.id)}" title="Удалить тирлист">✕</button>
          </div>
        </div>
      `;
    }).join('');
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

    // Update URL hash without scroll
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
    if (byId('editStatusInp')) byId('editStatusInp').value = acc.status || '';
    if (byId('editBioInp')) byId('editBioInp').value = acc.bio || '';

    // Render avatar presets
    const presetsGrid = byId('avatarPresetsGrid');
    if (presetsGrid) {
      presetsGrid.innerHTML = AVATAR_PRESETS.map(emoji => `
        <button type="button" class="avatar-preset-btn ${acc.avatar === emoji ? 'selected' : ''}" data-preset-avatar="${emoji}">${emoji}</button>
      `).join('');
    }

    // Render genre choices
    const genreWrap = byId('genreChoicesWrap');
    if (genreWrap) {
      const allGenres = ['Фантастика', 'Драма', 'Триллер', 'Криминал', 'Киберпанк', 'Нуар', 'Детектив', 'Комедия', 'Анимация', 'Артхаус', 'Хоррор', 'Приключения'];
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
    acc.status = byId('editStatusInp')?.value.trim() || '';
    acc.bio = byId('editBioInp')?.value.trim() || '';

    // Selected genres
    const activeGenres = [...(byId('genreChoicesWrap')?.querySelectorAll('.genre-select-chip.active') || [])].map(el => el.dataset.toggleGenre);
    if (activeGenres.length) acc.favoriteGenres = activeGenres;

    // Optional Password
    const newPass = byId('editPasswordInp')?.value;
    if (newPass) {
      acc.passwordHash = await hashPassword(newPass);
      showToast('Пароль аккаунта успешно установлен!', 'success');
    }

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

    // 4. Genre Select Toggle in Modal
    const genreChip = event.target.closest('[data-toggle-genre]');
    if (genreChip) {
      genreChip.classList.toggle('active');
      return;
    }

    // 5. Export JSON
    if (event.target.closest('#exportProfileJsonBtn')) {
      exportAccountJson();
      return;
    }

    // 6. Import JSON trigger
    const importBtn = event.target.closest('#importProfileJsonTrigger');
    if (importBtn) {
      byId('importProfileJsonInput')?.click();
      return;
    }

    // 7. Favorite movie button in showcase
    if (event.target.closest('#changeFavMovieBtn') || event.target.closest('#setFavMovieBtn')) {
      const q = prompt('Введите название фильма, который хотите сделать «Фильмом жизни»:');
      if (q && q.trim()) {
        const query = q.trim();
        showToast(`Ищем «${query}» в базе…`, 'info');
        if (typeof window.searchUnifiedMedia === 'function') {
          const { results } = await window.searchUnifiedMedia(query, 'movie');
          if (results.length) {
            const m = results[0];
            const acc = getAccount();
            acc.favoriteMovie = {
              id: String(m.id),
              title: m.title || m.name || query,
              year: m.year || (m.release_date || '').slice(0, 4) || '',
              poster: m.poster || m.posterUrl || (m.poster_path ? posterUrl(m.poster_path, 'w500') : '')
            };
            saveAccount(acc);
            renderProfilePage();
            showToast(`«${acc.favoriteMovie.title}» установлен как Фильм жизни!`, 'success');
            return;
          }
        }
        // Fallback manual entry
        const acc = getAccount();
        acc.favoriteMovie = { id: 'manual_' + Date.now(), title: query, year: '', poster: '' };
        saveAccount(acc);
        renderProfilePage();
        showToast(`«${query}» добавлен как любимый фильм`, 'success');
      }
      return;
    }

    // 8. Load Rating to Calculator from Profile
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

    // 9. Delete Rating from Profile
    const delRatingBtn = event.target.closest('[data-delete-rating-id]');
    if (delRatingBtn) {
      if (confirm('Удалить эту оценку из вашего профиля?')) {
        deleteRatingFromProfile(delRatingBtn.dataset.deleteRatingId);
      }
      return;
    }

    // 10. Load Tierlist from Profile to Editor
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

    // 11. Export single tierlist JSON from Profile
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

    // 12. Delete Tierlist from Profile
    const delTierBtn = event.target.closest('[data-delete-tierlist-id]');
    if (delTierBtn) {
      if (confirm('Удалить этот тирлист из сохранённых?')) {
        deleteTierlistFromProfile(delTierBtn.dataset.deleteTierlistId);
      }
      return;
    }

    // 13. Save Rating to Profile button (in rating.html)
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

    // 14. Save Tierlist to Profile button (in tierlist.html)
    if (event.target.closest('#tierSaveToProfileBtn')) {
      if (typeof window.saveTierListStorage === 'function') window.saveTierListStorage();
      const title = byId('tierlistTitleInput')?.value.trim() || 'Мой тирлист';
      const author = byId('tierlistAuthorInput')?.value.trim() || (window.reviewerName || '');
      const board = byId('tierBoard');
      if (!board) return;

      const activeKind = document.querySelector('.tier-mode-btn.active')?.dataset.tierKind || 'movies';
      const key = activeKind === 'actors' ? 'cineva_tierlist_actors' : 'cineva_tierlist_movies';
      let data = null;
      try {
        data = JSON.parse(localStorage.getItem(key) || '{}');
      } catch (_) {}

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
        // Compress image using offscreen canvas to keep JSON size minimal
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

  // Hash change tab listener
  window.addEventListener('hashchange', syncTabFromHash);

  // Initialize
  updateNavProfileBadge();
  if (document.body.dataset.page === 'profile') {
    renderProfilePage();
  }

  // Export to window
  window.accountManager = {
    getAccount,
    saveAccount,
    exportAccountJson,
    importAccountJson,
    addRatingToProfile,
    deleteRatingFromProfile,
    addTierlistToProfile,
    deleteTierlistFromProfile,
    calculateCinemaRank,
    renderProfilePage,
    updateNavProfileBadge
  };
})();
