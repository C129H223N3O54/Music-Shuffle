/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/player.js
   Spotify Web Playback SDK, Geräte, Reconnect, Now Playing, Medientasten, Lautstärke
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── SDK ───────────────────────────────────────────────────────────────────────
window.onSpotifyWebPlaybackSDKReady = () => {};

function initSDK() {
  const initFn = () => {
    SpotifyAPI.getToken().then(token => {
      if (!token) return;
      State.player = new Spotify.Player({
        name: 'Music Shuffle',
        getOAuthToken: cb => SpotifyAPI.getToken().then(cb),
        volume: State.volume / 100,
      });
      State.player.addListener('ready', ({ device_id }) => {
        const reconnect = !!State._ownDeviceIds.length;
        // War das alte eigene Gerät ausgewählt → auf die neue ID umstellen
        if (!State.activeDeviceId || isOwnDevice(State.activeDeviceId)) State.activeDeviceId = device_id;
        State.deviceId = device_id;
        if (!State._ownDeviceIds.includes(device_id)) State._ownDeviceIds.push(device_id);
        clearTimeout(_notReadyTimer);
        console.log(`[SDK] Ready${reconnect ? ' (reconnect)' : ''}, device:`, device_id);
        _resolveReconnect?.(device_id);
        setTimeout(() => loadDevices(), reconnect ? 500 : 3000);
        if (reconnect) return;
        showToast(I18N.t('toast_ready'), 'success');
        // Letzten Track wiederherstellen — anzeigen aber nicht automatisch starten
        if (State._lastTrack && !State.currentTrack) {
          State.currentTrack = State._lastTrack;
          renderNowPlaying(State._lastTrack);
          updateMiniPlayer(State._lastTrack);
          if (State._lastTrack.duration && State._lastTrack.position) {
            State.position = State._lastTrack.position;
            State.duration = State._lastTrack.duration;
            updateProgressUI();
          }
          console.log('[App] Restored last track:', State._lastTrack.name);
        }
      });
      State.player.addListener('not_ready', () => {
        // Gerät ist bei Spotify offline. Kommt es nicht von selbst zurück → neu verbinden.
        console.warn('[SDK] not_ready');
        clearTimeout(_notReadyTimer);
        _notReadyTimer = setTimeout(() => reconnectPlayer('not_ready'), 5000);
      });
      State.player.addListener('player_state_changed', onPlayerStateChanged);
      State.player.addListener('initialization_error', ({ message }) => console.error('[SDK] init:', message));
      State.player.addListener('authentication_error', ({ message }) => { console.error('[SDK] auth:', message); showLoginScreen(); });
      State.player.addListener('account_error', () => showToast(I18N.t('toast_premium'), 'error'));
      State.player.addListener('playback_error', ({ message }) => { if (!message?.includes('no list was loaded')) console.error('[SDK] playback:', message); });
      State.player.connect();
    });
  };
  if (window.Spotify) initFn(); else window.onSpotifyWebPlaybackSDKReady = initFn;
}

// ── GERÄTE-RECONNECT ──────────────────────────────────────────────────────────
// Friert der Browser den Tab ein (Back-Forward-Cache, Energiesparen), verliert
// das SDK seine Verbindung und Spotify meldet das Gerät ab. Die App hält aber noch
// die alte Geräte-ID → „404 Not found" beim nächsten Titel. Hier verbinden wir den
// Player neu, warten auf die neue Geräte-ID und machen dann weiter.
let _reconnectPromise = null, _resolveReconnect = null, _notReadyTimer = null;

function isOwnDevice(id) { return !!id && State._ownDeviceIds.includes(id); }

function reconnectPlayer(reason) {
  if (_reconnectPromise) return _reconnectPromise;
  if (!State.player || !SpotifyAPI.isLoggedIn()) return Promise.resolve(null);
  console.warn('[SDK] Reconnect —', reason);
  _reconnectPromise = new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 15000);
    _resolveReconnect = id => { clearTimeout(timer); resolve(id); };
    try { State.player.disconnect(); } catch {}
    Promise.resolve(State.player.connect()).then(ok => { if (ok === false) { clearTimeout(timer); resolve(null); } })
      .catch(() => { clearTimeout(timer); resolve(null); });
  }).then(id => {
    _reconnectPromise = null; _resolveReconnect = null;
    if (id) showToast(I18N.t('toast_reconnected'), 'success');
    return id;
  });
  return _reconnectPromise;
}

// Rückkehr aus dem Back-Forward-Cache: WebSocket des SDK ist tot → sofort neu verbinden
window.addEventListener('pageshow', e => { if (e.persisted) reconnectPlayer('pageshow (bfcache)'); });

