/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/lists.js
   Listen, Künstler, Alben, Genres, Suche, Filter, Import/Export
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── LISTS ──────────────────────────────────────────────────────────────────────
function getActiveList() {
  return State.lists.find(l => l.id === State.activeListId) || State.lists[0] || null;
}

function renderLists() {
  const select = document.getElementById('list-select');
  select.innerHTML = '';
  State.lists.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    select.appendChild(opt);
  });
  if (State.activeListId) select.value = State.activeListId;
  else if (State.lists.length) { State.activeListId = State.lists[0].id; select.value = State.activeListId; }

  const active   = getActiveList();
  const nameText = document.getElementById('list-name-text');
  if (nameText) {
    const count = (active?.artists?.length || 0) + (active?.albums?.length || 0) + (active?.genres?.length || 0);
    nameText.textContent = active
      ? `${active.name} (${count})`
      : I18N.t('list_none');
  }
}

function createList(name) {
  const list = { id: 'list_' + Date.now(), name: name.trim() || I18N.t('msg_new_list'), artists: [], albums: [], genres: [], filters: defaultFilters() };
  State.lists.push(list);
  State.activeListId = list.id;
  LS.save(); renderLists(); renderArtistGrid(); renderAlbumGrid(); updateFiltersUI();
  showToast(I18N.t('msg_list_created', { name: list.name }), 'success');
}

function deleteActiveList() {
  if (!State.activeListId) return;
  State.lists     = State.lists.filter(l => l.id !== State.activeListId);
  State.activeListId = State.lists[0]?.id || null;
  LS.save(); renderLists(); renderArtistGrid(); renderAlbumGrid(); updateFiltersUI();
}

function renameActiveList(name) {
  const list = getActiveList();
  if (!list) return;
  list.name = name.trim() || list.name;
  LS.save(); renderLists();
  showToast(I18N.t('toast_list_renamed'), 'success');
}

