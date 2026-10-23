/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/core.js
   Zustand, Speicher, Validierung und Hilfsfunktionen — wird zuerst geladen
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── VERSION ───────────────────────────────────────────────────────────────────
const APP_VERSION = '1.6.4';

// ── STATE ─────────────────────────────────────────────────────────────────────
const State = {
  user: null,
  lists: [],
  activeListId: null,
  currentTrack: null,
  isPlaying: false,
  volume: 80,
  isMuted: false,
  prevVolume: 80,
  repeatMode: false,
  position: 0,
  duration: 0,
  queue: [],
  history: [],
  historyIds: new Set(),
  blacklist: [],
  blacklistEnabled: true,
  player: null,
  deviceId: null,
  activeDeviceId: null,
  stats: { plays: [], shuffles: 0 },
  onlyNew: false,
  autoSkip: false,
  autoSkipMin: 60,
  crossfade: false,
  _crossfading: false,
  _autoNextPending: false,
  smartShuffle: true,
  shuffleLog: [],
  artistTrackHistory: {}, // { artistId: [trackId, trackId, ...] }
  theme: null, // null = system default, 'light', 'dark'
  _lastTrack: null, // letzter bekannter Track für Wiederherstellung
  roundRobin: false,      // Round-Robin Modus: je ein Song pro Artist reihum
  _rrQueue: [],           // gemischte Artist-Reihenfolge für aktuellen Durchlauf
  _rrIndex: 0,            // aktueller Index in _rrQueue
  _artistCooldown: [],    // [ {artistId, remaining} ] — gesperrte Artists nach RR-Deaktivierung
  _ownDeviceIds: [],      // alle Geräte-IDs, die unser Web-Player in dieser Sitzung hatte
};

// ── LOCAL STORAGE ─────────────────────────────────────────────────────────────
const LS = {
  _syncTimer: null,
  _statsSyncTimer: null,
  _blacklistSyncTimer: null,
  _trackHistorySyncTimer: null,
  save() {
    localStorage.setItem('as_lists',         JSON.stringify(State.lists));
    localStorage.setItem('as_blacklist',     JSON.stringify(State.blacklist));
    localStorage.setItem('as_stats',         JSON.stringify(State.stats));
    localStorage.setItem('as_volume',        State.volume);
    localStorage.setItem('as_active_list',   State.activeListId || '');
    localStorage.setItem('as_track_history', JSON.stringify(State.artistTrackHistory));
    clearTimeout(this._syncTimer);
    this._syncTimer = setTimeout(() => Sync.save(), 10000);
  },
  saveBlacklistDebounced() {
    localStorage.setItem('as_blacklist', JSON.stringify(State.blacklist));
    clearTimeout(this._blacklistSyncTimer);
    this._blacklistSyncTimer = setTimeout(() => Sync.saveBlacklist(), 10000);
  },
  saveStatsDebounced() {
    localStorage.setItem('as_stats',         JSON.stringify(State.stats));
    localStorage.setItem('as_track_history', JSON.stringify(State.artistTrackHistory));
    clearTimeout(this._statsSyncTimer);
    this._statsSyncTimer = setTimeout(() => Sync.saveStats(), 30000);
  },
  saveTrackHistoryDebounced() {
    localStorage.setItem('as_track_history', JSON.stringify(State.artistTrackHistory));
    clearTimeout(this._trackHistorySyncTimer);
    this._trackHistorySyncTimer = setTimeout(() => Sync.saveTrackHistory(), 30000);
  },
  load() {
    try { State.lists     = JSON.parse(localStorage.getItem('as_lists')     || '[]'); } catch { State.lists = []; }
    try { State.blacklist = JSON.parse(localStorage.getItem('as_blacklist') || '[]'); } catch { State.blacklist = []; }
    try { State.stats = { plays:[], shuffles:0, ...JSON.parse(localStorage.getItem('as_stats') || '{}') }; } catch {}
    State.volume          = parseInt(localStorage.getItem('as_volume') || '80', 10);
    try { State.artistTrackHistory = JSON.parse(localStorage.getItem('as_track_history') || '{}'); } catch { State.artistTrackHistory = {}; }
    try { State._lastTrack = JSON.parse(localStorage.getItem('as_last_track') || 'null'); } catch { State._lastTrack = null; }
    State.activeListId    = localStorage.getItem('as_active_list') || null;
    State.blacklistEnabled = localStorage.getItem('as_blacklist_enabled') !== 'false';
    // Migration + Validierung
    if (!Array.isArray(State.lists)) State.lists = [];
    State.lists = State.lists.map(normalizeList).filter(Boolean);
    if (!Array.isArray(State.blacklist)) State.blacklist = [];
  },
};

