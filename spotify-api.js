/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — spotify-api.js
   Spotify Web API Wrapper + OAuth PKCE Flow
   ═══════════════════════════════════════════════════════ */

'use strict';

const SpotifyAPI = (() => {

  const SCOPES = [
    'user-read-playback-state', 'user-modify-playback-state',
    'streaming', 'user-read-email', 'user-read-private',
    // Für „Playlist aus Verlauf" (v1.5.2) — bestehende Logins brauchen einmal Ab-/Anmelden
    'playlist-modify-private', 'playlist-modify-public',
  ].join(' ');

  const BASE        = 'https://api.spotify.com/v1';
  const AUTH_URL    = 'https://accounts.spotify.com/authorize';
  const TOKEN_URL   = 'https://accounts.spotify.com/api/token';
  const STORAGE_KEY = 'spotify_auth';
  const CACHE_TTL   = 24 * 60 * 60 * 1000;
  const MIN_INTERVAL = 1000;

  let _accessToken = null, _tokenExpiry = 0, _refreshToken = null;
  let _clientId = null, _redirectUri = null, _lastRequest = 0;
  let _userMarket = localStorage.getItem('as_market') || 'DE'; // Fallback DE
  const _albumCache = new Map();
  const _trackCache = new Map(); // albumId → { tracks: [...], ts }

  // ── PKCE ──────────────────────────────────────────────
  function _randomString(len = 64) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => chars[b % chars.length]).join('');
  }

  function _base64url(buf) {
    let s = '';
    new Uint8Array(buf).forEach(b => s += String.fromCharCode(b));
    return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
  }

  async function _pkce() {
    const verifier  = _randomString(64);
    const challenge = _base64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    return { verifier, challenge };
  }

  // ── AUTH ──────────────────────────────────────────────
  function init(clientId, redirectUri) {
    _clientId = clientId; _redirectUri = redirectUri;
    const s = _loadAuth();
    if (s) { _accessToken = s.accessToken; _tokenExpiry = s.tokenExpiry; _refreshToken = s.refreshToken; }
  }

  async function startLogin() {
    if (!_clientId) throw new Error('Client ID not set');
    const { verifier, challenge } = await _pkce();
    const state = _randomString(16);
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('pkce_state', state);
    const p = new URLSearchParams({ client_id: _clientId, response_type: 'code', redirect_uri: _redirectUri,
      scope: SCOPES, state, code_challenge_method: 'S256', code_challenge: challenge });
    window.location.href = `${AUTH_URL}?${p}`;
  }

  async function handleCallback() {
    const p = new URLSearchParams(window.location.search);
    const code = p.get('code'), state = p.get('state'), error = p.get('error');
    if (error) throw new Error(`Spotify auth error: ${error}`);
    if (!code) return false;
    if (state !== sessionStorage.getItem('pkce_state')) throw new Error('State mismatch');
    const verifier = sessionStorage.getItem('pkce_verifier');
    if (!verifier) throw new Error('No PKCE verifier');
    const res = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code,
        redirect_uri: _redirectUri, client_id: _clientId, code_verifier: verifier }).toString(),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(`Token exchange: ${e.error_description||e.error}`); }
    _storeTokens(await res.json());
    sessionStorage.removeItem('pkce_verifier'); sessionStorage.removeItem('pkce_state');
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }

  // Laufenden Refresh teilen: Spotify rotiert den Refresh-Token. Zwei parallele
  // Refreshes (z.B. SDK getOAuthToken + App-Request) → der zweite schickt den
  // bereits verbrauchten Token → invalid_grant → ungewollter Logout.
  let _refreshPromise = null;
  function _refreshAccessToken() {
    if (!_refreshPromise) {
      _refreshPromise = _doRefresh().finally(() => { _refreshPromise = null; });
    }
    return _refreshPromise;
  }

  async function _doRefresh() {
    if (!_refreshToken) throw new Error('No refresh token');
    const res = await fetch(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: _refreshToken, client_id: _clientId }).toString(),
    });
    if (!res.ok) {
      // invalid_grant = Refresh-Token abgelaufen (ab Juli 2026: nach 6 Monaten).
      // Token verwerfen, KEIN Retry, User muss sich neu einloggen.
      const err = await res.json().catch(() => ({}));
      _clearAuth();
      if (err.error === 'invalid_grant') throw new Error('NOT_AUTHENTICATED');
      throw new Error('Token refresh failed');
    }
    _storeTokens(await res.json());
    return _accessToken;
  }

  function _storeTokens(d) {
    _accessToken = d.access_token;
    _tokenExpiry = Date.now() + d.expires_in * 1000 - 60000;
    if (d.refresh_token) _refreshToken = d.refresh_token;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: _accessToken, tokenExpiry: _tokenExpiry, refreshToken: _refreshToken }));
  }

  function _loadAuth() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch { return null; } }
  function _clearAuth() { _accessToken=null; _tokenExpiry=0; _refreshToken=null; localStorage.removeItem(STORAGE_KEY); }
  function logout()    { _clearAuth(); }
  function isLoggedIn(){ return !!_accessToken; }

  async function getToken() {
    if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;
    if (_refreshToken) return _refreshAccessToken();
    return null;
  }

  // ── HTTP ──────────────────────────────────────────────
  const _sleep = ms => new Promise(r => setTimeout(r, ms));

  async function _throttle() {
    const wait = MIN_INTERVAL - (Date.now() - _lastRequest);
    if (wait > 0) await _sleep(wait);
    _lastRequest = Date.now();
  }

  // Fehler mit HTTP-Status, damit die App gezielt reagieren kann (z.B. 404 = Gerät weg)
  function _httpError(status, message) {
    const e = new Error(message);
    e.status = status;
    return e;
  }

  // Spotify-IDs sind base62. Alles andere (z.B. manipulierte Listen-Daten) wird
  // abgelehnt, bevor es in einer API-URL landet.
  const RE_SPOTIFY_ID = /^[A-Za-z0-9]{1,64}$/;
  function _sid(id) {
    if (typeof id !== 'string' || !RE_SPOTIFY_ID.test(id)) throw _httpError(400, 'Ungültige Spotify-ID');
    return id;
  }

  async function _fetch(endpoint, options = {}, retryCount = 0) {
    await _throttle();
    const token = await getToken();
    if (!token) throw new Error('NOT_AUTHENTICATED');
    const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers||{}) },
    });

    if (res.status === 401) {
      if (!retryCount) { await _refreshAccessToken(); return _fetch(endpoint, options, 1); }
      _clearAuth(); throw new Error('NOT_AUTHENTICATED');
    }
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('Retry-After')||'30', 10);
      console.warn(`[API] Rate limited, waiting ${wait}s… (attempt ${retryCount + 1}/3)`);
      await _sleep(wait * 1000);
      if (retryCount < 3) return _fetch(endpoint, options, retryCount + 1);
      throw _httpError(429, 'Rate limit exceeded — bitte später versuchen');
    }
    if (res.status === 403) {
      const d = await res.json().catch(()=>({}));
      if (d.error?.reason === 'PREMIUM_REQUIRED') throw _httpError(403, 'PREMIUM_REQUIRED');
      throw _httpError(403, `Forbidden: ${d.error?.message||res.status}`);
    }
    if (res.status === 204 || res.status === 202) return null;
    if (!res.ok) { const d = await res.json().catch(()=>({})); throw _httpError(res.status, `HTTP ${res.status}: ${JSON.stringify(d)}`); }
    return res.json();
  }

  // ── SYNC-SERVER ───────────────────────────────────────
  // Alle Requests zum Sync-Server laufen hierüber. Seit v1.6.0 schickt die App
  // ihr Spotify-Access-Token mit; der Server prüft damit, wer anfragt
  // (ALLOWED_USERS). Ohne Login → keine Sync-Requests.
  let _serverCacheUrl = null;
  function setServerCacheUrl(url) { _serverCacheUrl = url ? String(url).replace(/\/+$/, '') : null; }

  async function syncFetch(path, { method = 'GET', body, timeout = 3000, baseUrl } = {}) {
    const base = baseUrl || _serverCacheUrl;
    if (!base) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const token = await getToken().catch(() => null);
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const res = await fetch(`${base}${path}`, {
        method, headers, signal: controller.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        console.warn(`[Sync] ${method} ${path} → ${res.status} (nicht berechtigt — ALLOWED_USERS am Sync-Server prüfen)`);
        return null;
      }
      return res.ok ? await res.json() : null;
    } catch { return null; }
    finally { clearTimeout(timer); }
  }

  // ── ALBUM CACHE ───────────────────────────────────────
  // Kompletten Cache vom Server laden (einmalig beim Start)
  async function loadServerCache() {
    const data = await syncFetch('/api/cache', { timeout: 5000 });
    if (!data?.cache) return false;
    let count = 0;
    for (const [artistId, entry] of Object.entries(data.cache)) {
      // Nur laden wenn noch frisch (max 24h alt)
      if (RE_SPOTIFY_ID.test(artistId) && entry?.ts && Date.now() - entry.ts < CACHE_TTL && Array.isArray(entry.albums) && entry.albums.length) {
        _albumCache.set(artistId, { albums: entry.albums.map(_slimAlbum), ts: entry.ts });
        count++;
      }
    }
    console.log(`[Cache] Loaded ${count} artists from server`);
    return count > 0;
  }

  // Cache-Eintrag zum Server hochladen (nach Spotify-Abruf) — fire and forget
  function _pushCacheToServer(artistId, entry) {
    syncFetch('/api/cache', { method: 'POST', body: { artistId, albums: entry.albums, ts: entry.ts } });
  }

  // ── SLIM ──────────────────────────────────────────────
  // Spotify liefert pro Track/Album viele Felder, die die App nie nutzt
  // (available_markets, href, external_urls …). Die blähten tracks.json auf
  // dem Sync-Server auf ~22 KB pro Album auf. Wir speichern nur das Nötige.
  function _slimAlbum(a) {
    if (!a) return a;
    return { id: a.id, name: a.name, album_type: a.album_type, release_date: a.release_date,
      total_tracks: a.total_tracks, images: (a.images || []).map(i => ({ url: i.url, width: i.width, height: i.height })) };
  }

  function _slimTrack(t) {
    return {
      id: t.id, name: t.name, uri: t.uri, duration_ms: t.duration_ms,
      track_number: t.track_number, disc_number: t.disc_number,
      artists: (t.artists || []).map(a => ({ id: a.id, name: a.name })),
      albumArt: t.albumArt || '',
      album: t.album ? { id: t.album.id, name: t.album.name, release_date: t.album.release_date,
        album_type: t.album.album_type, images: (t.album.images || []).map(i => ({ url: i.url, width: i.width, height: i.height })) } : undefined,
    };
  }

  // ── TRACK CACHE ───────────────────────────────────────
  function _isTracksCached(albumId) {
    const c = _trackCache.get(albumId);
    return !!(c && Date.now() - c.ts < CACHE_TTL);
  }

  async function _getCachedTracks(albumId, albumData) {
    const cached = _trackCache.get(albumId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.tracks;
    if (!RE_SPOTIFY_ID.test(String(albumId))) return [];
    const data = await _fetch(`/albums/${_sid(albumId)}/tracks?limit=50&market=${_userMarket}`).catch(()=>null);
    if (!data?.items?.length) return [];
    const tracks = _enrichTracks(data.items, albumData);
    const entry = { tracks, ts: Date.now() };
    _trackCache.set(albumId, entry);
    _pushTrackCacheToServer(albumId, entry);
    return tracks;
  }

  function _pushTrackCacheToServer(albumId, entry) {
    syncFetch('/api/tracks', { method: 'POST', body: { albumId, tracks: entry.tracks, ts: entry.ts } });
  }

  async function loadServerTrackCache() {
    const data = await syncFetch('/api/tracks', { timeout: 5000 });
    if (!data?.cache) return false;
    let count = 0;
    for (const [albumId, entry] of Object.entries(data.cache)) {
      if (RE_SPOTIFY_ID.test(albumId) && entry?.ts && Date.now() - entry.ts < CACHE_TTL && Array.isArray(entry.tracks)) {
        _trackCache.set(albumId, { tracks: entry.tracks.map(_slimTrack), ts: entry.ts });
        count++;
      }
    }
    console.log(`[Cache] Loaded ${count} album track lists from server`);
    return count > 0;
  }

  async function _getCachedAlbums(artistId) {
    // 1. In-Memory Cache prüfen
    const cached = _albumCache.get(artistId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.albums;
    // 2. Spotify API abrufen
    const albums = [];
    let failed = false;
    for (let offset = 0; offset < 40; offset += 10) {
      let data = null;
      try { data = await _fetch(`/artists/${_sid(artistId)}/albums?include_groups=album,single&limit=10&offset=${offset}`); }
      catch (err) {
        if (err.message === 'NOT_AUTHENTICATED') throw err;
        failed = true; break;
      }
      const items = data?.items || [];
      albums.push(...items.map(_slimAlbum));
      if (items.length < 10) break;
    }
    // Fehlgeschlagene oder leere Abrufe NICHT cachen — sonst wäre der Artist
    // 24h lang (auch auf allen anderen Geräten über den Sync-Server) „leer".
    if (failed || !albums.length) {
      if (failed) console.warn(`[Cache] Album-Abruf für ${artistId} fehlgeschlagen — nicht gecacht`);
      return albums;
    }
    const entry = { albums, ts: Date.now() };
    _albumCache.set(artistId, entry);
    // 3. Zum Server pushen damit andere Geräte / nächster Start davon profitieren
    _pushCacheToServer(artistId, entry);
    return albums;
  }

  // ── HELPERS ───────────────────────────────────────────
  function _enrichTracks(tracks, album) {
    const albumArt = album?.images?.[0]?.url || '';
    return tracks.map(t => _slimTrack({
      ...t, albumArt,
      album: { id: album?.id, name: album?.name, release_date: album?.release_date, album_type: album?.album_type, images: album?.images || [] },
    }));
  }

  // Wortgrenzen statt includes(): „Deliverance", „Alive", „Olive" enthalten
  // „live", sind aber keine Live-Alben.
  const RE_LIVE_ALBUM  = /\b(live|concert|unplugged)\b/i;
  const RE_LIVE_TRACK  = [
    /[(\[\-–—]\s*live\b/i,                         // "Song (Live)", "Song - Live at …"
    /\blive\s+(at|in|from|aus|im|vom|auf|on)\b/i,  // "Live at Wacken", "Live in Berlin"
    /\bunplugged\b/i, /\bin concert\b/i,
  ];
  const RE_COMMENTARY = /\b(commentary|kommentar)\b/i;

  function _albumPassesFilters(a, filters) {
    const n = a.name || '';
    if (filters.noLive && (RE_LIVE_ALBUM.test(n) || a.album_type === 'live')) return false;
    if (filters.noCommentary && RE_COMMENTARY.test(n)) return false;
    if (filters.yearFrom || filters.yearTo) {
      const y = parseInt((a.release_date || '0').slice(0, 4), 10);
      if (filters.yearFrom && y < filters.yearFrom) return false;
      if (filters.yearTo   && y > filters.yearTo)   return false;
    }
    return true;
  }

  function _applyFilters(tracks, filters, blacklist) {
    let r = tracks.filter(t => !blacklist.has(t.id));
    if (filters.noLive) {
      r = r.filter(t => {
        if (RE_LIVE_ALBUM.test(t.album?.name || '')) return false;
        const name = t.name || '';
        return !RE_LIVE_TRACK.some(re => re.test(name));
      });
    }
    if (filters.noCommentary) {
      // z.B. "The Nexus - Commentary" auf "The Nexus (Commentary)"
      r = r.filter(t => !RE_COMMENTARY.test(t.name || '') && !RE_COMMENTARY.test(t.album?.name || ''));
    }
    if (filters.noInstrumental) {
      r = r.filter(t => {
        const n = (t.name||'').toLowerCase();
        return !n.includes('instrumental') && !n.includes('karaoke') &&
               !n.includes('backing track') && !n.includes('playback') &&
               !n.includes('(inst') && !n.includes('inst.');
      });
    }
    if (filters.noOrchestral) {
      r = r.filter(t => {
        const track = (t.name||'').toLowerCase();
        const album = (t.album?.name||'').toLowerCase();
        return !track.includes('orchestral') && !album.includes('orchestral');
      });
    }
    if (filters.noAcoustic) {
      r = r.filter(t => {
        const track = (t.name||'').toLowerCase();
        const album = (t.album?.name||'').toLowerCase();
        const ACOUSTIC = ['acoustic', 'acoustique', 'akustik', 'unplugged', 'stripped'];
        return !ACOUSTIC.some(k => track.includes(k) || album.includes(k));
      });
    }
    if (filters.yearFrom || filters.yearTo) {
      r = r.filter(t => {
        const y = parseInt((t.album?.release_date||'0').slice(0,4), 10);
        if (filters.yearFrom && y < filters.yearFrom) return false;
        if (filters.yearTo   && y > filters.yearTo)   return false;
        return true;
      });
    }
    return r;
  }

  // ── SONG-ERKENNUNG (Single + Albumversion = ein Song) ──
  // Gleicher Song erscheint oft als Single UND auf dem Album (verschiedene IDs).
  // Ohne Zusammenfassung käme er doppelt so oft. Schlüssel = normalisierter Name
  // ohne Zusätze wie "(Radio Edit)", "- Remastered 2011", "(Single Version)".
  const RE_VERSION_WORDS = '(remaster(?:ed)?|single|radio|album|edit|version|mono|stereo|bonus|deluxe)';
  const RE_VERSION_PAREN = new RegExp(`\\s*[(\\[][^)\\]]*\\b${RE_VERSION_WORDS}\\b[^)\\]]*[)\\]]`, 'gi');
  const RE_VERSION_DASH  = new RegExp(`\\s+[-–—]\\s+[^-–—]*\\b${RE_VERSION_WORDS}\\b.*$`, 'i');
  function _songKey(name) {
    return (name || '').toLowerCase()
      .replace(RE_VERSION_PAREN, '')
      .replace(RE_VERSION_DASH, '')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }
  const ALBUM_PRIO = { album: 0, single: 1, compilation: 2 };
  function _prio(t) { return ALBUM_PRIO[t.album?.album_type] ?? 3; }

  // Aus allen bekannten Tracks pro Song genau EINE Version wählen (Album vor Single).
  // Liefert: canonical (Set der Track-IDs), variants (key → [ids]), keyOf (id → key)
  function _buildSongIndex(trackLists) {
    const best = new Map(), variants = new Map(), keyOf = new Map();
    for (const tracks of trackLists) {
      for (const t of tracks) {
        const k = _songKey(t.name) || t.id;
        keyOf.set(t.id, k);
        if (!variants.has(k)) variants.set(k, []);
        const v = variants.get(k);
        if (!v.includes(t.id)) v.push(t.id);
        const b = best.get(k);
        if (!b || _prio(t) < _prio(b) || (_prio(t) === _prio(b) && t.id < b.id)) best.set(k, t);
      }
    }
    return { canonical: new Set([...best.values()].map(t => t.id)), variants, keyOf };
  }

  // ── PUBLIC ────────────────────────────────────────────
  async function getMe() {
    // Hinweis: Seit Feb 2026 liefert /me kein country/email/product mehr.
    // Der Marktcode kommt daher aus localStorage (as_market) mit Fallback DE.
    return _fetch('/me');
  }
  async function getArtistAlbums(id, limit=10, offset=0) {
    return (await _fetch(`/artists/${_sid(id)}/albums?include_groups=album,single&limit=${limit}&offset=${offset}`))?.items || [];
  }
  async function searchArtists(q, limit=8) {
    if (!q.trim()) return [];
    return (await _fetch(`/search?${new URLSearchParams({q, type:'artist', limit})}`))?.artists?.items || [];
  }
  async function getDevices()          { return (await _fetch('/me/player/devices'))?.devices || []; }

  async function playTrack(trackUri, deviceId) {
    await _fetch(`/me/player/play${deviceId?`?device_id=${encodeURIComponent(deviceId)}`:''}`, { method:'PUT', body: JSON.stringify({ uris:[trackUri] }) });
  }
  async function setVolume(vol, deviceId) {
    await _fetch(`/me/player/volume?volume_percent=${Math.round(vol)}${deviceId?`&device_id=${encodeURIComponent(deviceId)}`:''}`, { method:'PUT' });
  }
  async function seek(ms, deviceId) {
    await _fetch(`/me/player/seek?position_ms=${Math.round(ms)}${deviceId?`&device_id=${encodeURIComponent(deviceId)}`:''}`, { method:'PUT' });
  }
  async function transferPlayback(deviceId, play=true) {
    await _fetch('/me/player', { method:'PUT', body: JSON.stringify({ device_ids:[deviceId], play }) });
  }
  async function setRepeat(state, deviceId) {
    await _fetch(`/me/player/repeat?state=${state}${deviceId?`&device_id=${encodeURIComponent(deviceId)}`:''}`, { method:'PUT' });
  }

  // ── TRACK-AUSWAHL ─────────────────────────────────────
  // Ziel: jeder noch nicht gespielte Song eines Artists ist gleich wahrscheinlich —
  // ohne bei kaltem Cache 25+ Alben auf einmal laden zu müssen (≈ 1 s pro Request).
  //
  // Verfahren (Rejection Sampling):
  //  • Bereits gecachte Alben kennen wir genau → Gewicht = Anzahl wählbarer Songs.
  //  • Ungecachte Alben bekommen ihr total_tracks als (Ober-)Schätzung.
  //  • Album gewichtet ziehen. Bekannt → Song daraus nehmen.
  //    Unbekannt → laden, dann einen „Platz" aus total_tracks würfeln: trifft er
  //    einen wählbaren Song → nehmen, sonst neu ziehen. So bleibt die Verteilung
  //    gleichmäßig, obwohl meist nur 1–2 Alben geladen werden.
  //  • Nach MAX_FETCH_PER_PICK Nachladungen begnügen wir uns mit den bekannten Songs.
  const MAX_FETCH_PER_PICK = 4;

  function _keyOfTrack(t) { return _songKey(t.name) || t.id; }

  async function _sampleTrack(albums, { filters, blacklist, history, onlyNew, played, useLock }) {
    const raw = new Map(), known = new Map(), failed = new Set();
    const addKnown = (album, tracks) => { raw.set(album.id, tracks); known.set(album.id, _applyFilters(tracks, filters, blacklist)); };
    for (const a of albums) if (_isTracksCached(a.id)) addKnown(a, await _getCachedTracks(a.id, a));

    const withVariants = t => {
      const k = _keyOfTrack(t), ids = [];
      for (const tracks of raw.values()) for (const x of tracks) if (_keyOfTrack(x) === k && !ids.includes(x.id)) ids.push(x.id);
      return { ...t, variantIds: ids.length ? ids : [t.id] };
    };
    const rnd = arr => arr[Math.floor(Math.random() * arr.length)];

    let fetches = 0, pending = null;
    for (let guard = 0; guard < albums.length * 2 + 4; guard++) {
      const idx = _buildSongIndex([...known.values()]);
      const playedKeys = new Set();
      if (useLock) for (const tracks of raw.values()) for (const t of tracks) if (played.has(t.id)) playedKeys.add(_keyOfTrack(t));
      const isEligible = t => idx.canonical.has(t.id)
        && !(useLock && (played.has(t.id) || playedKeys.has(_keyOfTrack(t))))
        && !(onlyNew && history.has(t.id));

      const eligibleOf = new Map();
      const weights = albums.map(a => {
        if (failed.has(a.id)) return 0;
        if (known.has(a.id)) { const e = known.get(a.id).filter(isEligible); eligibleOf.set(a.id, e); return e.length; }
        return Math.max(1, a.total_tracks || 10);
      });

      // Gerade nachgeladenes Album: Rejection-Schritt
      if (pending) {
        const e = eligibleOf.get(pending.id) || [];
        const j = Math.floor(Math.random() * Math.max(pending.w, e.length));
        if (j < e.length) return withVariants(e[j]);
        pending = null;
      }

      const total = weights.reduce((s, w) => s + w, 0);
      if (!total) return null; // alles bekannt, nichts wählbar → erschöpft
      let r = Math.random() * total, i = 0;
      for (; i < albums.length - 1; i++) { r -= weights[i]; if (r < 0) break; }
      while (!weights[i] && i > 0) i--;
      const album = albums[i];

      if (known.has(album.id)) return withVariants(rnd(eligibleOf.get(album.id)));

      if (fetches >= MAX_FETCH_PER_PICK) {
        const allE = [...eligibleOf.values()].flat();
        if (allE.length) return withVariants(rnd(allE));
      }
      fetches++;
      const tracks = await _getCachedTracks(album.id, album);
      if (!tracks.length) { failed.add(album.id); continue; }
      addKnown(album, tracks);
      pending = { id: album.id, w: weights[i] };
    }
    return null;
  }

  // inFlight: IDs, die schon in der Queue stehen. Sie bleiben auch nach einem Reset
  // (Diskografie erschöpft) gesperrt — sonst konnte ein Song, der gerade erst
  // eingereiht wurde, gleich noch einmal gezogen werden.
  async function getRandomTrack(artistId, filters={}, blacklist=new Set(), history=new Set(), onlyNew=false, artistTrackHistory={}, artistRepeatLimit=3, inFlight=[]) {
    const albums = (await _getCachedAlbums(artistId)).filter(a => _albumPassesFilters(a, filters));
    if (!albums.length) return null;
    // Alle gespielten Songs dieses Artists sperren — erst resetten wenn Diskografie erschöpft
    const played = new Set(artistTrackHistory[artistId] || []);
    const opts = { filters, blacklist, history, onlyNew, played, useLock: played.size > 0 };
    let t = await _sampleTrack(albums, opts);
    if (!t && onlyNew) t = await _sampleTrack(albums, { ...opts, onlyNew: false });
    if (!t && played.size) {
      console.log(`[Shuffle] Diskografie von Artist ${artistId} erschöpft — History reset`);
      const keep = new Set(inFlight);
      artistTrackHistory[artistId] = [...keep];
      t = keep.size ? await _sampleTrack(albums, { ...opts, onlyNew: false, played: keep, useLock: true }) : null;
      if (!t) t = await _sampleTrack(albums, { ...opts, onlyNew: false, useLock: false });
    }
    // artistId mitgeben: die App sperrt den Song (inkl. aller Versionen) sofort beim Einreihen
    return t ? { ...t, artistId } : null;
  }

  async function getArtistAlbumsFull(artistId) { return _getCachedAlbums(artistId); }

  // Einzelnes Album aus der Liste. played = Song-Sperre des Album-Artists: Songs, die
  // schon gespielt wurden (auch als Single/auf anderem Album), werden übersprungen,
  // solange das Album noch andere hat. artistId wird mitgegeben, damit die App sperrt.
  async function getRandomTrackFromAlbum(albumId, albumData, blacklist=new Set(), history=new Set(), onlyNew=false, played=new Set()) {
    let tracks = _applyFilters(await _getCachedTracks(albumId, albumData), {}, blacklist);
    if (onlyNew) { const f=tracks.filter(t=>!history.has(t.id)); if(f.length) tracks=f; }
    if (played.size) {
      const playedKeys = new Set();
      for (const c of _trackCache.values()) for (const t of c.tracks) if (played.has(t.id)) playedKeys.add(_keyOfTrack(t));
      const f = tracks.filter(t => !played.has(t.id) && !playedKeys.has(_keyOfTrack(t)));
      if (f.length) tracks = f;
    }
    if (!tracks.length) return null;
    const t = tracks[Math.floor(Math.random()*tracks.length)];
    return { ...t, artistId: albumData?.artistId || t.artists?.[0]?.id, variantIds: [t.id] };
  }

  // Tracks eines Albums (gecacht). Ohne albumData wird bei Cache-Miss geladen,
  // aber nicht gecacht — sonst landen unvollständige Albumdaten im Cache.
  async function getAlbumTracks(albumId, albumData=null) {
    if (_isTracksCached(albumId) || albumData) return _getCachedTracks(albumId, albumData);
    const data = await _fetch(`/albums/${_sid(albumId)}/tracks?limit=50&market=${_userMarket}`);
    return _enrichTracks(data?.items || [], { id: albumId });
  }

  // Track-Status für das Album-Menü: dieselben Filter, dieselbe Song-Erkennung wie der Shuffle.
  async function getArtistTrackStatus(artistId, filters={}, blacklist=new Set(), playedIds=new Set(), onProgress=null) {
    const albums = (await _getCachedAlbums(artistId)).filter(a => _albumPassesFilters(a, filters));
    const rawLists = [], lists = [];
    for (let i = 0; i < albums.length; i++) {
      const tracks = await _getCachedTracks(albums[i].id, albums[i]);
      rawLists.push(tracks);
      lists.push(_applyFilters(tracks, filters, blacklist));
      onProgress?.(i + 1, albums.length);
    }
    const idx = _buildSongIndex(lists);
    const playedKeys = new Set(rawLists.flat().filter(t => playedIds.has(t.id)).map(_keyOfTrack));
    return lists.flat().filter(t => idx.canonical.has(t.id)).map(t => ({
      id: t.id, name: t.name, album: t.album?.name || '',
      played: playedIds.has(t.id) || playedKeys.has(_keyOfTrack(t)),
    }));
  }

  // Seit Feb 2026: POST /me/playlists und POST /playlists/{id}/items
  // (die alten /users/{id}/playlists und /playlists/{id}/tracks sind entfernt)
  async function createPlaylist(name, description, uris) {
    const pl = await _fetch('/me/playlists', { method: 'POST', body: JSON.stringify({ name, description, public: false }) });
    if (!pl?.id) throw new Error('Playlist konnte nicht erstellt werden');
    for (let i = 0; i < uris.length; i += 100) {
      await _fetch(`/playlists/${_sid(pl.id)}/items`, { method: 'POST', body: JSON.stringify({ uris: uris.slice(i, i + 100) }) });
    }
    return pl;
  }

  // Genre-Shuffle — seit Feb 2026 ist limit bei /search auf max. 10 begrenzt.
  // Die Suche selbst bleibt verfügbar; nur das zu hohe Limit (50/20) warf zuvor
  // den irreführenden 400 "Invalid limit".
  async function getRandomTrackByGenre(genre, filters={}, blacklist=new Set()) {
    const tryQuery = async (q, offset=0) => {
      const params = new URLSearchParams({ q, type: 'track', limit: '10' });
      if (offset) params.set('offset', String(offset));
      let data = null;
      try {
        data = await _fetch(`/search?${params}`);
      } catch { return []; }
      let tracks = (data?.tracks?.items||[]).map(t=>({...t, albumArt: t.album?.images?.[0]?.url||''}));
      return _applyFilters(tracks, filters, blacklist);
    };
    // 1. genre:-Filter, verschiedene Offsets (offset+limit ≤ 1000)
    for (const offset of [0, 40, 100, 200, 400].sort(()=>Math.random()-0.5)) {
      const tracks = await tryQuery(`genre:${genre}`, offset);
      if (tracks.length) return tracks[Math.floor(Math.random()*tracks.length)];
    }
    // 2. Fallback: Freitext (Spezial-Genres sind oft nicht im genre:-Filter)
    for (const offset of [0, 30, 60]) {
      const tracks = await tryQuery(genre.replace(/-/g, ' '), offset);
      if (tracks.length) return tracks[Math.floor(Math.random()*tracks.length)];
    }
    return null;
  }

  function getAvailableGenres() {
    // Statische Liste gängiger Spotify-Genres (der /recommendations/available-genre-seeds
    // Endpunkt wurde 2024 entfernt). Für die Genre-Suche als Vorschläge.
    return [
      'acoustic','alternative','ambient','black-metal','blues','classical','club',
      'country','dance','death-metal','deep-house','disco','drum-and-bass','dubstep',
      'edm','electro','electronic','folk','folk-metal','funk','garage','gospel','goth',
      'grindcore','groove','grunge','hard-rock','hardcore','hardstyle','heavy-metal',
      'hip-hop','house','indie','indie-pop','industrial','jazz','k-pop','melodic-death-metal',
      'metal','metalcore','new-age','opera','pop','pop-rock','power-metal','progressive-house',
      'progressive-metal','psychedelic','punk','punk-rock','r-n-b','reggae','reggaeton','rock',
      'rock-n-roll','singer-songwriter','ska','soul','soundtrack','swedish','symphonic-metal',
      'synth-pop','techno','thrash-metal','trance','trip-hop','viking-metal',
    ];
  }

  return {
    init, startLogin, handleCallback, logout, isLoggedIn, getToken,
    getMe, searchArtists, getArtistAlbums,
    getDevices, playTrack, setVolume, seek, transferPlayback, setRepeat,
    getRandomTrack, getArtistAlbumsFull, getRandomTrackFromAlbum,
    getAlbumTracks, getArtistTrackStatus, createPlaylist,
    getRandomTrackByGenre, getAvailableGenres,
    setServerCacheUrl, loadServerCache, loadServerTrackCache, syncFetch,
  };

})();
