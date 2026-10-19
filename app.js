/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — app.js
   Einstieg: Start, Login und Verdrahtung aller Buttons.
   Version: APP_VERSION in js/core.js

   Aufbau (seit v1.6.1, Ladereihenfolge siehe index.html):
     i18n.js          Übersetzungen DE/EN
     spotify-api.js   Spotify Web API, OAuth, Cache, Track-Auswahl
     js/core.js       Zustand, Speicher, Validierung, Hilfsfunktionen
     js/sync.js       Sync-Server
     js/player.js     Web Playback SDK, Geräte, Reconnect, Medientasten
     js/shuffle.js    Shuffle, Queue, Verlauf, Blacklist
     js/lists.js      Listen, Künstler, Alben, Genres, Suche, Filter
     js/ui.js         Statistiken, Theme, Tastatur, PWA, Changelog-Dialog
     js/changelog.js  Changelog-Daten
     app.js           dieser Einstieg
   Alles sind klassische Skripte ohne Build-Schritt; Funktionen und
   Top-Level-Konstanten sind dateiübergreifend sichtbar.
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Clickjacking-Schutz: nicht in fremden iframes laufen (die App enthält Login + Player)
  if (window.top !== window.self) {
    document.body.innerHTML = `<p style="padding:2rem;font-family:Verdana">${escHtml(I18N.t('msg_no_embed'))}</p>`;
    return;
  }
  LS.load();
  const clientId   = window.SPOTIFY_CONFIG?.clientId   || localStorage.getItem('as_client_id') || '';
  const redirectUri = window.SPOTIFY_CONFIG?.redirectUri || '';

  const hint = document.getElementById('redirect-uri-hint');
  if (hint) hint.textContent = redirectUri;

  const savedCid = localStorage.getItem('as_client_id');
  if (savedCid) { const inp = document.getElementById('client-id-input'); if (inp) inp.value = savedCid; }

  SpotifyAPI.init(clientId, redirectUri);

  // Login-Button immer verdrahten — auch wenn der Callback scheitert,
  // muss ein erneuter Login möglich sein (vorher: toter Button).
  bindLoginEvents(clientId, redirectUri);

  if (window.location.search.includes('code=') || window.location.search.includes('error=')) {
    try { await SpotifyAPI.handleCallback(); await bootApp(); }
    catch (err) {
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast(I18N.t('msg_login_failed', { error: err.message }), 'error'); showLoginScreen();
    }
    return;
  }

  if (SpotifyAPI.isLoggedIn()) await bootApp();
  else showLoginScreen();
});

async function bootApp() {
  try { State.user = await SpotifyAPI.getMe(); }
  catch (err) { if (err.message === 'NOT_AUTHENTICATED') { showLoginScreen(); return; } }

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  renderUserInfo();
  I18N.applyAll();
  updateLangBtn();
  const verEl = document.getElementById('app-version');
  if (verEl) verEl.textContent = APP_VERSION;

  const synced = await Sync.load();
  if (synced) console.log('[Sync] Synced');
  await Sync.loadStats();
  await Sync.loadBlacklist();
  await Sync.loadTrackHistory();

  // Album- und Track-Cache vom Sync-Server laden — reduziert Spotify API Calls beim Start
  if (Sync.url) {
    SpotifyAPI.setServerCacheUrl(Sync.url);
    SpotifyAPI.loadServerCache();
    SpotifyAPI.loadServerTrackCache();
  }

  initTheme();
  renderLists();
  renderArtistGrid();
  renderAlbumGrid();
  renderGenreTags();
  renderBlacklist();
  renderStats();
  updateFiltersUI();
  bindAllEvents();
  initSDK();
  setTimeout(() => loadDevices(), 2000);
  setVolume(State.volume);
  updateSyncStatus();
  setupMediaSession();
  if (_deferredPrompt) showInstallBanner();
  updateNotificationBtn();

}