// ── DATEN-VALIDIERUNG ─────────────────────────────────────────────────────────
// Listen kommen aus localStorage, vom Sync-Server und aus importierten Dateien.
// Alles wird auf die bekannte Struktur gebracht — kaputte oder manipulierte
// Einträge können so weder die Oberfläche crashen noch Code einschleusen.
const isSpotifyId = id => typeof id === 'string' && /^[A-Za-z0-9]{1,64}$/.test(id);
const _str = (v, max = 200) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
const _images = imgs => (Array.isArray(imgs) ? imgs : [])
  .filter(i => i && typeof i.url === 'string').slice(0, 4)
  .map(i => ({ url: _str(i.url, 500), width: Number(i.width) || undefined, height: Number(i.height) || undefined }));

function normalizeList(l) {
  if (!l || typeof l !== 'object') return null;
  const year = v => { const n = parseInt(v, 10); return n >= 1900 && n <= 2100 ? n : null; };
  const f = { ...defaultFilters(), ...(l.filters && typeof l.filters === 'object' ? l.filters : {}) };
  const filters = {
    noLive: !!f.noLive, noInstrumental: !!f.noInstrumental, noAcoustic: !!f.noAcoustic,
    noOrchestral: !!f.noOrchestral, noCommentary: !!f.noCommentary, noRepeat: f.noRepeat !== false,
    artistRepeatLimit: Math.min(50, Math.max(1, parseInt(f.artistRepeatLimit, 10) || 3)),
    yearFrom: year(f.yearFrom), yearTo: year(f.yearTo),
  };
  return {
    id: _str(l.id, 64) || ('l' + Date.now() + Math.random().toString(36).slice(2, 6)),
    name: _str(l.name, 100) || 'Liste',
    artists: (Array.isArray(l.artists) ? l.artists : []).filter(a => a && isSpotifyId(a.id)).map(a => ({
      id: a.id, name: _str(a.name), images: _images(a.images),
      genres: (Array.isArray(a.genres) ? a.genres : []).map(g => _str(g, 60)).slice(0, 10),
      uri: `spotify:artist:${a.id}`, ...(a.favorite ? { favorite: true } : {}),
    })),
    albums: (Array.isArray(l.albums) ? l.albums : []).filter(a => a && isSpotifyId(a.id)).map(a => ({
      id: a.id, name: _str(a.name), artistId: isSpotifyId(a.artistId) ? a.artistId : undefined,
      artistName: _str(a.artistName), images: _images(a.images),
      release_date: _str(a.release_date, 10), album_type: _str(a.album_type, 20),
    })),
    genres: (Array.isArray(l.genres) ? l.genres : []).map(g => _str(g, 60)).filter(Boolean),
    filters,
  };
}

function defaultFilters() { return { noLive: false, noInstrumental: false, noAcoustic: false, noOrchestral: false, noCommentary: false, artistRepeatLimit: 3, noRepeat: true, yearFrom: null, yearTo: null }; }

// Platzhalterbild für Künstler ohne (funktionierendes) Bild
const ARTIST_FALLBACK_IMG = "data:image/svg+xml,%3Csvg viewBox='0 0 60 60' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='30' fill='%23282828'/%3E%3Ccircle cx='30' cy='24' r='10' fill='%23444'/%3E%3Cellipse cx='30' cy='50' rx='18' ry='12' fill='%23444'/%3E%3C/svg%3E";


// ── TOAST ──────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 400); }, 3000);
}

// ── UTILS ──────────────────────────────────────────────────────────────────────
function msToTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

// Nur echte Bild-URLs zulassen (Spotify-CDN ist https). Verhindert, dass manipulierte
// Listen-/Sync-Daten über src="…" oder url(…) Code einschleusen.
function _validImageUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  if (url === ARTIST_FALLBACK_IMG) return url;
  try {
    const u = new URL(url, location.href);
    return (u.protocol === 'https:' || u.origin === location.origin) ? u.href : '';
  } catch { return ''; }
}
function safeUrl(url) { return escHtml(_validImageUrl(url)); }        // für HTML-Attribute
function cssUrl(url) {                                                  // für style.backgroundImage
  const u = _validImageUrl(url);
  return u ? `url("${u.replace(/["\\\n]/g, encodeURIComponent)}")` : 'none';
}

// Kaputte Bilder (z.B. abgelaufene Cover-URLs): Platzhalter statt Broken-Icon.
// Ein globaler Listener ersetzt die früheren inline onerror-Attribute (CSP-tauglich).
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.failed) return;
  img.dataset.failed = '1';
  if (img.classList.contains('artist-card-img')) img.src = ARTIST_FALLBACK_IMG;
  else img.style.background = '#282828';
}, true);

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