function duplicateActiveList() {
  const list = getActiveList();
  if (!list) return;
  const copy = {
    id: 'list_' + Date.now(),
    name: list.name + ' (Kopie)',
    artists: list.artists.map(a => ({ ...a })),
    albums:  (list.albums  || []).map(a => ({ ...a })),
    genres:  (list.genres  || []).slice(),
    filters: { ...list.filters },
  };
  State.lists.push(copy);
  State.activeListId = copy.id;
  LS.save(); renderLists(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags(); updateFiltersUI();
  showToast(I18N.t('msg_list_created', { name: copy.name }), 'success');
}

function mergeListIntoActive(sourceId) {
  const target = getActiveList();
  const source = State.lists.find(l => l.id === sourceId);
  if (!target || !source || target.id === source.id) return;
  let added = 0;
  source.artists.forEach(a => { if (!target.artists.find(x => x.id === a.id)) { target.artists.push({ ...a }); added++; } });
  (source.genres || []).forEach(g => { if (!target.genres.includes(g)) target.genres.push(g); });
  (source.albums || []).forEach(a => { if (!target.albums.find(x => x.id === a.id)) target.albums.push({ ...a }); });
  LS.save(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags(); renderLists();
  showToast(I18N.t('msg_merged', { n: added, name: source.name }), 'success');
}

// ── ARTIST GRID ───────────────────────────────────────────────────────────────
function renderArtistGrid() {
  const grid  = document.getElementById('artist-grid');
  const empty = document.getElementById('list-empty');
  const list  = getActiveList();
  grid.innerHTML = '';
  const count = list?.artists?.length || 0;
  const countEl = document.getElementById('artist-count');
  if (countEl) countEl.textContent = count ? `(${count})` : '';
  const labelEl = document.getElementById('artist-section-label');
  if (labelEl) labelEl.childNodes[0].textContent = `🎤 ${I18N.t('msg_artists')} `;
  if (!count) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  [...list.artists]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .forEach((artist, idx) => {
      const card = document.createElement('div');
      card.className = 'artist-card';
      card.style.animationDelay = `${idx * 0.04}s`;
      card.dataset.artistId = artist.id;
      const img   = artist.images?.[0]?.url || '';
      const genre = artist.genres?.[0] || '';
      card.innerHTML = `
        <img class="artist-card-img" src="${safeUrl(img) || ARTIST_FALLBACK_IMG}" alt="${escHtml(artist.name)}" />
        <div class="artist-card-name">${escHtml(artist.name)}</div>
        ${genre ? `<div class="artist-card-genre">${escHtml(genre)}</div>` : ''}
        <button class="artist-card-remove"   data-id="${escHtml(artist.id)}" title="${escHtml(I18N.t('msg_remove'))}">✕</button>
        <button class="artist-card-favorite ${artist.favorite ? 'active' : ''}" data-id="${escHtml(artist.id)}" title="${escHtml(I18N.t('msg_favorite'))}">⭐</button>
      `;
      grid.appendChild(card);
    });
}

function addArtistToList(artist) {
  let list = getActiveList();
  if (!list) { createList(I18N.t('msg_my_list')); list = getActiveList(); }
  if (!list) return;
  if (list.artists.find(a => a.id === artist.id)) {
    showToast(`${artist.name} ${I18N.t('toast_artist_exists')}`, 'info'); return;
  }
  list.artists.push({ id: artist.id, name: artist.name, images: artist.images || [], genres: artist.genres || [], uri: artist.uri });
  LS.save(); renderArtistGrid(); renderLists();
  showToast(`${artist.name} ${I18N.t('toast_artist_added')}`, 'success');
}

function toggleArtistFavorite(artistId) {
  const list   = getActiveList();
  const artist = list?.artists?.find(a => a.id === artistId);
  if (!artist) return;
  artist.favorite = !artist.favorite;
  LS.save(); renderArtistGrid();
  showToast(I18N.t(artist.favorite ? 'msg_favorite_on' : 'msg_favorite_off', { name: artist.name }), 'info');
}

function removeArtistFromList(artistId) {
  const list = getActiveList();
  if (!list) return;
  list.artists = list.artists.filter(a => a.id !== artistId);
  LS.save(); renderArtistGrid(); renderLists();
}

// ── ALBUM BROWSER ─────────────────────────────────────────────────────────────
let _albumBrowserSelected = new Set();

function _switchAlbumBrowserTab(tab) {
  const tabAlbums  = document.getElementById('tab-albums');
  const tabStatus  = document.getElementById('tab-trackstatus');
  const btnAlbums  = document.getElementById('tab-albums-btn');
  const btnStatus  = document.getElementById('tab-trackstatus-btn');
  const confirmBtn = document.getElementById('confirm-album-browser');
  if (tab === 'albums') {
    tabAlbums.classList.remove('hidden');
    tabStatus.classList.add('hidden');
    btnAlbums.classList.add('active');
    btnStatus.classList.remove('active');
    confirmBtn.style.display = '';
  } else {
    tabAlbums.classList.add('hidden');
    tabStatus.classList.remove('hidden');
    btnAlbums.classList.remove('active');
    btnStatus.classList.add('active');
    confirmBtn.style.display = 'none';
    // Track-Status laden
    const modal      = document.getElementById('modal-album-browser');
    const artistId   = modal.dataset.artistId;
    const artistName = modal.dataset.artistName;
    renderTrackStatus(artistId, artistName);
  }
}

async function renderTrackStatus(artistId, artistName) {
  const list    = document.getElementById('trackstatus-list');
  const sub     = document.getElementById('trackstatus-sub');
  const played  = new Set(State.artistTrackHistory[artistId] || []);
  const loading = (txt) => { list.innerHTML = `<p style="color:var(--text3);text-align:center;padding:20px">⏳ ${escHtml(txt)}</p>`; };
  loading(I18N.t('msg_loading_tracks'));
  sub.textContent = '';

  try {
    // Gleiche Quelle, gleiche Filter und gleiche Song-Erkennung wie der Shuffle
    // (gecacht + gedrosselt, Single/Album-Duplikate zusammengefasst).
    const filters      = getActiveList()?.filters || defaultFilters();
    const blacklistSet = State.blacklistEnabled ? new Set(State.blacklist.map(b => b.id)) : new Set();
    const songs = await SpotifyAPI.getArtistTrackStatus(artistId, filters, blacklistSet, played,
      (done, total) => { if (total > 1) loading(I18N.t('msg_loading_tracks_progress', { done, total })); });
    if (document.getElementById('modal-album-browser').dataset.artistId !== artistId) return; // Modal inzwischen gewechselt

    const total     = songs.length;
    const playedN   = songs.filter(t => t.played).length;
    const remaining = total - playedN;
    sub.textContent = I18N.t('msg_track_status', { played: playedN, total, open: remaining });

    // Sortieren: offen zuerst, dann gespielt
    songs.sort((a, b) => (a.played === b.played) ? a.name.localeCompare(b.name) : (a.played ? 1 : -1));

    list.innerHTML = '';
    songs.forEach(t => {
      const item = document.createElement('div');
      item.className = 'trackstatus-item' + (t.played ? ' played' : '');
      item.innerHTML = `
        <span class="ts-icon">${t.played ? '✅' : '🔒'}</span>
        <span class="ts-name" title="${escHtml(t.name)}">${escHtml(t.name)}</span>
        <span class="ts-album" title="${escHtml(t.album)}">${escHtml(t.album)}</span>`;
      list.appendChild(item);
    });
  } catch (err) {
    list.innerHTML = `<p style="color:var(--danger);padding:20px">${escHtml(I18N.t('msg_error', { error: err.message }))}</p>`;
  }
}

async function showAlbumBrowser(artistId, artistName) {
  _albumBrowserSelected = new Set();
  document.getElementById('album-browser-title').textContent = artistName;
  document.getElementById('album-browser-sub').textContent   = I18N.t('msg_choose_albums');
  _switchAlbumBrowserTab('albums');
  const modal = document.getElementById('modal-album-browser');
  modal.dataset.artistId   = artistId;
  modal.dataset.artistName = artistName;
  const grid = document.getElementById('album-browser-grid');
  const btn  = document.getElementById('confirm-album-browser');
  grid.innerHTML = `<p style="color:var(--text3);text-align:center;padding:20px">${escHtml(I18N.t('msg_loading_discography'))}</p>`;
  btn.disabled   = true;
  btn.textContent = I18N.t('msg_add');
  modal.classList.remove('hidden');

  try {
    const albums = await SpotifyAPI.getArtistAlbumsFull(artistId);
    const list   = getActiveList();
    const existing = new Set((list?.albums || []).map(a => a.id));
    grid.innerHTML = '';
    albums.forEach(album => {
      const card  = document.createElement('div');
      const added = existing.has(album.id);
      card.className   = 'album-browser-card' + (added ? ' added' : '');
      card.dataset.albumId = album.id;
      const img  = album.images?.[0]?.url || '';
      const year = album.release_date?.slice(0, 4) || '';
      card.innerHTML = `
        <div class="album-browser-check ${added ? 'checked' : ''}">✓</div>
        <img src="${safeUrl(img)}" alt="${escHtml(album.name)}" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px"/>
        <div style="font-size:0.72rem;font-weight:600;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(album.name)}">${escHtml(album.name)}</div>
        <div style="font-size:0.65rem;color:var(--text3)">${escHtml(year)}</div>
      `;
      if (!added) {
        card.addEventListener('click', () => {
          const sel = _albumBrowserSelected.has(album.id);
          if (sel) { _albumBrowserSelected.delete(album.id); card.classList.remove('selected'); card.querySelector('.album-browser-check').classList.remove('checked'); }
          else {
            _albumBrowserSelected.add(album.id);
            card.classList.add('selected');
            card.querySelector('.album-browser-check').classList.add('checked');
            card.dataset.albumData = JSON.stringify({ id: album.id, name: album.name, artistId, artistName, images: album.images, release_date: album.release_date, album_type: album.album_type });
          }
          const n = _albumBrowserSelected.size;
          btn.disabled    = n === 0;
          btn.textContent = n > 0 ? I18N.t('msg_add_albums', { n }) : I18N.t('msg_add');
        });
      }
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--danger);padding:20px">${escHtml(I18N.t('msg_error', { error: err.message }))}</p>`;
  }
}

function addSelectedAlbumsToList() {
  const list = getActiveList();
  if (!list) return;
  const grid = document.getElementById('album-browser-grid');
  let added = 0;
  _albumBrowserSelected.forEach(albumId => {
    const card = grid.querySelector(`[data-album-id="${albumId}"]`);
    if (card?.dataset.albumData) {
      const data = JSON.parse(card.dataset.albumData);
      if (!list.albums.find(a => a.id === albumId)) { list.albums.push(data); added++; }
    }
  });
  LS.save(); renderAlbumGrid();
  document.getElementById('modal-album-browser').classList.add('hidden');
  showToast(I18N.t('msg_albums_added', { n: added }), 'success');
}

function renderAlbumGrid() {
  const list    = getActiveList();
  const albums  = list?.albums || [];
  const section = document.getElementById('album-section');
  const grid    = document.getElementById('album-grid');
  grid.innerHTML = '';
  if (!albums.length) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');
  const albumCountEl = document.getElementById('album-count');
  if (albumCountEl) albumCountEl.textContent = `(${albums.length})`;
  const albumLabelEl = document.getElementById('album-section-label');
  if (albumLabelEl) albumLabelEl.childNodes[0].textContent = `🎵 ${I18N.t('msg_albums')} `;
  [...albums]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .forEach(album => {
      const card = document.createElement('div');
      card.className = 'album-card';
      const img  = album.images?.[0]?.url || '';
      const year = album.release_date?.slice(0, 4) || '';
      card.innerHTML = `
        <img src="${safeUrl(img)}" alt="${escHtml(album.name)}" class="album-card-img"/>
        <div class="album-card-name" title="${escHtml(album.name)}">${escHtml(album.name)}</div>
        <div class="album-card-artist">${escHtml(album.artistName)} · ${escHtml(year)}</div>
        <button class="album-card-remove" data-id="${escHtml(album.id)}" title="${escHtml(I18N.t('msg_remove'))}">✕</button>
      `;
      card.querySelector('.album-card-remove').addEventListener('click', e => {
        e.stopPropagation();
        list.albums = list.albums.filter(a => a.id !== album.id);
        LS.save(); renderAlbumGrid();
      });
      grid.appendChild(card);
    });
}

// ── GENRES ────────────────────────────────────────────────────────────────────
let _allGenres = [];

async function loadGenres() {
  // Genre-Feature entfernt — getAvailableGenres existiert nicht mehr
  if (!_allGenres.length && typeof SpotifyAPI.getAvailableGenres === 'function') {
    _allGenres = SpotifyAPI.getAvailableGenres();
  }
  return _allGenres;
}

function renderGenreTags() {
  const list      = getActiveList();
  const container = document.getElementById('genre-tags');
  if (!container) return;
  container.innerHTML = '';
  (list?.genres || []).forEach(genre => {
    const tag = document.createElement('span');
    tag.className = 'genre-tag';
    tag.innerHTML = `${escHtml(genre)} <button class="genre-tag-remove" data-genre="${escHtml(genre)}">✕</button>`;
    container.appendChild(tag);
  });
}

function addGenreToList(genre) {
  const list = getActiveList();
  if (!list || list.genres.includes(genre)) return;
  list.genres.push(genre);
  LS.save(); renderGenreTags();
  showToast(`${I18N.t('toast_genre_added')}: ${genre}`, 'success');
}

function removeGenreFromList(genre) {
  const list = getActiveList();
  if (!list) return;
  list.genres = list.genres.filter(g => g !== genre);
  LS.save(); renderGenreTags();
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
let _searchTimer = null;
let _selectedArtists = new Map();

function setupSearch() {
  const input   = document.getElementById('artist-search');
  const results = document.getElementById('search-results');
  const clearBtn = document.getElementById('clear-search');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);
    clearTimeout(_searchTimer);
    if (!q) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');
    results.innerHTML = '<div class="search-result-loading">Suche…</div>';
    _searchTimer = setTimeout(() => doSearch(q, results), 400);
  });

  clearBtn.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus(); });
  document.addEventListener('click', e => { if (!e.target.closest('.search-section')) results.classList.add('hidden'); });
}

