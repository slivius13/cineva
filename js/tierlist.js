/* === CINEVA TIER LIST SYSTEM (MOVIES & ACTORS) === */

  // TIER LIST SYSTEM (MOVIES & ACTORS)
  // ==========================================
  const DEFAULT_TIER_ROWS = [
    { id: 'row_s', label: 'S', color: '#ff4466', items: [] },
    { id: 'row_a', label: 'A', color: '#ff8c38', items: [] },
    { id: 'row_b', label: 'B', color: '#f5d130', items: [] },
    { id: 'row_c', label: 'C', color: '#2dd4bf', items: [] },
    { id: 'row_d', label: 'D', color: '#6366f1', items: [] }
  ];

  let activeTierKind = 'movies'; // 'movies' | 'actors'

  let tierStores = {
    movies: {
      title: 'Мой кинотирлист',
      author: (window.reviewerName || ''),
      rows: JSON.parse(JSON.stringify(DEFAULT_TIER_ROWS)),
      unranked: []
    },
    actors: {
      title: 'Мой тирлист актёров',
      author: (window.reviewerName || ''),
      rows: JSON.parse(JSON.stringify(DEFAULT_TIER_ROWS)),
      unranked: []
    }
  };

  function getActiveTierData() {
    return tierStores[activeTierKind];
  }

  function loadTierListStorage() {
    try {
      // Movies storage
      const savedMovies = localStorage.getItem('cineva_tierlist_movies') || localStorage.getItem('cineva_tierlist_data');
      if (savedMovies) {
        const parsed = JSON.parse(savedMovies);
        if (parsed && Array.isArray(parsed.rows)) {
          tierStores.movies = parsed;
          if (!Array.isArray(tierStores.movies.unranked)) tierStores.movies.unranked = [];
        }
      }
      // Actors storage
      const savedActors = localStorage.getItem('cineva_tierlist_actors');
      if (savedActors) {
        const parsed = JSON.parse(savedActors);
        if (parsed && Array.isArray(parsed.rows)) {
          tierStores.actors = parsed;
          if (!Array.isArray(tierStores.actors.unranked)) tierStores.actors.unranked = [];
        }
      }
    } catch (_) {}

    updateTierModeUI();
  }

  function saveTierListStorage() {
    try {
      const data = getActiveTierData();
      const titleInput = byId('tierlistTitleInput');
      const authorInput = byId('tierlistAuthorInput');
      if (titleInput) data.title = titleInput.value.trim() || (activeTierKind === 'actors' ? 'Мой тирлист актёров' : 'Мой кинотирлист');
      if (authorInput) data.author = authorInput.value.trim();

      const key = activeTierKind === 'actors' ? 'cineva_tierlist_actors' : 'cineva_tierlist_movies';
      localStorage.setItem(key, JSON.stringify(data));
      // Also sync legacy key
      if (activeTierKind === 'movies') {
        localStorage.setItem('cineva_tierlist_data', JSON.stringify(data));
      }
    } catch (_) {}
  }

  function updateTierModeUI() {
    const isActors = activeTierKind === 'actors';
    const data = getActiveTierData();

    // Mode buttons
    document.querySelectorAll('.tier-mode-btn').forEach(btn => {
      const active = btn.dataset.tierKind === activeTierKind;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    // Titles and descriptions
    const mainTitle = byId('tierlistMainTitle');
    const desc = byId('tierlistDesc');
    const searchInp = byId('tierSearchInput');
    const titleInput = byId('tierlistTitleInput');
    const authorInput = byId('tierlistAuthorInput');

    if (mainTitle) mainTitle.textContent = isActors ? 'Интерактивный тирлист актёров' : 'Интерактивный тирлист фильмов';
    if (desc) desc.textContent = isActors ? 'Ранжируй любимых актёров, актрис и режиссёров, перетаскивай портреты и делись тирлистом.' : 'Создавай собственные ранжирования кино, кастомизируй цвета и названия рядов, перетаскивай постеры и экспортируй результат.';
    if (searchInp) searchInp.placeholder = isActors ? 'Быстрый поиск актёра, актрисы или режиссёра для тирлиста…' : 'Быстрый поиск фильма или сериала для добавления в тирлист…';

    if (titleInput) titleInput.value = data.title || (isActors ? 'Мой тирлист актёров' : 'Мой кинотирлист');
    if (authorInput) authorInput.value = data.author || (window.reviewerName || '');

    // Clear search status
    const status = byId('tierSearchStatus');
    const results = byId('tierSearchResults');
    if (status) status.textContent = '';
    if (results) { results.hidden = true; results.innerHTML = ''; }
  }

  // Drag and drop global state
  let draggedItemData = null;
  let draggedSourceZone = null;
  let draggedSourceIndex = -1;

  function renderTierBoard() {
    const board = byId('tierBoard');
    if (!board) return;

    const data = getActiveTierData();

    board.innerHTML = data.rows.map((row, rIdx) => {
      const contrast = '#0a0d14';
      const itemsHtml = (row.items || []).map((item, iIdx) => renderTierCardHtml(item, row.id, iIdx)).join('');
      return `
        <div class="tier-row" data-row-id="${safe(row.id)}" data-row-index="${rIdx}">
          <div class="tier-label-box" style="background:${safe(row.color)};color:${contrast}">
            <div class="tier-label-text" contenteditable="true" spellcheck="false" data-tier-label="${safe(row.id)}" title="Нажмите для редактирования названия">${safe(row.label)}</div>
            <div class="tier-label-tools">
              <input type="color" class="tier-color-input" data-tier-color="${safe(row.id)}" value="${safe(row.color)}" title="Выбрать цвет ряда">
              ${rIdx > 0 ? `<button type="button" class="tier-tool-btn" data-tier-move="up" data-tier-index="${rIdx}" title="Поднять выше">▲</button>` : ''}
              ${rIdx < data.rows.length - 1 ? `<button type="button" class="tier-tool-btn" data-tier-move="down" data-tier-index="${rIdx}" title="Опустить ниже">▼</button>` : ''}
              <button type="button" class="tier-tool-btn" data-tier-delete="${safe(row.id)}" title="Удалить этот ряд">✕</button>
            </div>
          </div>
          <div class="tier-dropzone" data-zone="row" data-row-id="${safe(row.id)}" data-row-index="${rIdx}">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Render unranked pool
    const unrankedZone = byId('tierUnrankedZone');
    const unrankedCountEl = byId('tierUnrankedCount');
    if (unrankedCountEl) unrankedCountEl.textContent = String(data.unranked.length);
    if (unrankedZone) {
      if (data.unranked.length) {
        unrankedZone.innerHTML = data.unranked.map((item, idx) => renderTierCardHtml(item, 'unranked', idx)).join('');
      } else {
        unrankedZone.innerHTML = `<div class="tier-empty-hint">${activeTierKind === 'actors' ? 'Перетащите сюда портреты актёров или воспользуйтесь поиском выше.' : 'Перетащите сюда постеры или воспользуйтесь поиском выше.'}</div>`;
      }
    }

    bindTierDragDrop();
  }

  function renderTierCardHtml(item, zone, index) {
    const isPerson = item.media_type === 'person';
    const poster = item.poster || item.posterUrl || (isPerson ? (item.profile_path ? posterUrl(item.profile_path, 'w185') : '') : (item.poster_path ? posterUrl(item.poster_path, 'w185') : ''));
    const title = item.title || item.name || item.nameRu || 'Без названия';
    const meta = isPerson ? (item.known_for_department || 'Кино') : (item.year || releaseYear(item) || '');
    const tooltip = `${title}${meta ? ` (${meta})` : ''} · Нажмите, чтобы открыть профиль`;

    return `
      <div class="tier-item" draggable="true" tabindex="0"
           data-zone="${safe(zone)}" data-index="${index}"
           data-id="${safe(item.id)}" data-type="${safe(item.media_type || (activeTierKind==='actors'?'person':'movie'))}"
           data-source="${safe(item.source || 'tmdb')}"
           title="${safe(tooltip)}">
        ${poster ? `<img src="${safe(poster)}" alt="${safe(title)}" loading="lazy">` : `<div class="tier-item-no-img">${safe(title.slice(0, 20))}</div>`}
        <button type="button" class="tier-item-del" data-tier-card-del="${safe(zone)}" data-card-index="${index}" title="Убрать из тирлиста" aria-label="Убрать">
          <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
      </div>
    `;
  }

  function bindTierDragDrop() {
    const data = getActiveTierData();

    // 1. Draggables from board
    document.querySelectorAll('.tier-item[draggable="true"]').forEach(el => {
      el.addEventListener('dragstart', event => {
        const zone = el.dataset.zone;
        const index = parseInt(el.dataset.index, 10);
        let item = null;
        if (zone === 'unranked') item = data.unranked[index];
        else {
          const row = data.rows.find(r => r.id === zone);
          if (row) item = row.items[index];
        }
        if (!item) return;

        draggedItemData = item;
        draggedSourceZone = zone;
        draggedSourceIndex = index;
        el.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({ zone, index }));
      });

      el.addEventListener('dragend', () => {
        el.classList.remove('is-dragging');
        draggedItemData = null;
        draggedSourceZone = null;
        draggedSourceIndex = -1;
        document.querySelectorAll('.tier-drop-indicator').forEach(i => i.remove());
        document.querySelectorAll('.tier-dropzone').forEach(dz => dz.classList.remove('drag-target'));
        document.querySelectorAll('.tier-row').forEach(tr => tr.classList.remove('drag-over'));
      });
    });

    // 2. Draggables from search results
    document.querySelectorAll('.tier-search-card[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', event => {
        try {
          const item = JSON.parse(card.dataset.tierDragItem || card.dataset.tierAddItem);
          draggedItemData = item;
          draggedSourceZone = 'search';
          draggedSourceIndex = -1;
          card.classList.add('is-dragging');
          event.dataTransfer.effectAllowed = 'copyMove';
          event.dataTransfer.setData('text/plain', JSON.stringify({ zone: 'search', item }));
        } catch (_) {}
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        draggedItemData = null;
        draggedSourceZone = null;
        draggedSourceIndex = -1;
        document.querySelectorAll('.tier-drop-indicator').forEach(i => i.remove());
        document.querySelectorAll('.tier-dropzone').forEach(dz => dz.classList.remove('drag-target'));
        document.querySelectorAll('.tier-row').forEach(tr => tr.classList.remove('drag-over'));
      });
    });

    // 3. Drop zones with animated placement ghost indicator
    document.querySelectorAll('.tier-dropzone').forEach(zoneEl => {
      zoneEl.addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        zoneEl.classList.add('drag-target');
        const rowParent = zoneEl.closest('.tier-row');
        if (rowParent) rowParent.classList.add('drag-over');

        if (!draggedItemData) return;

        // Calculate insertion position between items
        const cards = [...zoneEl.querySelectorAll('.tier-item:not(.is-dragging)')];
        let insertBeforeNode = null;
        let insertIndex = cards.length;

        for (let i = 0; i < cards.length; i++) {
          const box = cards[i].getBoundingClientRect();
          const midX = box.left + box.width / 2;
          const midY = box.top + box.height;
          if (event.clientY < midY && event.clientX < midX) {
            insertBeforeNode = cards[i];
            insertIndex = i;
            break;
          }
        }

        // Get or create animated ghost placement indicator
        let indicator = zoneEl.querySelector('.tier-drop-indicator');
        if (!indicator) {
          document.querySelectorAll('.tier-drop-indicator').forEach(el => el.remove());
          indicator = document.createElement('div');
          indicator.className = 'tier-drop-indicator';
        }

        if (insertBeforeNode) {
          if (indicator.nextSibling !== insertBeforeNode) {
            zoneEl.insertBefore(indicator, insertBeforeNode);
          }
        } else {
          if (zoneEl.lastElementChild !== indicator) {
            zoneEl.appendChild(indicator);
          }
        }

        zoneEl.dataset.insertIndex = String(insertIndex);
      });

      zoneEl.addEventListener('dragleave', event => {
        if (!zoneEl.contains(event.relatedTarget)) {
          zoneEl.classList.remove('drag-target');
          const rowParent = zoneEl.closest('.tier-row');
          if (rowParent) rowParent.classList.remove('drag-over');
          const indicator = zoneEl.querySelector('.tier-drop-indicator');
          if (indicator) indicator.remove();
        }
      });

      zoneEl.addEventListener('drop', event => {
        event.preventDefault();
        zoneEl.classList.remove('drag-target');
        const rowParent = zoneEl.closest('.tier-row');
        if (rowParent) rowParent.classList.remove('drag-over');
        const indicator = zoneEl.querySelector('.tier-drop-indicator');
        if (indicator) indicator.remove();

        if (!draggedItemData) return;

        const targetZone = zoneEl.dataset.zone === 'unranked' ? 'unranked' : zoneEl.dataset.rowId;
        const insertIndex = parseInt(zoneEl.dataset.insertIndex || '-1', 10);
        const data = getActiveTierData();

        // Remove from source if moved within board
        if (draggedSourceZone === 'unranked') {
          data.unranked.splice(draggedSourceIndex, 1);
        } else if (draggedSourceZone && draggedSourceZone !== 'search') {
          const srcRow = data.rows.find(r => r.id === draggedSourceZone);
          if (srcRow) srcRow.items.splice(draggedSourceIndex, 1);
        }

        // Target array
        let targetArr;
        if (targetZone === 'unranked') {
          targetArr = data.unranked;
        } else {
          const tgtRow = data.rows.find(r => r.id === targetZone);
          if (tgtRow) targetArr = tgtRow.items;
        }

        if (targetArr) {
          // If already in target zone, remove old duplicate
          const dupIdx = targetArr.findIndex(i => String(i.id) === String(draggedItemData.id));
          if (dupIdx >= 0) targetArr.splice(dupIdx, 1);

          if (insertIndex >= 0 && insertIndex <= targetArr.length) {
            targetArr.splice(insertIndex, 0, draggedItemData);
          } else {
            targetArr.push(draggedItemData);
          }
        }

        saveTierListStorage();
        renderTierBoard();
        showToast(`«${draggedItemData.title}» перемещён!`, 'success');
      });
    });
  }

  // Tier Search
  const tierSearchInput = byId('tierSearchInput');
  const tierSearchBtn = byId('tierSearchBtn');
  const tierSearchStatus = byId('tierSearchStatus');
  const tierSearchResults = byId('tierSearchResults');
  let tierSearchDebounce = null;

  async function runTierSearch(query) {
    if (!query || query.length < 2) {
      if (tierSearchStatus) tierSearchStatus.textContent = 'Введи хотя бы два символа для поиска.';
      if (tierSearchResults) { tierSearchResults.hidden = true; tierSearchResults.innerHTML = ''; }
      return;
    }

    const isActors = activeTierKind === 'actors';
    if (tierSearchStatus) tierSearchStatus.textContent = isActors ? 'Ищем актёров в базе TMDB…' : 'Ищем в TMDB и Кинопоиске…';

    let items = [];
    if (isActors) {
      try {
        const persons = await searchTmdbGlobal(query, 'person');
        items = persons.map(p => ({
          id: String(p.id),
          title: p.name || 'Без имени',
          poster: posterUrl(p.profile_path, 'w500'),
          poster_thumb: posterUrl(p.profile_path, 'w185'),
          known_for_department: p.known_for_department || 'Кино',
          media_type: 'person',
          source: 'tmdb'
        }));
      } catch (_) {}
    } else {
      const { results } = await searchUnifiedMedia(query, 'multi');
      items = results.map(item => ({
        id: String(item.id || item.kinopoiskId),
        title: item.title || item.name || item.nameRu || 'Без названия',
        year: releaseYear(item),
        poster: item.poster || item.posterUrl || (item.poster_path ? posterUrl(item.poster_path, 'w500') : ''),
        poster_thumb: item.poster || item.posterUrlPreview || (item.poster_path ? posterUrl(item.poster_path, 'w185') : ''),
        media_type: item.media_type || 'movie',
        source: item.source || 'tmdb'
      }));
    }

    if (!items.length) {
      if (tierSearchStatus) tierSearchStatus.textContent = 'Ничего не найдено. Проверьте правильность написания.';
      if (tierSearchResults) { tierSearchResults.hidden = true; tierSearchResults.innerHTML = ''; }
      return;
    }

    if (tierSearchStatus) {
      tierSearchStatus.textContent = `Найдено ${items.length} совпадений. Кликните или перетащите в любую колонку:`;
    }

    if (tierSearchResults) {
      tierSearchResults.innerHTML = items.slice(0, 18).map(item => {
        const itemJson = JSON.stringify(item);
        const meta = isActors ? (item.known_for_department || 'Кино') : (item.year || 'Год не указан');
        return `
          <div class="tier-search-card" draggable="true" tabindex="0" role="button"
               data-tier-add-item='${safe(itemJson)}' data-tier-drag-item='${safe(itemJson)}'
               title="Кликните для добавления или перетащите в любую колонку">
            <div class="poster-thumb">
              ${item.poster_thumb ? `<img src="${safe(item.poster_thumb)}" alt="" loading="lazy">` : `<div style="height:100%;display:grid;place-items:center;font-size:10px;color:#7e8aa2">CINEVA</div>`}
            </div>
            <strong>${safe(item.title)}</strong>
            <span>${safe(meta)}</span>
          </div>
        `;
      }).join('');
      tierSearchResults.hidden = false;
      bindTierDragDrop();
    }
  }

  if (tierSearchInput) {
    tierSearchInput.addEventListener('input', () => {
      clearTimeout(tierSearchDebounce);
      const q = tierSearchInput.value.trim();
      tierSearchDebounce = setTimeout(() => runTierSearch(q), 320);
    });
    tierSearchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        clearTimeout(tierSearchDebounce);
        runTierSearch(tierSearchInput.value.trim());
      }
    });
  }
  if (tierSearchBtn) {
    tierSearchBtn.addEventListener('click', () => {
      clearTimeout(tierSearchDebounce);
      runTierSearch(tierSearchInput ? tierSearchInput.value.trim() : '');
    });
  }

  // Tierlist Events Delegation
  document.addEventListener('click', event => {
    // 0. Switcher between Movies and Actors Mode
    const modeBtn = event.target.closest('[data-tier-kind]');
    if (modeBtn) {
      const newKind = modeBtn.dataset.tierKind;
      if (newKind && newKind !== activeTierKind) {
        saveTierListStorage();
        activeTierKind = newKind;
        updateTierModeUI();
        renderTierBoard();
        showToast(activeTierKind === 'actors' ? 'Переключено на тирлист актёров 🎭' : 'Переключено на тирлист фильмов 🎬', 'info');
      }
      return;
    }

    // 1. Add item from tier search results
    const addBtn = event.target.closest('[data-tier-add-item]');
    if (addBtn) {
      try {
        const item = JSON.parse(addBtn.dataset.tierAddItem);
        const data = getActiveTierData();
        const alreadyInTier = data.rows.some(r => r.items.some(i => String(i.id) === String(item.id))) || data.unranked.some(i => String(i.id) === String(item.id));
        if (alreadyInTier) {
          showToast(`«${item.title}» уже есть в тирлисте`, 'info');
        } else {
          data.unranked.unshift(item);
          saveTierListStorage();
          renderTierBoard();
          showToast(`«${item.title}» добавлен в нераспределённые`, 'success');
        }
      } catch (_) {}
      return;
    }

    // 2. Click on tier item poster -> Open Movie / Actor Details!
    const tierCard = event.target.closest('.tier-item');
    const delBtn = event.target.closest('.tier-item-del');
    if (tierCard && !delBtn) {
      const id = tierCard.dataset.id;
      const type = tierCard.dataset.type || (activeTierKind === 'actors' ? 'person' : 'movie');
      const source = tierCard.dataset.source || 'tmdb';

      if (type === 'person') {
        openPerson(id);
      } else if (source === 'kinopoisk') {
        openKinopoiskTitle(id);
      } else {
        openTitle(id, type);
      }
      return;
    }

    // 3. Delete tier item (✕)
    if (delBtn) {
      event.stopPropagation();
      const zone = delBtn.dataset.tierCardDel;
      const idx = parseInt(delBtn.dataset.cardIndex, 10);
      const data = getActiveTierData();
      if (zone === 'unranked') {
        data.unranked.splice(idx, 1);
      } else {
        const row = data.rows.find(r => r.id === zone);
        if (row) row.items.splice(idx, 1);
      }
      saveTierListStorage();
      renderTierBoard();
      return;
    }

    // 4. Move row up / down
    const moveBtn = event.target.closest('[data-tier-move]');
    if (moveBtn) {
      const dir = moveBtn.dataset.tierMove;
      const idx = parseInt(moveBtn.dataset.tierIndex, 10);
      const data = getActiveTierData();
      if (dir === 'up' && idx > 0) {
        const temp = data.rows[idx];
        data.rows[idx] = data.rows[idx - 1];
        data.rows[idx - 1] = temp;
      } else if (dir === 'down' && idx < data.rows.length - 1) {
        const temp = data.rows[idx];
        data.rows[idx] = data.rows[idx + 1];
        data.rows[idx + 1] = temp;
      }
      saveTierListStorage();
      renderTierBoard();
      return;
    }

    // 5. Delete Row
    const delRowBtn = event.target.closest('[data-tier-delete]');
    if (delRowBtn) {
      const rowId = delRowBtn.dataset.tierDelete;
      const data = getActiveTierData();
      if (data.rows.length <= 1) {
        showToast('Нельзя удалить единственный оставшийся ряд!', 'error');
        return;
      }
      const rowIdx = data.rows.findIndex(r => r.id === rowId);
      if (rowIdx >= 0) {
        const orphaned = data.rows[rowIdx].items || [];
        data.unranked.push(...orphaned);
        data.rows.splice(rowIdx, 1);
        saveTierListStorage();
        renderTierBoard();
        showToast('Ряд удалён, элементы перемещены в нераспределённые', 'info');
      }
      return;
    }

    // 6. Add new Row
    if (event.target.closest('#tierAddRowBtn')) {
      const colors = ['#ec4899', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];
      const data = getActiveTierData();
      const newColor = colors[data.rows.length % colors.length];
      const newId = 'row_' + Date.now();
      data.rows.push({
        id: newId,
        label: 'НОВЫЙ',
        color: newColor,
        items: []
      });
      saveTierListStorage();
      renderTierBoard();
      showToast('Новый ряд добавлен в тирлист', 'success');
      return;
    }

    // 7. Load from Watchlist
    if (event.target.closest('#tierLoadWatchlistBtn')) {
      const wl = getWatchlist();
      if (!wl.length) {
        showToast('Ваш список избранного пуст.', 'info');
        return;
      }
      const data = getActiveTierData();
      let added = 0;
      wl.forEach(item => {
        const isPerson = item.media_type === 'person' || item.type === 'person';
        if (activeTierKind === 'actors' && !isPerson) return;
        if (activeTierKind === 'movies' && isPerson) return;

        const alreadyInTier = data.rows.some(r => r.items.some(i => String(i.id) === String(item.id))) || data.unranked.some(i => String(i.id) === String(item.id));
        if (!alreadyInTier) {
          data.unranked.push({
            id: String(item.id),
            title: item.title || item.name || 'Без названия',
            year: releaseYear(item),
            poster: item.poster || item.posterUrl || (item.poster_path ? posterUrl(item.poster_path, 'w500') : ''),
            media_type: item.media_type || (isPerson ? 'person' : 'movie'),
            source: item.source || 'tmdb'
          });
          added++;
        }
      });
      saveTierListStorage();
      renderTierBoard();
      showToast(`Добавлено из избранного: ${added} элементов`, 'success');
      return;
    }

    // 8. Clear Pool
    if (event.target.closest('#tierClearPoolBtn')) {
      const data = getActiveTierData();
      if (data.unranked.length && confirm('Очистить список нераспределённых элементов?')) {
        data.unranked = [];
        saveTierListStorage();
        renderTierBoard();
        showToast('Пул нераспределённых элементов очищен', 'info');
      }
      return;
    }

    // 9. Reset Tier List
    if (event.target.closest('#tierResetBtn')) {
      if (confirm(`Сбросить тирлист ${activeTierKind === 'actors' ? 'актёров' : 'фильмов'} к начальному состоянию?`)) {
        const data = getActiveTierData();
        data.rows = JSON.parse(JSON.stringify(DEFAULT_TIER_ROWS));
        data.unranked = [];
        saveTierListStorage();
        renderTierBoard();
        showToast('Тирлист сброшен к стандартным рядам', 'info');
      }
      return;
    }

    // 10. Export JSON
    if (event.target.closest('#tierExportJsonBtn')) {
      saveTierListStorage();
      const data = getActiveTierData();
      const jsonStr = JSON.stringify({ kind: activeTierKind, ...data }, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (data.title || `cineva-tierlist-${activeTierKind}`).replace(/[^a-zа-я0-9]/gi, '-');
      a.download = `${safeTitle}.json`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Файл тирлиста JSON сохранён!', 'success');
      return;
    }

    // 11. Export PNG
    if (event.target.closest('#tierExportPngBtn')) {
      exportTierListPng();
      return;
    }
  });

  // Color picker change event
  document.addEventListener('change', event => {
    const colorInput = event.target.closest('[data-tier-color]');
    if (colorInput) {
      const rowId = colorInput.dataset.tierColor;
      const data = getActiveTierData();
      const row = data.rows.find(r => r.id === rowId);
      if (row) {
        row.color = colorInput.value;
        saveTierListStorage();
        renderTierBoard();
      }
      return;
    }

    // Import JSON file input
    const jsonFileInput = event.target.closest('#tierImportJsonInput');
    if (jsonFileInput && jsonFileInput.files && jsonFileInput.files[0]) {
      const file = jsonFileInput.files[0];
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (parsed && Array.isArray(parsed.rows)) {
            const kind = parsed.kind === 'actors' ? 'actors' : 'movies';
            activeTierKind = kind;
            tierStores[kind] = parsed;
            if (!Array.isArray(tierStores[kind].unranked)) tierStores[kind].unranked = [];
            saveTierListStorage();
            updateTierModeUI();
            renderTierBoard();
            showToast('Тирлист успешно загружен из файла!', 'success');
          } else {
            showToast('Неверный формат JSON-файла тирлиста', 'error');
          }
        } catch (err) {
          showToast('Ошибка при чтении файла JSON: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
      jsonFileInput.value = '';
      return;
    }
  });

  // Label inline editing blur
  document.addEventListener('blur', event => {
    const labelEl = event.target.closest('[data-tier-label]');
    if (labelEl) {
      const rowId = labelEl.dataset.tierLabel;
      const data = getActiveTierData();
      const row = data.rows.find(r => r.id === rowId);
      if (row) {
        row.label = labelEl.textContent.trim() || '—';
        saveTierListStorage();
      }
    }
    if (event.target.id === 'tierlistTitleInput' || event.target.id === 'tierlistAuthorInput') {
      saveTierListStorage();
    }
  }, true);

  // PNG Export Generator with Canvas (CINEVA aesthetic & zero voids)
  async function exportTierListPng() {
    const exportBtn = byId('tierExportPngBtn');
    if (exportBtn) { exportBtn.disabled = true; exportBtn.textContent = 'Рендерим PNG…'; }
    try {
      const data = getActiveTierData();
      const isActors = activeTierKind === 'actors';

      // 1. Analyze items to calculate optimal non-empty dimensions
      const maxItemsInRow = Math.max(0, ...data.rows.map(r => (r.items || []).length));
      // Adaptive columns: min 4, max 9 cols, exactly matching content width without right-side voids
      const maxCols = Math.min(9, Math.max(4, maxItemsInRow));

      const cardW = 90;
      const cardH = 135; // True 2:3 poster/portrait aspect ratio
      const cardGap = 10;
      const rowPad = 12;
      const labelW = 120;
      const pad = 36;

      const gridW = maxCols * cardW + (maxCols - 1) * cardGap;
      const W = pad * 2 + labelW + rowPad * 2 + gridW;

      // Calculate dynamic row heights (compact empty rows, multi-line rows if items > maxCols)
      const rowLayouts = data.rows.map(row => {
        const count = (row.items || []).length;
        if (count === 0) {
          return { row, rowHeight: 68, rowsCount: 0 };
        }
        const rowsCount = Math.ceil(count / maxCols);
        const rowHeight = rowPad * 2 + rowsCount * cardH + (rowsCount - 1) * cardGap;
        return { row, rowHeight, rowsCount };
      });

      const totalRowsH = rowLayouts.reduce((acc, r) => acc + r.rowHeight, 0);
      const rowGap = 9;
      const headerH = 104;
      const footerH = 40;
      const H = pad * 2 + headerH + totalRowsH + (data.rows.length - 1) * rowGap + footerH;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');

      // 1. Deep cinematic background matching CINEVA Rating Card
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#151b2a');
      bg.addColorStop(0.48, '#0e111a');
      bg.addColorStop(1, '#07080e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Radial ambient glow in the upper-right corner
      const glow = ctx.createRadialGradient(W - 100, 80, 20, W - 100, 80, 480);
      glow.addColorStop(0, isActors ? 'rgba(189, 131, 255, 0.18)' : 'rgba(197, 255, 101, 0.16)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // Glassmorphic Outer Card Frame
      ctx.fillStyle = 'rgba(9, 12, 20, 0.74)';
      roundedRect(ctx, 18, 18, W - 36, H - 36, 26);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
      ctx.lineWidth = 1.5;
      roundedRect(ctx, 18, 18, W - 36, H - 36, 26);
      ctx.stroke();

      // 2. Header (CINEVA Brand + Title + Author Badge)
      const topY = 36;

      // CINEVA Logo Mark
      const logoGrad = ctx.createLinearGradient(pad, topY, pad + 38, topY + 38);
      logoGrad.addColorStop(0, isActors ? '#bd83ff' : '#c5ff65');
      logoGrad.addColorStop(1, '#5eead4');
      ctx.fillStyle = logoGrad;
      roundedRect(ctx, pad, topY, 38, 38, 11);
      ctx.fill();

      ctx.fillStyle = '#090d07';
      ctx.font = '950 21px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('C', pad + 19, topY + 27);
      ctx.textAlign = 'left';

      // Title & Eyebrow
      ctx.font = '900 12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = isActors ? '#d7aaff' : '#c5ff65';
      ctx.fillText(isActors ? 'CINEVA · ACTORS TIER LIST' : 'CINEVA · CINEMA TIER LIST', pad + 48, topY + 15);

      ctx.font = '900 22px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#f5f7fc';
      const listTitle = byId('tierlistTitleInput').value.trim() || (isActors ? 'Тирлист актёров' : 'Кинотирлист');
      ctx.fillText(listTitle, pad + 48, topY + 38);

      // Author & Date Pill Badge on top right
      const author = byId('tierlistAuthorInput').value.trim() || (window.reviewerName || 'Киноман CINEVA');
      const authorText = `Автор: ${author}`;
      ctx.font = '700 12px system-ui, -apple-system, sans-serif';
      const authW = ctx.measureText(authorText).width + 30;
      const authX = W - pad - authW;

      roundedRect(ctx, authX, topY + 4, authW, 30, 15);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#dbe3f5';
      ctx.fillText(authorText, authX + 15, topY + 23);

      // 3. Render Tier Rows (No voids, sleek card lanes)
      let curY = topY + headerH;
      const rw = W - pad * 2;

      for (const { row, rowHeight } of rowLayouts) {
        const rx = pad;
        const ry = curY;
        const rh = rowHeight;

        // Row background
        const rowBg = ctx.createLinearGradient(rx, ry, rx + rw, ry);
        rowBg.addColorStop(0, 'rgba(20, 25, 38, 0.9)');
        rowBg.addColorStop(1, 'rgba(12, 15, 24, 0.95)');
        ctx.fillStyle = rowBg;
        roundedRect(ctx, rx, ry, rw, rh, 14);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        roundedRect(ctx, rx, ry, rw, rh, 14);
        ctx.stroke();

        // Left Label Box
        const rowColor = row.color || '#ff4466';
        ctx.fillStyle = rowColor;
        roundedRect(ctx, rx, ry, labelW, rh, 14);
        ctx.fill();
        ctx.fillRect(rx + labelW - 14, ry, 14, rh);

        // Label Text
        ctx.fillStyle = '#0a0d14';
        ctx.font = '950 22px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        const labelLines = wrapCanvasText(ctx, row.label || '—', labelW - 14, 2);
        const textStartY = ry + rh / 2 - ((labelLines.length - 1) * 13);
        labelLines.forEach((l, idx) => {
          ctx.fillText(l, rx + labelW / 2, textStartY + idx * 26 + 8);
        });
        ctx.textAlign = 'left';

        // Items in this row
        const items = row.items || [];
        if (!items.length) {
          ctx.fillStyle = '#57637d';
          ctx.font = 'italic 600 13px system-ui, -apple-system, sans-serif';
          ctx.fillText(isActors ? '«Пока нет актёров»' : '«Пока нет фильмов»', rx + labelW + rowPad + 6, ry + rh / 2 + 5);
        } else {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const col = i % maxCols;
            const rIndex = Math.floor(i / maxCols);
            const ix = rx + labelW + rowPad + col * (cardW + cardGap);
            const iy = ry + rowPad + rIndex * (cardH + cardGap);

            // Card shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            roundedRect(ctx, ix + 1, iy + 2, cardW, cardH, 9);
            ctx.fill();

            // Card base
            ctx.fillStyle = '#161b29';
            roundedRect(ctx, ix, iy, cardW, cardH, 9);
            ctx.fill();

            if (item.poster) {
              try {
                const fakeImg = new Image();
                fakeImg.src = item.poster;
                const loaded = await loadImageForExport(fakeImg);
                ctx.save();
                roundedRect(ctx, ix, iy, cardW, cardH, 9);
                ctx.clip();
                ctx.drawImage(loaded, ix, iy, cardW, cardH);
                ctx.restore();
              } catch (_) {
                ctx.fillStyle = '#22283a';
                roundedRect(ctx, ix, iy, cardW, cardH, 9);
                ctx.fill();
                ctx.fillStyle = '#9cb0d4';
                ctx.font = '700 9px system-ui, -apple-system, sans-serif';
                ctx.textAlign = 'center';
                const titleLines = wrapCanvasText(ctx, item.title || '', cardW - 6, 4);
                titleLines.forEach((tl, tidx) => {
                  ctx.fillText(tl, ix + cardW / 2, iy + 42 + tidx * 12);
                });
                ctx.textAlign = 'left';
              }
            }

            // Crisp card border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
            ctx.lineWidth = 1;
            roundedRect(ctx, ix, iy, cardW, cardH, 9);
            ctx.stroke();
          }
        }

        curY += rh + rowGap;
      }

      // 4. Footer Watermark
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#54607a';
      ctx.fillText(isActors ? 'CINEVA · Энциклопедия кино, актёров и система ранжирования' : 'CINEVA · Киноэнциклопедия и система ранжирования', pad, H - 24);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#455068';
      ctx.fillText(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), W - pad, H - 24);
      ctx.textAlign = 'left';

      const safeTitle = (byId('tierlistTitleInput').value.trim() || `cineva-tierlist-${activeTierKind}`).toLowerCase().replace(/[^a-zа-я0-9]/gi, '-');
      const link = document.createElement('a');
      link.download = `${safeTitle}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('Тирлист успешно сохранён как PNG!', 'success');
    } catch (err) {
      showToast('Ошибка экспорта PNG: ' + (err.message || err), 'error');
    } finally {
      if (exportBtn) { exportBtn.disabled = false; exportBtn.textContent = '🎨 Скачать PNG'; }
    }
  }



// ==========================================
// TIER LIST PROJECT SHARING (VIA URL HASH)
// ==========================================

function encodeTierProject(obj) {
  const json = JSON.stringify(obj);
  return encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
}

function decodeTierProject(str) {
  const json = decodeURIComponent(escape(atob(decodeURIComponent(str))));
  return JSON.parse(json);
}

function shareTierListProject() {
  try {
    const data = getActiveTierData();
    const isActors = activeTierKind === 'actors';
    const title = byId('tierlistTitleInput').value.trim() || data.title || (isActors ? 'Тирлист актёров' : 'Кинотирлист');
    const author = byId('tierlistAuthorInput').value.trim() || data.author || (window.reviewerName || '') || 'Киноман CINEVA';

    const payload = {
      v: 1,
      k: activeTierKind,
      t: title,
      a: author,
      rows: (data.rows || []).map(r => ({
        id: r.id,
        l: r.label,
        c: r.color,
        items: (r.items || []).map(i => ({
          id: i.id,
          t: i.title || i.name || '',
          y: i.year || i.role || '',
          p: i.poster || '',
          s: i.source || 'tmdb',
          type: i.type || (activeTierKind === 'actors' ? 'person' : 'movie')
        }))
      })),
      unranked: (data.unranked || []).map(i => ({
        id: i.id,
        t: i.title || i.name || '',
        y: i.year || i.role || '',
        p: i.poster || '',
        s: i.source || 'tmdb',
        type: i.type || (activeTierKind === 'actors' ? 'person' : 'movie')
      }))
    };

    const encoded = encodeTierProject(payload);
    // Build direct URL to tierlist.html (or index.html) with hash
    const basePath = window.location.pathname.endsWith('.html') 
      ? window.location.pathname 
      : (window.location.pathname.replace(/\/?$/, '/index.html'));
    const shareUrl = `${window.location.origin}${basePath}#tier=${encoded}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('🔗 Ссылка на тирлист скопирована в буфер обмена!', 'success');
      }).catch(() => {
        prompt('Скопируйте ссылку на ваш тирлист:', shareUrl);
      });
    } else {
      prompt('Скопируйте ссылку на ваш тирлист:', shareUrl);
    }
  } catch (err) {
    console.error('Failed to share tierlist:', err);
    showToast('Ошибка при формировании ссылки', 'error');
  }
}

function checkSharedTierFromUrl() {
  try {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    let tierParam = null;
    if (hash.includes('tier=')) {
      tierParam = hash.split('tier=')[1].split('&')[0];
    } else if (search.includes('tier=')) {
      const p = new URLSearchParams(search);
      tierParam = p.get('tier');
    }
    if (tierParam) {
      const payload = decodeTierProject(tierParam);
      if (payload && (payload.rows || payload.t)) {
        const kind = payload.k || 'movies';
        activeTierKind = kind;
        tierStores[kind] = {
          title: payload.t || (kind === 'actors' ? 'Тирлист актёров' : 'Кинотирлист'),
          author: payload.a || '',
          rows: (payload.rows || []).map(r => ({
            id: r.id || ('row_' + Math.random().toString(36).substr(2, 6)),
            label: r.l || 'Ряд',
            color: r.c || '#ff5964',
            items: r.items || []
          })),
          unranked: payload.unranked || []
        };
        saveTierListStorage();
        updateTierModeUI();
        renderTierBoard();
        if (typeof showPage === 'function') {
          showPage('tierlist');
        }
        showToast(`⭐ Проект «${payload.t || 'Тирлист'}» успешно загружен по ссылке!`, 'success');
      }
    }
  } catch (e) {
    console.warn('Could not parse shared tierlist URL:', e);
  }
}

// Hook up share button click
document.addEventListener('click', e => {
  const btn = e.target.closest('#tierShareBtn');
  if (btn) {
    e.preventDefault();
    shareTierListProject();
  }
});

// Check shared tier on load and hash change
window.addEventListener('hashchange', checkSharedTierFromUrl);