// ── LOGIN ──────────────────────────────────────────────────────────────────────
function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function bindLoginEvents(clientId, redirectUri) {
  const loginBtn = document.getElementById('login-btn');
  const cidInput = document.getElementById('client-id-input');
  loginBtn.addEventListener('click', async () => {
    const cid = cidInput.value.trim() || clientId;
    if (!cid) { showToast(I18N.t('msg_client_id_missing'), 'error'); cidInput.focus(); return; }
    const uri = window.SPOTIFY_CONFIG?.redirectUri || redirectUri;
    localStorage.setItem('as_client_id', cid);
    SpotifyAPI.init(cid, uri);
    try { await SpotifyAPI.startLogin(); }
    catch (err) { showToast(I18N.t('msg_login_failed', { error: err.message }), 'error'); }
  });
  cidInput.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
}

function renderUserInfo() {
  if (!State.user) return;
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  nameEl.textContent = nameEl.title = State.user.display_name || State.user.id;
  const img = State.user.images?.[0]?.url;
  if (img) { avatarEl.src = avatarEl.title = img; avatarEl.classList.remove('hidden'); }
}

// ── BIND ALL EVENTS ───────────────────────────────────────────────────────────
function bindAllEvents() {

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => {
    SpotifyAPI.logout(); State.player?.disconnect();
    State.isPlaying = false;
    syncSilentAudio(false); // Medientasten-Anker stoppen, sonst „spielt" der Tab weiter
    if ('mediaSession' in navigator) { navigator.mediaSession.playbackState = 'none'; navigator.mediaSession.metadata = null; }
    showLoginScreen(); document.title = 'Music Shuffle';
  });

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.sidebar-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`view-${tab.dataset.view}`)?.classList.add('active');
      if (tab.dataset.view === 'shufflelog') renderShuffleLog();
    });
  });

  // Mobile menu
  const menuBtn  = document.getElementById('mobile-menu-btn');
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  document.body.appendChild(backdrop);
  menuBtn.addEventListener('click', () => { sidebar.classList.toggle('open'); backdrop.classList.toggle('visible', sidebar.classList.contains('open')); });
  backdrop.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.classList.remove('visible'); });

  // List name display
  document.getElementById('list-name-display')?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const dd = document.getElementById('list-dropdown');
    if (!dd.classList.contains('hidden')) { dd.classList.add('hidden'); return; }
    dd.innerHTML = '';
    State.lists.forEach(list => {
      const count = (list.artists?.length || 0) + (list.albums?.length || 0) + (list.genres?.length || 0);
      const btn = document.createElement('button');
      btn.className = 'list-dropdown-item' + (list.id === State.activeListId ? ' active' : '');
      btn.innerHTML = `<span>${escHtml(list.name)}</span>${count ? `<span class="list-dropdown-count">${count}</span>` : ''}`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dd.classList.add('hidden');
        switchActiveList(list.id);
      });
      dd.appendChild(btn);
    });
    dd.classList.remove('hidden');
  });
  // Klick außerhalb schließt das Dropdown
  document.addEventListener('click', (e) => {
    const dd = document.getElementById('list-dropdown');
    if (dd && !dd.classList.contains('hidden') && !dd.contains(e.target) && !document.getElementById('list-name-display').contains(e.target)) {
      dd.classList.add('hidden');
    }
  });

  // List select
  document.getElementById('list-select').addEventListener('change', e => {
    State.activeListId = e.target.value;
    renderArtistGrid(); renderAlbumGrid(); updateFiltersUI();
    localStorage.setItem('as_active_list', State.activeListId);
  });

  // New list
  const newListModal = document.getElementById('modal-new-list');
  document.getElementById('new-list-btn').addEventListener('click', () => { document.getElementById('new-list-name').value = ''; newListModal.classList.remove('hidden'); setTimeout(() => document.getElementById('new-list-name').focus(), 50); });
  document.getElementById('confirm-new-list').addEventListener('click', () => { createList(document.getElementById('new-list-name').value); newListModal.classList.add('hidden'); });
  document.getElementById('cancel-new-list').addEventListener('click', () => newListModal.classList.add('hidden'));
  document.getElementById('new-list-name').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('confirm-new-list').click(); if (e.key === 'Escape') document.getElementById('cancel-new-list').click(); });

  // List options bottom sheet
  const listOptionsSheet = document.getElementById('list-options-dropdown');
  const openSheet  = () => listOptionsSheet.classList.remove('hidden');
  const closeSheet = () => listOptionsSheet.classList.add('hidden');

  document.getElementById('list-options-btn').addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    // Listen-Dropdown schließen falls offen
    document.getElementById('list-dropdown')?.classList.add('hidden');
    listOptionsSheet.classList.toggle('hidden');
  });
  // Klick außerhalb schließt das Optionen-Dropdown
  document.addEventListener('click', (e) => {
    if (!listOptionsSheet.classList.contains('hidden')
        && !listOptionsSheet.contains(e.target)
        && !document.getElementById('list-options-btn').contains(e.target)) {
      listOptionsSheet.classList.add('hidden');
    }
  });

  // Rename
  document.getElementById('rename-list-btn').addEventListener('click', () => {
    closeSheet();
    const list = getActiveList(); if (!list) return;
    document.getElementById('rename-list-input').value = list.name;
    document.getElementById('modal-rename-list').classList.remove('hidden');
    setTimeout(() => document.getElementById('rename-list-input').focus(), 50);
  });
  document.getElementById('confirm-rename-list').addEventListener('click', () => { renameActiveList(document.getElementById('rename-list-input').value); document.getElementById('modal-rename-list').classList.add('hidden'); });
  document.getElementById('cancel-rename-list').addEventListener('click', () => document.getElementById('modal-rename-list').classList.add('hidden'));
  document.getElementById('rename-list-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('confirm-rename-list').click(); if (e.key === 'Escape') document.getElementById('cancel-rename-list').click(); });

  // Delete
  document.getElementById('delete-list-btn').addEventListener('click', () => { closeSheet(); document.getElementById('modal-delete-list').classList.remove('hidden'); });
  document.getElementById('confirm-delete-list').addEventListener('click', () => { deleteActiveList(); document.getElementById('modal-delete-list').classList.add('hidden'); });
  document.getElementById('cancel-delete-list').addEventListener('click', () => document.getElementById('modal-delete-list').classList.add('hidden'));

  // Duplicate / Merge / Export / Import
  document.getElementById('duplicate-list-btn')?.addEventListener('click', () => { closeSheet(); duplicateActiveList(); });
  document.getElementById('merge-list-btn')?.addEventListener('click', () => { closeSheet(); showMergeModal(); });
  document.getElementById('export-lists-btn').addEventListener('click', () => { closeSheet(); exportLists(); });
  document.getElementById('import-lists-btn').addEventListener('click', () => { closeSheet(); document.getElementById('import-file-input').click(); });
  document.getElementById('import-file-input').addEventListener('change', e => { const f = e.target.files?.[0]; if (f) importLists(f); e.target.value = ''; });

  // Merge modal
  document.getElementById('cancel-merge-list')?.addEventListener('click', () => document.getElementById('modal-merge-list').classList.add('hidden'));
  document.getElementById('confirm-merge-list')?.addEventListener('click', () => {
    const sel = document.getElementById('merge-list-select');
    if (sel.value) mergeListIntoActive(sel.value);
    document.getElementById('modal-merge-list').classList.add('hidden');
  });

  // Album browser
  document.getElementById('close-album-browser')?.addEventListener('click', () => document.getElementById('modal-album-browser').classList.add('hidden'));
  document.getElementById('tab-albums-btn')?.addEventListener('click', () => _switchAlbumBrowserTab('albums'));
  document.getElementById('tab-trackstatus-btn')?.addEventListener('click', () => _switchAlbumBrowserTab('trackstatus'));
  document.getElementById('confirm-album-browser')?.addEventListener('click', addSelectedAlbumsToList);

  // Artist grid
  document.getElementById('artist-grid').addEventListener('click', e => {
    const card = e.target.closest('.artist-card');
    if (!card) return;
    const removeBtn   = e.target.closest('.artist-card-remove');
    const favoriteBtn = e.target.closest('.artist-card-favorite');
    if (removeBtn)   { removeArtistFromList(removeBtn.dataset.id); return; }
    if (favoriteBtn) { toggleArtistFavorite(favoriteBtn.dataset.id); return; }
    const artist = getActiveList()?.artists?.find(a => a.id === card.dataset.artistId);
    if (artist) showAlbumBrowser(artist.id, artist.name);
  });

  // Artist stats close
  document.getElementById('close-artist-stats')?.addEventListener('click', () => document.getElementById('modal-artist-stats').classList.add('hidden'));


  // Changelog
  document.getElementById('changelog-btn')?.addEventListener('click', showChangelog);
  document.getElementById('close-changelog')?.addEventListener('click', () => document.getElementById('modal-changelog').classList.add('hidden'));

  // Language
  document.getElementById('lang-btn')?.addEventListener('click', () => {
    I18N.setLang(I18N.getLang() === 'de' ? 'en' : 'de');
  });
  // Jeder Sprachwechsel (I18N.setLang → applyAll) zeichnet alle dynamischen Bereiche neu
  document.addEventListener('langchange', () => {
    updateLangBtn();
    renderLists(); renderArtistGrid(); renderAlbumGrid(); renderGenreTags();
    renderQueue(); renderHistory(); renderBlacklist(); renderShuffleLog(); renderStats(); updateFiltersUI();
  });

  // Notifications
  document.getElementById('notification-btn')?.addEventListener('click', async () => {
    const ok = await requestNotificationPermission();
    if (ok) { document.getElementById('notification-btn').classList.add('active'); showToast(I18N.t('toast_notification_on'), 'success'); }
    else showToast(I18N.t('toast_notification_blocked'), 'error');
  });

  // Crossfade
  document.getElementById('crossfade-btn')?.addEventListener('click', () => {
    State.crossfade = !State.crossfade;
    document.getElementById('crossfade-btn').classList.toggle('active', State.crossfade);
    showToast(State.crossfade ? I18N.t('toast_crossfade_on') : I18N.t('toast_crossfade_off'), 'info');
  });

  // Shuffle
  document.getElementById('shuffle-btn-idle').addEventListener('click', doShuffle);
  document.getElementById('shuffle-btn').addEventListener('click', doShuffle);

  // Play/Pause
  ['play-pause-btn', 'fs-play'].forEach(id => document.getElementById(id)?.addEventListener('click', async () => {
    if (State.isPlaying) {
      State.player?.pause();
    } else if (State._lastTrack && !State._restoredPlayed && State.currentTrack?.id === State._lastTrack.id) {
      // Erster Play nach Browser-Neustart — Track von vorne starten
      State._restoredPlayed = true;
      await playTrack(State._lastTrack);
    } else {
      State.player?.resume();
    }
  }));

  // Next / Prev
  document.getElementById('next-btn').addEventListener('click', playNextFromQueue);
  document.getElementById('prev-btn').addEventListener('click', playPrevFromHistory);
  document.getElementById('fs-next').addEventListener('click', playNextFromQueue);
  document.getElementById('fs-prev').addEventListener('click', playPrevFromHistory);

  // Repeat
  document.getElementById('repeat-btn').addEventListener('click', () => {
    State.repeatMode = !State.repeatMode;
    document.getElementById('repeat-btn').classList.toggle('active', State.repeatMode);
    SpotifyAPI.setRepeat(State.repeatMode ? 'track' : 'off', State.activeDeviceId).catch(() => {});
    showToast(State.repeatMode ? I18N.t('toast_repeat_on') : I18N.t('toast_repeat_off'), 'info');
  });

  // Volume
  document.getElementById('volume-slider').addEventListener('input', e => { State.isMuted = false; setVolume(parseInt(e.target.value, 10)); });
  document.getElementById('mute-btn').addEventListener('click', toggleMute);

  // Blacklist
  document.getElementById('blacklist-btn').addEventListener('click', () => { if (State.currentTrack) addToBlacklist(State.currentTrack); });
  document.getElementById('blacklist-album-btn').addEventListener('click', () => { addAlbumToBlacklist(); });
  document.getElementById('blacklist-toggle').addEventListener('change', e => { State.blacklistEnabled = e.target.checked; localStorage.setItem('as_blacklist_enabled', State.blacklistEnabled); });

  // Progress bar
  const progressTrack = document.getElementById('progress-track');
  progressTrack.addEventListener('click', e => {
    if (!State.duration) return;
    const rect  = progressTrack.getBoundingClientRect();
    const posMs = ((e.clientX - rect.left) / rect.width) * State.duration;
    State.position = posMs; updateProgressUI();
    SpotifyAPI.seek(posMs, State.activeDeviceId).catch(() => {});
  });

  // Fullscreen
  document.getElementById('fullscreen-btn').addEventListener('click', toggleFullscreen);
  document.getElementById('fs-exit').addEventListener('click', toggleFullscreen);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') document.getElementById('fullscreen-overlay').classList.add('hidden'); });

  // Devices
  document.getElementById('device-select').addEventListener('change', async e => {
    const id = e.target.value;
    if (!id) return;
    State.activeDeviceId = id;
    try { await SpotifyAPI.transferPlayback(id, false); showToast(I18N.t('toast_device_changed'), 'success'); }
    catch (err) { showToast(I18N.t('msg_device_error', { error: err.message }), 'error'); }
  });
  document.getElementById('refresh-devices-btn').addEventListener('click', loadDevices);

  // Mobile controls
  document.getElementById('mobile-shuffle-btn')?.addEventListener('click', doShuffle);
  document.getElementById('mini-play-pause')?.addEventListener('click', () => { State.isPlaying ? State.player?.pause() : State.player?.resume(); });
  document.getElementById('mini-next')?.addEventListener('click', playNextFromQueue);
  document.getElementById('mini-shuffle')?.addEventListener('click', doShuffle);

  // Mobile device select
  const mobDevSel = document.getElementById('mobile-device-select');
  if (mobDevSel) {
    mobDevSel.addEventListener('change', e => {
      const id = e.target.value;
      if (!id) return;
      State.activeDeviceId = id;
      document.getElementById('device-select').value = id;
      SpotifyAPI.transferPlayback(id, false).catch(() => {});
      showToast(I18N.t('toast_device_changed'), 'success');
    });
    document.getElementById('mobile-refresh-devices')?.addEventListener('click', loadDevices);
  }

  // Filters
  document.getElementById('filter-no-live').addEventListener('change', saveFilters);
  document.getElementById('filter-no-instrumental').addEventListener('change', saveFilters);
  document.getElementById('filter-no-acoustic').addEventListener('change', saveFilters);
  document.getElementById('filter-no-orchestral').addEventListener('change', saveFilters);
  document.getElementById('filter-no-commentary').addEventListener('change', saveFilters);
  document.getElementById('filter-artist-repeat-limit').addEventListener('change', saveFilters);
  document.getElementById('filter-no-repeat').addEventListener('change', saveFilters);
  document.getElementById('filter-year-from').addEventListener('change', saveFilters);
  document.getElementById('filter-year-to').addEventListener('change', saveFilters);
  ['from', 'to'].forEach(dir => {
    const btn   = document.getElementById(`filter-year-${dir}-toggle`);
    const input = document.getElementById(`filter-year-${dir}`);
    btn.addEventListener('click', () => {
      const active = btn.classList.toggle('active');
      input.classList.toggle('hidden', !active);
      if (!active) { input.value = ''; saveFilters(); } else input.focus();
    });
  });

  // Stats
  document.getElementById('stats-range').addEventListener('change', renderStats);
  document.getElementById('stats-songs-expand')?.addEventListener('click', e => {
    const btn = e.currentTarget;
    btn.dataset.expanded = btn.dataset.expanded === '1' ? '0' : '1';
    renderStats();
  });

  // History / Queue
  document.getElementById('clear-history-btn').addEventListener('click', () => { State.history = []; State.historyIds.clear(); renderHistory(); });
  document.getElementById('regenerate-queue-btn').addEventListener('click', () => { State.queue = []; fillQueue(); });

  // Stats reset
  document.getElementById('reset-stats-btn').addEventListener('click', () => {
    if (!confirm(I18N.t('confirm_stats_reset'))) return;
    State.stats = { plays: [], shuffles: 0 };
    localStorage.setItem('as_stats', JSON.stringify(State.stats));
    LS.save();
    Sync.saveStats(); // sofort synchen, sonst lädt der nächste Start die alten Stats vom Server zurück
    renderStats();
    showToast(I18N.t('toast_stats_reset'), 'info');
  });

  // Auto-Skip
  const autoSkipBtn = document.getElementById('autoskip-btn');
  if (autoSkipBtn) {
    autoSkipBtn.classList.toggle('active', State.autoSkip);
    autoSkipBtn.addEventListener('click', () => { State.autoSkip = !State.autoSkip; autoSkipBtn.classList.toggle('active', State.autoSkip); showToast(State.autoSkip ? I18N.t('toast_autoskip_on') : I18N.t('toast_autoskip_off'), 'info'); });
  }

  document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);

  document.getElementById('clear-track-history-btn')?.addEventListener('click', () => {
    State.artistTrackHistory = {};
    localStorage.setItem('as_track_history', '{}');
    Sync.saveTrackHistory(); // sofort synchen, kein Debounce
    showToast(I18N.t('toast_track_history_cleared'), 'info');
  });

  const roundRobinBtn = document.getElementById('round-robin-btn');
  if (roundRobinBtn) {
    roundRobinBtn.classList.toggle('active', State.roundRobin);
    roundRobinBtn.addEventListener('click', () => {
      State.roundRobin = !State.roundRobin;
      if (!State.roundRobin) {
        // Letzte 5 gespielte Artists für je 5 Songs sperren
        const recent = State.history.slice(0, 5)
          .filter(t => t.artistId)
          .reduce((acc, t) => { if (!acc.find(x => x.artistId === t.artistId)) acc.push({ artistId: t.artistId, remaining: 5 }); return acc; }, []);
        State._artistCooldown = recent;
        console.log('[RR] Cooldown gesetzt für', recent.map(x => x.artistId));
      }
      State._rrQueue = []; State._rrIndex = 0;
      roundRobinBtn.classList.toggle('active', State.roundRobin);
      showToast(I18N.t(State.roundRobin ? 'msg_rr_on' : 'msg_rr_off'), 'info');
    });
  }

  // Smart Shuffle
  const smartToggle = document.getElementById('smart-shuffle-toggle');
  if (smartToggle) {
    smartToggle.checked = State.smartShuffle;
    smartToggle.addEventListener('change', e => { State.smartShuffle = e.target.checked; showToast(State.smartShuffle ? I18N.t('toast_smart_on') : I18N.t('toast_smart_off'), 'info'); });
  }

  // Only New
  const onlyNewBtn = document.getElementById('only-new-btn');
  if (onlyNewBtn) {
    onlyNewBtn.addEventListener('click', () => { State.onlyNew = !State.onlyNew; onlyNewBtn.classList.toggle('active', State.onlyNew); showToast(State.onlyNew ? I18N.t('toast_only_new_on') : I18N.t('toast_only_new_off'), 'info'); });
  }

  // Create playlist
  document.getElementById('create-playlist-btn')?.addEventListener('click', createPlaylistFromHistory);

  // Sync
  document.getElementById('sync-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('sync-btn');
    btn.classList.add('spinning');
    const [ok] = await Promise.all([Sync.load(), Sync.loadStats(), Sync.loadBlacklist(), Sync.loadTrackHistory()]);
    btn.classList.remove('spinning');
    if (ok) { renderLists(); renderArtistGrid(); renderAlbumGrid(); updateFiltersUI(); renderStats(); renderBlacklist(); showToast(I18N.t('toast_synced'), 'success'); }
    else showToast(I18N.t('toast_sync_fail'), 'error');
  });

  // Search setup
  setupSearch();
  setupAlbumArtistSearch();
  setupGenreSearch();

  // Start progress timer
  startProgressTimer();
}