async function doSearch(query, resultsEl) {
  try {
    const artists = await SpotifyAPI.searchArtists(query, 10);
    resultsEl.innerHTML = '';
    _selectedArtists.clear();
    if (!artists.length) { resultsEl.innerHTML = `<div class="search-result-empty">${I18N.t('search_empty')}</div>`; return; }

    const actionBar = document.createElement('div');
    actionBar.className = 'search-action-bar';
    actionBar.innerHTML = `
      <span class="search-selected-count" id="search-selected-count">0 <span data-i18n="search_selected">ausgewählt</span></span>
      <button class="btn-search-add-all" id="search-add-all" disabled data-i18n="search_add_btn">${escHtml(I18N.t('search_add_btn'))}</button>`;
    resultsEl.appendChild(actionBar);

    artists.forEach(artist => {
      const item = document.createElement('div');
      item.className = 'search-result-item search-result-selectable';
      item.dataset.artistId = artist.id;
      const img    = artist.images?.slice(-1)[0]?.url || '';
      const genres = (artist.genres || []).slice(0, 2).join(', ');
      item.innerHTML = `
        <div class="search-result-check"><svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg></div>
        <img src="${safeUrl(img)}" alt="" />
        <div>
          <div class="search-result-name">${escHtml(artist.name)}</div>
          ${genres ? `<div class="search-result-genres">${escHtml(genres)}</div>` : ''}
        </div>`;
      item.addEventListener('click', () => {
        if (_selectedArtists.has(artist.id)) { _selectedArtists.delete(artist.id); item.classList.remove('selected'); }
        else { _selectedArtists.set(artist.id, artist); item.classList.add('selected'); }
        const n = _selectedArtists.size;
        document.getElementById('search-selected-count').textContent = n + I18N.t('search_selected');
        const btn = document.getElementById('search-add-all');
        btn.disabled    = n === 0;
        btn.textContent = n > 0 ? I18N.t('msg_add_n', { n }) : I18N.t('search_add_btn');
      });
      resultsEl.appendChild(item);
    });

    document.getElementById('search-add-all').addEventListener('click', () => {
      _selectedArtists.forEach(a => addArtistToList(a));
      const n = _selectedArtists.size;
      _selectedArtists.clear();
      document.getElementById('artist-search').value = '';
      document.getElementById('clear-search').classList.add('hidden');
      resultsEl.classList.add('hidden');
      showToast(I18N.t('msg_artists_added', { n }), 'success');
    });
  } catch (err) {
    resultsEl.innerHTML = `<div class="search-result-empty">${escHtml(I18N.t('msg_error', { error: err.message }))}</div>`;
  }
}

