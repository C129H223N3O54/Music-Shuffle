/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/shuffle.js
   Shuffle-Logik, Queue, Verlauf, Blacklist, Playlist, Fehlerbehandlung
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── SMART SHUFFLE ─────────────────────────────────────────────────────────────
function pickSmartArtist(artists) {
  if (!artists?.length) return null;
  if (!State.smartShuffle) return artists[Math.floor(Math.random() * artists.length)];

  const now    = Date.now();
  const recent = State.stats.plays.slice(-50);

  const weights = artists.map(a => {
    const base      = a.favorite ? 3 : 1;
    const last      = recent.filter(p => p.artistId === a.id);
    if (!last.length) return 3 * base;
    const ago = (now - Math.max(...last.map(p => p.ts))) / 60000;
    if (ago < 10) return 0.3 * base;
    if (ago < 30) return 0.7 * base;
    if (ago < 60) return 1.5 * base;
    return 3 * base;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < artists.length; i++) { r -= weights[i]; if (r <= 0) return artists[i]; }
  return artists[artists.length - 1];
}

// ── SHUFFLE ───────────────────────────────────────────────────────────────────
function _buildPool(list) {
  const pool = [];
  // Artists 5× gewichtet — jeder hat eine ganze Diskografie, ein Album nur sich selbst
  (list.artists || []).forEach(a => {
    for (let i = 0; i < 5; i++) pool.push({ type: 'artist', data: a });
  });
  (list.albums  || []).forEach(a => pool.push({ type: 'album',  data: a }));
  (list.genres  || []).forEach(g => pool.push({ type: 'genre',  data: g }));
  return pool;
}

function getBlacklistSet() {
  return State.blacklistEnabled ? new Set(State.blacklist.map(b => b.id)) : new Set();
}

const _randomItem = arr => arr[Math.floor(Math.random() * arr.length)];

// Nächster Artist im Round-Robin-Durchlauf (neu gemischt, wenn alle dran waren)
function _nextRoundRobinArtist(list) {
  if (!State._rrQueue.length || State._rrIndex >= State._rrQueue.length) {
    State._rrQueue = [...list.artists].sort(() => Math.random() - 0.5).map(a => ({ type: 'artist', data: a }));
    State._rrIndex = 0;
  }
  return State._rrQueue[State._rrIndex++];
}

// Filter „Artist-Wiederholung nach N Tracks": Artists der letzten N Titel
// (Queue + Verlauf) meiden — solange es noch andere Artists gibt.
function _recentArtistIds(list) {
  const limit = Math.min(list.filters?.artistRepeatLimit ?? 3, (list.artists?.length || 1) - 1);
  if (limit <= 0) return new Set();
  const recent = [...State.queue].reverse().concat(State.history).map(t => t.artistId).filter(Boolean);
  return new Set(recent.slice(0, limit));
}

// Wählt die Quelle für den nächsten Titel: Artist, Album oder Genre.
// Gemeinsam für Shuffle-Button und Queue — vorher war die Logik doppelt
// vorhanden und lief auseinander (Round Robin vs. Smart Shuffle).
function chooseSource(list, { forQueue = false } = {}) {
  if (State.roundRobin && list.artists?.length) return _nextRoundRobinArtist(list);

  let pool = _buildPool(list);
  if (forQueue) pool = pool.filter(p => p.type !== 'genre');
  if (!pool.length) return null;

  const avoid = _recentArtistIds(list);
  // Artist-Cooldown nach Round-Robin-Deaktivierung
  if (State._artistCooldown.length) {
    State._artistCooldown.forEach(x => avoid.add(x.artistId));
    State._artistCooldown = State._artistCooldown
      .map(x => ({ ...x, remaining: x.remaining - 1 }))
      .filter(x => x.remaining > 0);
  }
  // Auch Alben eines eben gespielten Artists meiden — sonst umgehen Album-Einträge die Sperre
  const artistOf = p => p.type === 'artist' ? p.data.id : p.type === 'album' ? p.data.artistId : null;
  const reduced = pool.filter(p => !avoid.has(artistOf(p)));
  if (reduced.length) pool = reduced;

  const picked = _randomItem(pool);
  if (picked.type === 'artist' && State.smartShuffle) {
    const candidates = list.artists.filter(a => !avoid.has(a.id));
    return { type: 'artist', data: pickSmartArtist(candidates.length ? candidates : list.artists) };
  }
  return picked;
}

// Holt einen Titel für die gewählte Quelle. Liefert { track, artistName, reason }.
// Titel, die schon in der Queue stehen (inkl. Versionen). Sie zählen beim Neustart
// eines Durchlaufs als „schon gezogen" — sonst könnte derselbe Song direkt noch
// einmal in die Queue kommen. Bereits gespielte Titel gehören zum alten Durchlauf
// und bleiben außen vor (sonst kämen sie im neuen Durchlauf zu kurz).
function _inFlightIds() {
  const ids = [];
  for (const t of State.queue) ids.push(t.id, ...(t.variantIds || []));
  return ids.filter(Boolean);
}

async function fetchTrackFor(source, list) {
  const filters   = list.filters || defaultFilters();
  const blacklist = getBlacklistSet();
  if (source.type === 'genre') {
    const track = await SpotifyAPI.getRandomTrackByGenre(source.data, filters, blacklist);
    return { track, artistName: track?.artists?.[0]?.name || '—', reason: '🎸 Genre' };
  }
  const lock = filters.noRepeat !== false;
  if (source.type === 'album') {
    const played = lock ? new Set(State.artistTrackHistory[source.data.artistId] || []) : new Set();
    const track = await SpotifyAPI.getRandomTrackFromAlbum(source.data.id, source.data, blacklist, State.historyIds, State.onlyNew, played);
    return { track, artistName: source.data.artistName, reason: '💿 Album' };
  }
  const artist = source.data;
  const track = await SpotifyAPI.getRandomTrack(artist.id, filters, blacklist, State.historyIds, State.onlyNew,
    lock ? State.artistTrackHistory : {}, filters.artistRepeatLimit, _inFlightIds());
  const reason = State.roundRobin ? '🔁 Round Robin' : artist.favorite ? '⭐ Favorit' : State.smartShuffle ? '🧠 Smart' : '🎲 Zufall';
  return { track, artistName: artist.name, reason };
}

async function doShuffle() {
  const list = getActiveList();
  if (!list || !_buildPool(list).length) { showToast(I18N.t('toast_no_artists'), 'error'); return; }

  animateDice();
  State.stats.shuffles++;
  LS.save();

  try {
    const source = chooseSource(list);
    const { track, artistName, reason } = await fetchTrackFor(source, list);
    if (track) {
      State.shuffleLog.unshift({ trackName: track.name, artistName, reason, ts: Date.now() });
      if (State.shuffleLog.length > 20) State.shuffleLog.pop();
    }

    if (!track) { showToast(I18N.t('toast_no_track'), 'info'); return; }
    if (State.autoSkip && track.duration_ms && track.duration_ms < State.autoSkipMin * 1000) {
      showToast(I18N.t('msg_autoskip', { s: Math.round(track.duration_ms / 1000) }), 'info');
      setTimeout(() => doShuffle(), 500); return;
    }

    // Track sofort in die Sperre eintragen (nicht erst beim Abspielen via checkAndAddToHistory).
    // Verhindert dass fillQueue oder ein schneller nächster Shuffle denselben Track nochmal zieht.
    lockTrackForArtist(track, list.filters);

    await playTrack(track);
    setTimeout(() => fillQueue(), 20000);
  } catch (err) { handlePlaybackError(err); }
}

// Sperrt einen gezogenen Song für seinen Artist — inklusive aller Versionen
// (Single + Albumversion haben unterschiedliche IDs). track.artistId setzt
// SpotifyAPI.getRandomTrack auf den Artist, für den gezogen wurde.
function lockTrackForArtist(track, filters) {
  if (!track?.artistId || filters?.noRepeat === false) return;
  const arr = State.artistTrackHistory[track.artistId] || (State.artistTrackHistory[track.artistId] = []);
  let changed = false;
  for (const id of [track.id, ...(track.variantIds || [])]) {
    if (id && !arr.includes(id)) { arr.push(id); changed = true; }
  }
  if (changed) LS.saveTrackHistoryDebounced();
}

async function playTrack(track) {
  if (!State.activeDeviceId) { showToast(I18N.t('toast_device_none'), 'error'); return; }
  try {
    await SpotifyAPI.playTrack(track.uri, State.activeDeviceId);
  } catch (err) {
    // 404 = Spotify kennt das Gerät nicht mehr. Passiert, wenn der Browser den Tab
    // eingefroren hat (Back-Forward-Cache, Energiesparen) und die SDK-Verbindung weg ist.
    if (err.status === 404 && isOwnDevice(State.activeDeviceId)) {
      showToast(I18N.t('toast_reconnecting'), 'info');
      const newId = await reconnectPlayer('404 beim Abspielen');
      if (newId) {
        try { await SpotifyAPI.playTrack(track.uri, newId); return; }
        catch (err2) { handlePlaybackError(err2); return; }
      }
      showToast(I18N.t('toast_reconnect_failed'), 'error');
      return;
    }
    if (err.status === 404) { loadDevices(); showToast(I18N.t('toast_device_gone'), 'error'); return; }
    handlePlaybackError(err);
  }
}

async function fillQueue() {
  const list = getActiveList();
  if (!list || !_buildPool(list).some(p => p.type !== 'genre')) return;

  const needed = 2 - State.queue.length;
  for (let i = 0; i < needed; i++) {
    let track = null;
    try {
      const source = chooseSource(list, { forQueue: true });
      if (source) ({ track } = await fetchTrackFor(source, list));
    } catch {}
    if (track && !State.queue.find(q => q.id === track.id)) {
      State.queue.push(track);
      // WICHTIG: Track sofort provisorisch in die Sperre eintragen, damit der nächste
      // getRandomTrack-Aufruf (für die Queue ODER den nächsten Shuffle) ihn nicht erneut zieht.
      lockTrackForArtist(track, list.filters);
      renderQueue();
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  renderQueue();
}

async function playNextFromQueue() {
  if (State.queue.length) {
    const track = State.queue.shift();
    renderQueue();
    await playTrack(track);
    setTimeout(() => fillQueue(), 5000);
    return;
  }
  await doShuffle();
}

async function playPrevFromHistory() {
  if (State.history.length < 2) return;
  const prev = State.history[1];
  if (prev) await playTrack(prev);
}

// ── HISTORY ───────────────────────────────────────────────────────────────────
function checkAndAddToHistory(track) {
  if (State.history[0]?.id === track.id) return;
  State.history.unshift({ ...track });
  if (State.history.length > 20) State.history.pop();
  State.historyIds.add(track.id);
  // Artist-Track-History pflegen
  if (track.artistId) {
    if (!State.artistTrackHistory[track.artistId]) State.artistTrackHistory[track.artistId] = [];
    if (!State.artistTrackHistory[track.artistId].includes(track.id)) {
      State.artistTrackHistory[track.artistId].push(track.id);
      LS.saveTrackHistoryDebounced();
    }
  }
  renderHistory();
  trackPlay(track);
}

function renderHistory() {
  const list  = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  list.innerHTML = '';
  if (!State.history.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('history_empty')}</p>`;
    return;
  }
  empty?.classList.add('hidden');
  State.history.forEach((track, idx) => {
    const item = createTrackItem(track, idx, [{ icon: '▶', title: I18N.t('msg_play'), action: () => playTrack(track) }, { icon: '🚫', title: I18N.t('msg_add_blacklist'), action: () => addToBlacklist(track) }]);
    if (track.id === State.currentTrack?.id) item.classList.add('playing');
    list.appendChild(item);
  });
}

// ── QUEUE ──────────────────────────────────────────────────────────────────────
function renderQueue() {
  const list  = document.getElementById('queue-list');
  const empty = document.getElementById('queue-empty');
  list.innerHTML = '';
  if (!State.queue.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('queue_empty')}</p><small>${I18N.t('queue_empty_sub')}</small>`;
    return;
  }
  empty?.classList.add('hidden');
  State.queue.forEach((track, idx) => {
    const item = createTrackItem(track, idx + 1, [{ icon: '✕', title: I18N.t('msg_remove'), action: () => { State.queue.splice(idx, 1); renderQueue(); } }]);
    item.addEventListener('click', e => {
      if (e.target.closest('.track-item-actions')) return;
      State.queue.splice(idx, 1); renderQueue(); playTrack(track);
    });
    list.appendChild(item);
  });
}

// ── BLACKLIST ──────────────────────────────────────────────────────────────────
function addToBlacklist(track) {
  if (!track || State.blacklist.find(b => b.id === track.id)) return;
  State.blacklist.push({ id: track.id, name: track.name, artist: track.artist, albumArt: track.albumArt });
  LS.saveBlacklistDebounced(); renderBlacklist();
  showToast(I18N.t('msg_blacklisted', { name: track.name }), 'info');
  playNextFromQueue();
}

async function addAlbumToBlacklist() {
  const track = State.currentTrack;
  if (!track) return;
  // Album-ID aus dem aktuellen Track holen
  const albumId = track.albumId || null;
  if (!albumId) {
    // Fallback: nur aktuellen Track blacklisten
    addToBlacklist(track);
    return;
  }
  try {
    const tracks = await SpotifyAPI.getAlbumTracks(albumId);
    if (!tracks.length) throw new Error('Album nicht ladbar');
    let added = 0;
    tracks.forEach(t => {
      if (!State.blacklist.find(b => b.id === t.id)) {
        State.blacklist.push({ id: t.id, name: t.name, artist: track.artist, albumArt: track.albumArt });
        added++;
      }
    });
    LS.saveBlacklistDebounced(); renderBlacklist();
    showToast(I18N.t('msg_album_blacklisted', { name: track.album, n: added }), 'info');
    if (added > 0) playNextFromQueue();
  } catch (err) {
    showToast(I18N.t('msg_album_load_failed', { error: err.message }), 'error');
  }
}

function removeFromBlacklist(trackId) {
  State.blacklist = State.blacklist.filter(b => b.id !== trackId);
  LS.saveBlacklistDebounced(); renderBlacklist();
}

function renderBlacklist() {
  const list  = document.getElementById('blacklist-list');
  const empty = document.getElementById('blacklist-empty');
  list.innerHTML = '';
  if (!State.blacklist.length) {
    empty?.classList.remove('hidden');
    if (empty) empty.innerHTML = `<p>${I18N.t('blacklist_empty')}</p><small>${I18N.t('blacklist_empty_sub')}</small>`;
    return;
  }
  empty?.classList.add('hidden');
  State.blacklist.forEach((track, idx) => {
    list.appendChild(createTrackItem(track, idx + 1, [{ icon: '✕', title: I18N.t('msg_remove'), action: () => removeFromBlacklist(track.id) }]));
  });
  document.getElementById('blacklist-toggle').checked = State.blacklistEnabled;
}

// ── PLAYLIST FROM HISTORY ─────────────────────────────────────────────────────
async function createPlaylistFromHistory() {
  if (!State.history.length) { showToast(I18N.t('msg_history_empty'), 'info'); return; }
  const name = `Music Shuffle — ${new Date().toLocaleDateString('de-DE')}`;
  const uris = [...new Set(State.history.map(t => t.uri).filter(Boolean))];
  try {
    showToast(I18N.t('toast_playlist_creating'), 'info');
    await SpotifyAPI.createPlaylist(name, 'Erstellt von Music Shuffle', uris);
    showToast(I18N.t('msg_playlist_created', { name, n: uris.length }), 'success');
  } catch (err) {
    if (err.message === 'NOT_AUTHENTICATED') { showLoginScreen(); return; }
    // Logins von vor v1.5.2 haben die Playlist-Berechtigung noch nicht
    if (/scope|Forbidden/i.test(err.message)) showToast(I18N.t('toast_playlist_relogin'), 'error');
    else showToast(I18N.t('msg_error', { error: err.message }), 'error');
  }
}

// ── ERROR ──────────────────────────────────────────────────────────────────────
let _rateLimitRetryTimer = null;

function handlePlaybackError(err) {
  if (err.message === 'PREMIUM_REQUIRED') {
    showToast(I18N.t('toast_premium'), 'error');
  } else if (err.message === 'NOT_AUTHENTICATED') {
    showLoginScreen();
  } else if (err.message?.includes('No active device')) {
    showToast(I18N.t('toast_device_none'), 'error');
  } else if (err.message?.includes('Rate limit')) {
    if (_rateLimitRetryTimer) return;
    showToast(I18N.t('msg_rate_limit'), 'info');
    console.warn('[Playback] Rate limit — retry in 35s');
    _rateLimitRetryTimer = setTimeout(() => {
      _rateLimitRetryTimer = null;
      console.log('[Playback] Rate limit retry…');
      doShuffle();
    }, 35000);
  } else {
    showToast(I18N.t('msg_error', { error: err.message }), 'error');
    console.error('[Playback Error]', err);
  }
}

// ── DICE ANIMATION ────────────────────────────────────────────────────────────
function animateDice() {
  document.querySelectorAll('.btn-shuffle-big').forEach(btn => {
    btn.classList.add('rolling');
    setTimeout(() => btn.classList.remove('rolling'), 600);
  });
}