function onPlayerStateChanged(state) {
  if (!state) return;
  State.isPlaying = !state.paused;
  State.position  = state.position;
  State.duration  = state.duration;

  updatePlayPauseUI();
  updateMiniPlayerPlayPause();
  updateProgressUI();
  syncSilentAudio(State.isPlaying);
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';

  const track = state.track_window?.current_track;
  const info = track ? {
    id:       track.id,
    name:     track.name,
    uri:      track.uri,
    artist:   track.artists?.[0]?.name || '—',
    artistId: track.artists?.[0]?.uri?.split(':')[2],
    album:    track.album?.name || '—',
    albumId:  track.album?.uri?.split(':')[2] || null,
    albumArt: track.album?.images?.[0]?.url || '',
    duration: state.duration,
  } : null;
  if (info && (!State.currentTrack || State.currentTrack.id !== info.id)) {
    State.currentTrack = info;
    renderNowPlaying(State.currentTrack);
    updateMiniPlayer(State.currentTrack);
    checkAndAddToHistory(State.currentTrack);
    showTrackNotification(State.currentTrack);
    updateMediaSession(State.currentTrack);
  }
  // Letzten Zustand für Wiederherstellung nach Browser-Neustart speichern
  if (info) localStorage.setItem('as_last_track', JSON.stringify({ ...info, position: state.position }));

  // Auto-next when track ends
  if (state.paused && state.position === 0 && state.track_window?.previous_tracks?.length > 0) {
    if (!State.repeatMode && !State._autoNextPending) {
      State._autoNextPending = true;
      setTimeout(() => { State._autoNextPending = false; playNextFromQueue(); }, 300);
    }
  }

  // Crossfade
  if (State.crossfade && State.duration > 0 && State.isPlaying) {
    const remaining = State.duration - State.position;
    if (remaining < 10000 && remaining > 0 && !State._crossfading) {
      State._crossfading = true;
      const steps = 20, interval = remaining / steps;
      let step = 0;
      const fade = setInterval(() => {
        step++;
        State.player?.setVolume(Math.max(0, (State.volume / 100) * (1 - step / steps))).catch(() => {});
        if (step >= steps) {
          clearInterval(fade);
          State._crossfading = false;
          State.player?.setVolume(State.volume / 100).catch(() => {});
        }
      }, interval);
    }
  } else if (!State.isPlaying) {
    State._crossfading = false;
  }
}

// ── DEVICES ───────────────────────────────────────────────────────────────────
async function loadDevices() {
  try {
    const devices = await SpotifyAPI.getDevices();
    const select  = document.getElementById('device-select');
    const prev    = select.value;
    select.innerHTML = `<option value="">— ${I18N.t('player_device_choose')} —</option>`;

    [...devices].sort((a, b) => {
      if (a.id === State.deviceId) return -1;
      if (b.id === State.deviceId) return  1;
      if (a.is_active) return -1;
      if (b.is_active) return  1;
      return 0;
    }).forEach(d => {
      const opt  = document.createElement('option');
      opt.value  = d.id;
      const icon = d.id === State.deviceId ? '🌐' : d.type === 'Speaker' ? '🔊' : d.type === 'Smartphone' ? '📱' : d.type === 'Computer' ? '💻' : '🎵';
      opt.textContent = `${icon} ${d.name}${d.is_active ? ' ▶' : ''}`;
      select.appendChild(opt);
    });

    if (!devices.length) {
      const opt = document.createElement('option');
      opt.textContent = I18N.t('player_device_not_found');
      select.appendChild(opt);
    }

    // Restore selection
    if (prev && devices.find(d => d.id === prev)) {
      select.value = prev; State.activeDeviceId = prev;
    } else if (State.deviceId) {
      select.value = State.deviceId; State.activeDeviceId = State.deviceId;
    } else {
      const active = devices.find(d => d.is_active);
      if (active) { select.value = active.id; State.activeDeviceId = active.id; }
    }

    // Sync mobile select
    const mob = document.getElementById('mobile-device-select');
    if (mob) { mob.innerHTML = select.innerHTML; mob.value = select.value; }
  } catch (err) { console.warn('[Devices]', err.message); }
}

setInterval(() => { if (SpotifyAPI.isLoggedIn()) loadDevices(); }, 120000);

// Poll player state every 15s — local SDK
setInterval(async () => {
  if (!State.player || !State.isPlaying) return;
  try { const s = await State.player.getCurrentState(); if (s) { State.position = s.position; State.duration = s.duration; } } catch {}
}, 15000);