function setupAlbumArtistSearch() {
  const input    = document.getElementById('album-artist-search');
  const results  = document.getElementById('album-artist-results');
  const clearBtn = document.getElementById('clear-album-search');
  if (!input) return;
  let timer = null;

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn.classList.toggle('hidden', !q);
    clearTimeout(timer);
    if (!q) { results.classList.add('hidden'); return; }
    results.classList.remove('hidden');
    results.innerHTML = `<div class="search-result-loading">${I18N.t('search_loading')}</div>`;
    timer = setTimeout(async () => {
      try {
        const artists = await SpotifyAPI.searchArtists(q, 6);
        results.innerHTML = '';
        if (!artists.length) { results.innerHTML = `<div class="search-result-empty">${I18N.t('search_empty')}</div>`; return; }
        artists.forEach(artist => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          const img = artist.images?.slice(-1)[0]?.url || '';
          item.innerHTML = `<img src="${safeUrl(img)}" alt="" /><div class="search-result-name">${escHtml(artist.name)}</div>`;
          item.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); showAlbumBrowser(artist.id, artist.name); });
          results.appendChild(item);
        });
      } catch (err) { results.innerHTML = `<div class="search-result-empty">${escHtml(I18N.t('msg_error', { error: err.message }))}</div>`; }
    }, 400);
  });

  clearBtn?.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus(); });
  document.addEventListener('click', e => { if (!e.target.closest('#album-search-section')) results.classList.add('hidden'); });
}

