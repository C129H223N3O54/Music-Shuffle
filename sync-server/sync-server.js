/**
 * Music Shuffle — Sync Server  (v1.6.0)
 * Einfacher REST-Server zum geräteübergreifenden Speichern von Listen,
 * Stats, Blacklist, Track-History sowie Album-/Track-Cache.
 * Läuft als Docker Container auf der Synology NAS.
 *
 * v1.5.2:
 *  - Atomare Schreibvorgänge (tmp-Datei + rename) — ein Absturz/Neustart mitten
 *    im Schreiben kann keine halbe, unlesbare JSON-Datei mehr hinterlassen.
 *  - Album-/Track-Cache werden im Speicher gehalten, abgelaufene Einträge (>24h)
 *    entfernt, Track-Daten auf die nötigen Felder reduziert und kompakt gespeichert.
 *  - POST /api/track-history lehnt history:null ab.
 *  - Health-Check zeigt zusätzlich Cache- und History-Zähler.
 *
 * v1.6.0 — Sicherheit:
 *  - Anmeldung: Die App schickt ihr Spotify-Access-Token mit. Der Server fragt
 *    bei Spotify nach (/v1/me), wem es gehört, und lässt nur die Spotify-User aus
 *    ALLOWED_USERS rein. Kein eigenes Passwort, nichts Geheimes in config.js.
 *    Ohne ALLOWED_USERS läuft der Server wie bisher offen (mit Warnung im Log).
 *  - CORS nur noch für ALLOWED_ORIGINS (Standard: alle — bitte setzen).
 *  - IDs werden geprüft, Sicherheits-Header gesetzt, Health ohne Anmeldung
 *    nur noch mit Status/Version.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const DATA_FILE       = process.env.DATA_FILE       || '/data/lists.json';
const STATS_FILE      = process.env.STATS_FILE      || '/data/stats.json';
const CACHE_FILE      = process.env.CACHE_FILE      || '/data/cache.json';
const BLACKLIST_FILE  = process.env.BLACKLIST_FILE  || '/data/blacklist.json';
const TRACKS_FILE     = process.env.TRACKS_FILE     || '/data/tracks.json';
const HISTORY_FILE    = process.env.HISTORY_FILE    || '/data/track-history.json';

const VERSION = '1.6.0';

// ── SICHERHEIT ───────────────────────────────────────────
// ALLOWED_USERS:   Spotify-User-IDs, kommagetrennt (z.B. "kampfmade")
// ALLOWED_ORIGINS: erlaubte App-Adressen für CORS, kommagetrennt
//                  (z.B. "https://shuffle.jem.rocks:8443") — Standard "*"
const ALLOWED_USERS   = (process.env.ALLOWED_USERS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '*').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);
const SPOTIFY_ME_URL  = process.env.SPOTIFY_ME_URL || 'https://api.spotify.com/v1/me'; // für Tests überschreibbar
const AUTH_ENABLED    = ALLOWED_USERS.length > 0;

const CACHE_TTL     = 24 * 60 * 60 * 1000;   // wie im Client
const MAX_BODY      = 20 * 1024 * 1024;      // 20 MB
const CACHE_FLUSH_MS = 2000;                 // Cache-Schreibvorgänge bündeln

// ── DATEI-HELFER ─────────────────────────────────────────
function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[Sync] Fehler beim Laden von ${path.basename(file)}:`, err.message);
  }
  return fallback();
}

// Atomar: erst in tmp-Datei schreiben, dann umbenennen (rename ist atomar).
function writeJSON(file, data, pretty = true) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    data.updatedAt = new Date().toISOString();
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), 'utf8');
    fs.renameSync(tmp, file);
    return true;
  } catch (err) {
    console.error(`[Sync] Fehler beim Speichern von ${path.basename(file)}:`, err.message);
    return false;
  }
}

const loadData      = () => readJSON(DATA_FILE,      () => ({ lists: [], updatedAt: null }));
const saveData      = d  => writeJSON(DATA_FILE, d);
const loadStats     = () => readJSON(STATS_FILE,     () => ({ plays: [], shuffles: 0, updatedAt: null }));
const saveStats     = d  => writeJSON(STATS_FILE, d, false);
const loadBlacklist = () => readJSON(BLACKLIST_FILE, () => ({ blacklist: [], updatedAt: null }));
const saveBlacklist = d  => writeJSON(BLACKLIST_FILE, d);
const loadHistory   = () => readJSON(HISTORY_FILE,   () => ({ history: {}, updatedAt: null }));
const saveHistory   = d  => writeJSON(HISTORY_FILE, d, false);

// ── SLIM (nur Felder, die die App nutzt) ─────────────────
const slimImages = imgs => (Array.isArray(imgs) ? imgs : []).map(i => ({ url: i?.url, width: i?.width, height: i?.height }));

function slimAlbum(a) {
  if (!a || typeof a !== 'object') return a;
  return { id: a.id, name: a.name, album_type: a.album_type, release_date: a.release_date,
    total_tracks: a.total_tracks, images: slimImages(a.images) };
}

function slimTrack(t) {
  if (!t || typeof t !== 'object') return t;
  return {
    id: t.id, name: t.name, uri: t.uri, duration_ms: t.duration_ms,
    track_number: t.track_number, disc_number: t.disc_number,
    artists: (t.artists || []).map(a => ({ id: a?.id, name: a?.name })),
    albumArt: t.albumArt || '',
    album: t.album ? { id: t.album.id, name: t.album.name, release_date: t.album.release_date,
      album_type: t.album.album_type, images: slimImages(t.album.images) } : undefined,
  };
}

// ── CACHE-STORES (im Speicher, gebündelt + kompakt geschrieben) ──
function createCacheStore(file, field, slim) {
  const loaded = readJSON(file, () => ({ cache: {}, updatedAt: null }));
  const store = { cache: {}, updatedAt: loaded.updatedAt };
  let timer = null;

  function prune() {
    const now = Date.now();
    let removed = 0;
    for (const [k, v] of Object.entries(store.cache)) {
      if (!v || !v.ts || now - v.ts > CACHE_TTL || !Array.isArray(v[field])) { delete store.cache[k]; removed++; }
    }
    return removed;
  }
  function flush() {
    clearTimeout(timer); timer = null;
    prune();
    return writeJSON(file, store, false);
  }
  function scheduleFlush() {
    if (!timer) timer = setTimeout(flush, CACHE_FLUSH_MS);
  }

  // Beim Start: bestehende Einträge verschlanken + Abgelaufenes entfernen
  for (const [k, v] of Object.entries(loaded.cache || {})) {
    if (v && Array.isArray(v[field])) store.cache[k] = { [field]: v[field].map(slim), ts: v.ts };
  }
  const removed = prune();
  if (Object.keys(loaded.cache || {}).length) flush();
  console.log(`[Sync] ${path.basename(file)}: ${Object.keys(store.cache).length} Einträge geladen, ${removed} abgelaufene entfernt`);

  return {
    get data() { prune(); return store; },
    get size() { return Object.keys(store.cache).length; },
    set(key, items, ts) {
      store.cache[key] = { [field]: items.map(slim), ts: Number(ts) || Date.now() };
      scheduleFlush();
    },
    flush,
  };
}

const albumCache = createCacheStore(CACHE_FILE,  'albums', slimAlbum);
const trackCache = createCacheStore(TRACKS_FILE, 'tracks', slimTrack);

// ── HTTP HELPERS ──────────────────────────────────────────
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'cross-origin',
};

function corsHeaders(req) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  };
  const origin = (req.headers.origin || '').replace(/\/+$/, '');
  if (ALLOWED_ORIGINS.includes('*')) h['Access-Control-Allow-Origin'] = '*';
  else if (origin && ALLOWED_ORIGINS.includes(origin)) { h['Access-Control-Allow-Origin'] = origin; h.Vary = 'Origin'; }
  return h;
}

function sendJSON(req, res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { ...SECURITY_HEADERS, ...corsHeaders(req), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error('Body too large')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isSpotifyId   = v => typeof v === 'string' && /^[A-Za-z0-9]{1,64}$/.test(v);

// ── ANMELDUNG ÜBER SPOTIFY ────────────────────────────────
// Token → Spotify-User wird 10 min gemerkt (ungültige Tokens 1 min), damit nicht
// jeder Request bei Spotify nachfragt. Höchstens 30 Prüfungen pro Minute —
// sonst könnte man den Server als Verstärker gegen Spotify missbrauchen.
const crypto = require('crypto');
const _authCache = new Map();
let _verifyWindow = { start: 0, count: 0 };

async function verifySpotifyToken(token) {
  const key = crypto.createHash('sha256').update(token).digest('hex');
  const hit = _authCache.get(key);
  if (hit && hit.exp > Date.now()) return hit;

  const now = Date.now();
  if (now - _verifyWindow.start > 60000) _verifyWindow = { start: now, count: 0 };
  if (++_verifyWindow.count > 30) return { status: 429 };

  let result;
  try {
    const r = await fetch(SPOTIFY_ME_URL, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const me = await r.json();
      const user = String(me.id || '').toLowerCase();
      result = { user, status: ALLOWED_USERS.includes(user) ? 200 : 403, exp: now + 10 * 60000 };
    } else if (r.status === 401) {
      result = { status: 401, exp: now + 60000 };
    } else {
      return { status: 503 }; // Spotify gestört → nicht cachen
    }
  } catch { return { status: 503 }; }

  if (_authCache.size > 500) _authCache.delete(_authCache.keys().next().value);
  _authCache.set(key, result);
  return result;
}

async function authenticate(req) {
  if (!AUTH_ENABLED) return { status: 200, user: null };
  const m = /^Bearer\s+([A-Za-z0-9._~+\/=-]{20,2048})$/.exec(req.headers.authorization || '');
  if (!m) return { status: 401 };
  return verifySpotifyToken(m[1]);
}

const AUTH_ERRORS = {
  401: 'Nicht angemeldet — Spotify-Token fehlt oder ist abgelaufen',
  403: 'Dieser Spotify-Account ist nicht freigeschaltet (ALLOWED_USERS)',
  429: 'Zu viele Anmeldeversuche — bitte kurz warten',
  503: 'Spotify zur Prüfung der Anmeldung nicht erreichbar',
};

// ── SERVER ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  let pathname;
  try { pathname = new URL(req.url, 'http://localhost').pathname; }
  catch { res.writeHead(400, SECURITY_HEADERS); res.end(); return; } // kaputte URL darf den Server nicht abschießen

  if (pathname !== '/api/health') console.log(`[Sync] ${req.method} ${pathname}`);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { ...SECURITY_HEADERS, ...corsHeaders(req) });
    res.end();
    return;
  }

  try {
    const auth = await authenticate(req);

    // ── Health: ohne Anmeldung nur Status/Version, mit Anmeldung alle Zähler
    if (req.method === 'GET' && pathname === '/api/health') {
      if (auth.status !== 200) return sendJSON(req, res, 200, { status: 'ok', version: VERSION, auth: AUTH_ENABLED ? 'on' : 'off' });
      const data      = loadData();
      const stats     = loadStats();
      const blacklist = loadBlacklist();
      const history   = loadHistory();
      return sendJSON(req, res, 200, {
        status: 'ok',
        version: VERSION,
        auth:         AUTH_ENABLED ? 'on' : 'off',
        lists:        data.lists?.length || 0,
        plays:        stats.plays?.length || 0,
        blacklist:    blacklist.blacklist?.length || 0,
        trackHistory: Object.keys(history.history || {}).length,
        albumCache:   albumCache.size,
        trackCache:   trackCache.size,
        updatedAt:    data.updatedAt,
      });
    }

    // ── Alles andere nur mit gültiger Anmeldung
    if (pathname.startsWith('/api/') && auth.status !== 200) {
      return sendJSON(req, res, auth.status, { error: AUTH_ERRORS[auth.status] || 'Nicht erlaubt' });
    }

    // ── Listen
    if (pathname === '/api/lists') {
      if (req.method === 'GET') return sendJSON(req, res, 200, loadData());
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!Array.isArray(body.lists)) return sendJSON(req, res, 400, { error: 'Invalid data — lists array required' });
        const ok = saveData({ lists: body.lists });
        return sendJSON(req, res, ok ? 200 : 500, ok ? { success: true, count: body.lists.length } : { error: 'Speichern fehlgeschlagen' });
      }
      if (req.method === 'DELETE') return sendJSON(req, res, 200, { success: saveData({ lists: [] }) });
    }

    // ── Stats
    if (pathname === '/api/stats') {
      if (req.method === 'GET') return sendJSON(req, res, 200, loadStats());
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!Array.isArray(body.plays) || typeof body.shuffles !== 'number') {
          return sendJSON(req, res, 400, { error: 'Invalid data — plays array and shuffles number required' });
        }
        const ok = saveStats({ plays: body.plays, shuffles: body.shuffles });
        return sendJSON(req, res, ok ? 200 : 500, ok ? { success: true, plays: body.plays.length } : { error: 'Speichern fehlgeschlagen' });
      }
    }

    // ── Album-Cache
    if (pathname === '/api/cache') {
      if (req.method === 'GET') return sendJSON(req, res, 200, albumCache.data);
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!isSpotifyId(body.artistId) || !Array.isArray(body.albums)) return sendJSON(req, res, 400, { error: 'Invalid data — artistId and albums required' });
        // Leere Listen sind fast immer ein fehlgeschlagener Abruf → nicht speichern
        if (!body.albums.length) return sendJSON(req, res, 200, { success: true, skipped: 'empty' });
        albumCache.set(body.artistId, body.albums, body.ts);
        return sendJSON(req, res, 200, { success: true });
      }
    }

    // ── Track-Cache
    if (pathname === '/api/tracks') {
      if (req.method === 'GET') return sendJSON(req, res, 200, trackCache.data);
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!isSpotifyId(body.albumId) || !Array.isArray(body.tracks)) return sendJSON(req, res, 400, { error: 'Invalid data — albumId and tracks required' });
        if (!body.tracks.length) return sendJSON(req, res, 200, { success: true, skipped: 'empty' });
        trackCache.set(body.albumId, body.tracks, body.ts);
        return sendJSON(req, res, 200, { success: true });
      }
    }

    // ── Track-History (Sperre pro Artist)
    if (pathname === '/api/track-history') {
      if (req.method === 'GET') return sendJSON(req, res, 200, loadHistory());
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!isPlainObject(body.history)) return sendJSON(req, res, 400, { error: 'Invalid data — history object required' });
        // Nur gültige Einträge { artistId: [trackIds] } übernehmen
        const history = {};
        for (const [k, v] of Object.entries(body.history)) {
          if (isSpotifyId(k) && Array.isArray(v)) history[k] = v.filter(isSpotifyId);
        }
        const ok = saveHistory({ history });
        return sendJSON(req, res, ok ? 200 : 500, { success: ok });
      }
    }

    // ── Blacklist
    if (pathname === '/api/blacklist') {
      if (req.method === 'GET') return sendJSON(req, res, 200, loadBlacklist());
      if (req.method === 'POST') {
        const body = await readBody(req);
        if (!Array.isArray(body.blacklist)) return sendJSON(req, res, 400, { error: 'Invalid data — blacklist array required' });
        const ok = saveBlacklist({ blacklist: body.blacklist });
        return sendJSON(req, res, ok ? 200 : 500, ok ? { success: true, count: body.blacklist.length } : { error: 'Speichern fehlgeschlagen' });
      }
    }

    sendJSON(req, res, 404, { error: 'Not found' });
  } catch (err) {
    sendJSON(req, res, err.message === 'Body too large' ? 413 : 400, { error: err.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Sync] Music Shuffle Sync-Server läuft auf Port ${PORT}`);
  console.log(`[Sync] Datei: ${DATA_FILE}`);
  console.log(`[Sync] Health: http://localhost:${PORT}/api/health`);
  if (AUTH_ENABLED) console.log(`[Sync] Anmeldung aktiv — erlaubte Spotify-User: ${ALLOWED_USERS.join(', ')}`);
  else console.warn('[Sync] ⚠ WARNUNG: ALLOWED_USERS nicht gesetzt — jeder, der die URL kennt, kann Daten lesen, ändern und löschen!');
  if (ALLOWED_ORIGINS.includes('*')) console.warn('[Sync] ⚠ ALLOWED_ORIGINS nicht gesetzt — CORS für alle Webseiten offen');
});

// Letzte Sicherung: ein unerwarteter Fehler in einem Request beendet nicht den ganzen Server
process.on('unhandledRejection', err => console.error('[Sync] Unerwarteter Fehler:', err?.message || err));

function shutdown() {
  console.log('[Sync] Stopping...');
  albumCache.flush();
  trackCache.flush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