// ── NOW PLAYING ───────────────────────────────────────────────────────────────
function renderNowPlaying(track) {
  document.getElementById('player-idle').classList.add('hidden');
  document.getElementById('now-playing').classList.remove('hidden');

  const artEl = document.getElementById('album-art');
  artEl.classList.add('changing');
  setTimeout(() => { artEl.src = track.albumArt || ''; artEl.classList.remove('changing'); updateBackground(track.albumArt); }, 200);

  document.getElementById('track-name').textContent   = document.getElementById('track-name').title   = track.name;
  document.getElementById('track-artist').textContent = document.getElementById('track-artist').title = track.artist;
  document.getElementById('track-album').textContent  = document.getElementById('track-album').title  = track.album;

  document.getElementById('fs-art').src      = track.albumArt || '';
  document.getElementById('fs-track').textContent  = track.name;
  document.getElementById('fs-artist').textContent = track.artist;
  document.getElementById('fs-bg').style.backgroundImage = cssUrl(track.albumArt);
  document.title = `${track.name} · ${track.artist} — Music Shuffle`;
}

function updateBackground(imageUrl) {
  if (!imageUrl) return;
  const bg = document.getElementById('bg-blur');
  bg.style.backgroundImage = cssUrl(imageUrl);
  bg.classList.add('active');
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 4;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 4, 4);
      const d = ctx.getImageData(0, 0, 4, 4).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
      const n = d.length / 4;
      document.documentElement.style.setProperty('--accent-shadow', `rgba(${Math.round(r/n)},${Math.round(g/n)},${Math.round(b/n)},0.6)`);
    } catch {}
  };
  img.src = imageUrl;
}

// ── MEDIA SESSION ─────────────────────────────────────────────────────────────
// ── STUMMER AUDIO-ANKER ───────────────────────────────────────────────────────
// Die Musik läuft im iframe des Spotify-SDK. Chrome/Edge leiten die Medientasten
// an den Frame mit laufendem Player — ohne eigenen Player auf unserer Seite kommen
// Vor/Zurück nie bei uns an (Play/Pause wirken direkt aufs Audio und gingen daher
// trotzdem). Ein stummer Loop macht unsere Seite zum Ziel der Medientasten, auch
// wenn das Fenster im Hintergrund ist.
let _silentAudio = null;
function _getSilentAudio() {
  if (_silentAudio) return _silentAudio;
  // 1 Sekunde Stille als WAV (8 kHz, 16 bit, mono) — echte Stille, nicht stummgeschaltet,
  // da stummgeschaltete Player vom Browser nicht als Media-Session-Ziel gezählt werden
  const sr = 8000, n = sr, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  _silentAudio = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
  _silentAudio.loop = true;
  return _silentAudio;
}

// Hält den stummen Loop synchron zur Spotify-Wiedergabe
function syncSilentAudio(playing) {
  if (!('mediaSession' in navigator)) return;
  const a = _getSilentAudio();
  if (playing && a.paused) a.play().catch(() => { /* Autoplay vor erster Interaktion blockiert */ });
  else if (!playing && !a.paused) a.pause();
}

// Registriert unsere MediaSession-Handler. Muss NACH dem Spotify-SDK laufen,
// da dessen Web Playback SDK beim Abspielen eigene (im Dev-Mode leere) nexttrack/
// previoustrack-Handler setzt und unsere dabei überschreibt. Deshalb rufen wir
// das bei jedem Track-Wechsel erneut auf (aus updateMediaSession), nicht nur beim Boot.
function registerMediaSessionHandlers() {
  if (!('mediaSession' in navigator)) return;
  const set = (action, handler) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Action nicht unterstützt */ }
  };
  set('play',          () => State.player?.resume());
  set('pause',         () => State.player?.pause());
  set('nexttrack',     () => playNextFromQueue());
  set('previoustrack', () => playPrevFromHistory());
  set('stop',          () => State.player?.pause());
  set('seekto', (d) => { if (d.seekTime != null) SpotifyAPI.seek(Math.round(d.seekTime * 1000), State.deviceId).catch(()=>{}); });
  set('seekforward',  (d) => { const s = (d.seekOffset || 10) * 1000; SpotifyAPI.seek(Math.min(State.duration, State.position + s), State.deviceId).catch(()=>{}); });
  set('seekbackward', (d) => { const s = (d.seekOffset || 10) * 1000; SpotifyAPI.seek(Math.max(0, State.position - s), State.deviceId).catch(()=>{}); });
}