function setupGenreSearch() {
  const input    = document.getElementById('genre-search-input');
  const results  = document.getElementById('genre-results');
  const clearBtn = document.getElementById('genre-clear-btn');
  if (!input) return;

  input.addEventListener('focus', async () => { await loadGenres(); showGenreResults(input.value.trim().toLowerCase(), results); });
  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearBtn?.classList.toggle('hidden', !q);
    showGenreResults(q.toLowerCase(), results);
  });
  clearBtn?.addEventListener('click', () => { input.value = ''; clearBtn.classList.add('hidden'); results.classList.add('hidden'); input.focus(); });
  document.addEventListener('click', e => { if (!e.target.closest('.genre-section')) results.classList.add('hidden'); });
  document.getElementById('genre-tags')?.addEventListener('click', e => {
    const btn = e.target.closest('.genre-tag-remove');
    if (btn) removeGenreFromList(btn.dataset.genre);
  });
}

function showGenreResults(query, resultsEl) {
  const filtered = query ? _allGenres.filter(g => g.includes(query)).slice(0, 20) : _allGenres.slice(0, 20);
  const list     = getActiveList();
  const existing = new Set(list?.genres || []);
  resultsEl.innerHTML = '';
  if (!filtered.length) { resultsEl.innerHTML = `<div class="search-result-empty">${I18N.t('search_genre_empty')}</div>`; resultsEl.classList.remove('hidden'); return; }

  filtered.forEach(genre => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    const sel = existing.has(genre);
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;width:100%">
        <div style="width:18px;height:18px;border-radius:50%;border:2px solid ${sel?'var(--accent)':'var(--border)'};background:${sel?'var(--accent)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${sel?'<svg viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg>':''}
        </div>
        <span class="search-result-name">${escHtml(genre)}</span>
      </div>`;
    item.addEventListener('click', () => {
      if (existing.has(genre)) { removeGenreFromList(genre); existing.delete(genre); }
      else { addGenreToList(genre); existing.add(genre); }
      showGenreResults(query, resultsEl);
    });
    resultsEl.appendChild(item);
  });
  resultsEl.classList.remove('hidden');
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
function updateFiltersUI() {
  const list = getActiveList();
  const f    = list?.filters || defaultFilters();
  document.getElementById('filter-no-live').checked = !!f.noLive;
  document.getElementById('filter-no-instrumental').checked = !!f.noInstrumental;
  document.getElementById('filter-no-acoustic').checked = !!f.noAcoustic;
  document.getElementById('filter-no-orchestral').checked = !!f.noOrchestral;
  document.getElementById('filter-no-commentary').checked = !!f.noCommentary;
  const repeatLimit = document.getElementById('filter-artist-repeat-limit');
  if (repeatLimit) repeatLimit.value = f.artistRepeatLimit ?? 3;
  document.getElementById('filter-no-repeat').checked = f.noRepeat !== false;

  const fromInput = document.getElementById('filter-year-from');
  const fromBtn   = document.getElementById('filter-year-from-toggle');
  if (f.yearFrom) { fromInput.value = f.yearFrom; fromInput.classList.remove('hidden'); fromBtn.classList.add('active'); }
  else            { fromInput.value = '';          fromInput.classList.add('hidden');    fromBtn.classList.remove('active'); }

  const toInput = document.getElementById('filter-year-to');
  const toBtn   = document.getElementById('filter-year-to-toggle');
  if (f.yearTo) { toInput.value = f.yearTo; toInput.classList.remove('hidden'); toBtn.classList.add('active'); }
  else          { toInput.value = '';        toInput.classList.add('hidden');    toBtn.classList.remove('active'); }

  updateFiltersBadge(f);
}

function saveFilters() {
  const list = getActiveList();
  if (!list) return;
  list.filters = {
    noLive:          document.getElementById('filter-no-live').checked,
    noInstrumental:  document.getElementById('filter-no-instrumental').checked,
    noAcoustic:      document.getElementById('filter-no-acoustic').checked,
    noOrchestral:    document.getElementById('filter-no-orchestral').checked,
    noCommentary:    document.getElementById('filter-no-commentary').checked,
    artistRepeatLimit: parseInt(document.getElementById('filter-artist-repeat-limit').value, 10) || 3,
    noRepeat:          document.getElementById('filter-no-repeat').checked,
    yearFrom:        parseInt(document.getElementById('filter-year-from').value, 10) || null,
    yearTo:          parseInt(document.getElementById('filter-year-to').value,   10) || null,
  };
  LS.save(); updateFiltersBadge(list.filters);
}

function updateFiltersBadge(f) {
  let n = 0;
  if (f.noLive)          n++;
  if (f.noInstrumental)  n++;
  if (f.noAcoustic)      n++;
  if (f.noOrchestral)    n++;
  if (f.noCommentary)    n++;
  if (f.noRepeat === false) n++; // zählt wenn deaktiviert (ungewöhnlich)
  if (f.artistRepeatLimit && f.artistRepeatLimit !== 3) n++;
  if (f.yearFrom)        n++;
  if (f.yearTo)          n++;
  const badge = document.getElementById('filters-badge');
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
}

// ── MERGE MODAL ───────────────────────────────────────────────────────────────
function showMergeModal() {
  const select = document.getElementById('merge-list-select');
  if (!select) return;
  select.innerHTML = '';
  const active = getActiveList();
  State.lists.filter(l => l.id !== active?.id).forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name + (l.artists?.length ? ` (${l.artists.length})` : '');
    select.appendChild(opt);
  });
  if (!select.options.length) { showToast(I18N.t('toast_no_lists_merge'), 'info'); return; }
  document.getElementById('modal-merge-list').classList.remove('hidden');
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────
function exportLists() {
  const blob = new Blob([JSON.stringify({ lists: State.lists, version: 1 }, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'music-shuffle-listen.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(I18N.t('toast_exported'), 'success');
}

function importLists(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data?.lists)) throw new Error(I18N.t('msg_invalid_format'));
      const existing = new Set(State.lists.map(l => l.id));
      const imported = data.lists.map(normalizeList).filter(Boolean).map(l => {
        // Gleiche ID wie eine vorhandene Liste → neue ID, sonst überschreibt der Sync die alte
        if (existing.has(l.id)) l.id = 'l' + Date.now() + Math.random().toString(36).slice(2, 8);
        existing.add(l.id);
        return l;
      });
      State.lists = [...State.lists, ...imported];
      if (!State.activeListId && State.lists.length) State.activeListId = State.lists[0].id;
      LS.save(); renderLists(); renderArtistGrid();
      showToast(I18N.t('msg_lists_imported', { n: imported.length }), 'success');
    } catch (err) { showToast(I18N.t('msg_import_failed', { error: err.message }), 'error'); }
  };
  reader.readAsText(file);
}

// ── AKTIVE LISTE ──────────────────────────────────────────────────────────────
function switchActiveList(id) {
  State.activeListId = id;
  const sel = document.getElementById('list-select');
  if (sel) sel.value = id;
  localStorage.setItem('as_active_list', id);
  renderLists(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags(); updateFiltersUI();
}