function setupMediaSession() {
  registerMediaSessionHandlers();
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.name, artist: track.artist, album: track.album,
    artwork: track.albumArt ? [{ src: track.albumArt, sizes: '640x640', type: 'image/jpeg' }] : [],
  });
  navigator.mediaSession.playbackState = State.isPlaying ? 'playing' : 'paused';
  // Position melden — ohne das deaktiviert Chrome teils die Skip-Tasten
  try {
    const dur = (State.duration || track.duration || 0) / 1000;
    const pos = Math.min((State.position || 0) / 1000, dur);
    if (dur > 0) {
      navigator.mediaSession.setPositionState({ duration: dur, playbackRate: 1, position: pos });
    }
  } catch { /* setPositionState nicht unterstützt */ }
  // Unsere Handler erneut setzen — überschreibt die (leeren) Handler des Spotify-SDK,
  // das sie bei jedem Track-Wechsel neu registriert. Kurz verzögert, um sicher nach
  // dem SDK dran zu sein.
  registerMediaSessionHandlers();
  setTimeout(registerMediaSessionHandlers, 500);
}

// ── MINI PLAYER ───────────────────────────────────────────────────────────────
function updateMiniPlayer(track) {
  if (!track) return;
  document.getElementById('mini-player')?.classList.remove('hidden');
  const art = document.getElementById('mini-art');
  if (art) art.src = track.albumArt || '';
  const te = document.getElementById('mini-track');   if (te) te.textContent = track.name;
  const ae = document.getElementById('mini-artist'); if (ae) ae.textContent = track.artist;
}

function updateMiniPlayerPlayPause() {
  document.getElementById('mini-play-icon') ?.classList.toggle('hidden',  State.isPlaying);
  document.getElementById('mini-pause-icon')?.classList.toggle('hidden', !State.isPlaying);
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
let _notificationsEnabled = false;

function updateNotificationBtn() {
  const btn = document.getElementById('notification-btn');
  if (!btn || !('Notification' in window)) { if (btn) btn.style.display = 'none'; return; }
  if (Notification.permission === 'granted') { _notificationsEnabled = true; btn.classList.add('active'); btn.title = I18N.t('msg_notifications_active'); }
  else if (Notification.permission === 'denied') { btn.style.opacity = '0.3'; }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { _notificationsEnabled = true; return true; }
  if (Notification.permission !== 'denied') {
    _notificationsEnabled = await Notification.requestPermission() === 'granted';
    return _notificationsEnabled;
  }
  return false;
}

function showTrackNotification(track) {
  if (!_notificationsEnabled || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  const n = new Notification(track.name, {
    body: `${track.artist} — ${track.album}`,
    icon: track.albumArt || '/music-shuffle/icons/icon-192.png',
    tag: 'music-shuffle-track', silent: true,
  });
  n.onclick = () => { window.focus(); n.close(); };
  setTimeout(() => n.close(), 5000);
}

// ── PLAYBACK UI ───────────────────────────────────────────────────────────────
function updatePlayPauseUI() {
  document.getElementById('play-icon') ?.classList.toggle('hidden',  State.isPlaying);
  document.getElementById('pause-icon')?.classList.toggle('hidden', !State.isPlaying);
  document.getElementById('fs-play-icon') ?.classList.toggle('hidden',  State.isPlaying);
  document.getElementById('fs-pause-icon')?.classList.toggle('hidden', !State.isPlaying);
}

// ── PROGRESS ──────────────────────────────────────────────────────────────────
let _progressTimer = null;

function startProgressTimer() {
  clearInterval(_progressTimer);
  _progressTimer = setInterval(() => {
    if (!State.isPlaying) return;
    State.position = Math.min(State.position + 1000, State.duration);
    updateProgressUI();
  }, 1000);
}

function updateProgressUI() {
  const pct = State.duration ? (State.position / State.duration) * 100 : 0;
  document.getElementById('progress-fill').style.width  = `${pct}%`;
  document.getElementById('progress-thumb').style.left  = `${pct}%`;
  document.getElementById('time-current').textContent   = msToTime(State.position);
  document.getElementById('time-total').textContent     = msToTime(State.duration);
}

// ── FULLSCREEN ────────────────────────────────────────────────────────────────
function toggleFullscreen() { document.getElementById('fullscreen-overlay').classList.toggle('hidden'); }

// ── VOLUME ────────────────────────────────────────────────────────────────────
function setVolume(vol) {
  State.volume = Math.max(0, Math.min(100, vol));
  document.getElementById('volume-slider').value = State.volume;
  State.player?.setVolume(State.volume / 100).catch(() => {});
  localStorage.setItem('as_volume', State.volume);
  const muted = State.isMuted || State.volume === 0;
  document.getElementById('vol-icon') ?.classList.toggle('hidden',  muted);
  document.getElementById('mute-icon')?.classList.toggle('hidden', !muted);
}

function toggleMute() {
  if (State.isMuted) { State.isMuted = false; setVolume(State.prevVolume || 80); }
  else {
    State.prevVolume = State.volume; State.isMuted = true;
    State.player?.setVolume(0).catch(() => {});
    document.getElementById('vol-icon') ?.classList.add('hidden');
    document.getElementById('mute-icon')?.classList.remove('hidden');
  }
}
