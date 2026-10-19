/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/sync.js
   Synchronisation mit dem Sync-Server (Listen, Stats, Blacklist, Track-History)
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── SYNC ──────────────────────────────────────────────────────────────────────
const Sync = {
  get url()       { return window.SPOTIFY_CONFIG?.syncUrl   || null; },
  get statsSync() { return window.SPOTIFY_CONFIG?.syncStats !== false; }, // default true wenn syncUrl gesetzt

  // Läuft über SpotifyAPI.syncFetch — schickt das Spotify-Token zur Anmeldung mit
  _request(method, endpoint, body) {
    return SpotifyAPI.syncFetch(endpoint, { method, body, baseUrl: this.url });
  },

  async load() {
    if (!this.url) return false;
    const data = await this._request('GET', '/api/lists');
    if (!data?.lists?.length) return false;
    const serverLists = data.lists.map(normalizeList).filter(Boolean);
    const serverIds = new Set(serverLists.map(l => l.id));
    const localOnly = State.lists.filter(l => !serverIds.has(l.id));
    State.lists = [...serverLists, ...localOnly];
    LS.save();
    console.log('[Sync] Loaded:', data.lists.length);
    return true;
  },

  async save() {
    if (!this.url) return false;
    const ok = await this._request('POST', '/api/lists', { lists: State.lists });
    if (ok) console.log('[Sync] Saved:', State.lists.length);
    return !!ok;
  },

  async loadStats() {
    if (!this.url || !this.statsSync) return false;
    const data = await this._request('GET', '/api/stats');
    if (!Array.isArray(data?.plays)) return false;
    // Server-Stats übernehmen (last-write-wins — wir hören nur auf einem Gerät)
    State.stats = { plays: data.plays.filter(p => p && typeof p === 'object'), shuffles: Number(data.shuffles) || 0 };
    localStorage.setItem('as_stats', JSON.stringify(State.stats));
    console.log('[Sync] Stats loaded:', data.plays.length, 'plays');
    return true;
  },

  async saveStats() {
    if (!this.url || !this.statsSync) return false;
    const ok = await this._request('POST', '/api/stats', { plays: State.stats.plays, shuffles: State.stats.shuffles });
    if (ok) console.log('[Sync] Stats saved:', State.stats.plays.length, 'plays');
    return !!ok;
  },

  async loadBlacklist() {
    if (!this.url) return false;
    const data = await this._request('GET', '/api/blacklist');
    if (!Array.isArray(data?.blacklist)) return false;
    // Mergen: Server-Einträge + lokale die nicht auf dem Server sind
    const serverList = data.blacklist.filter(b => b && typeof b.id === 'string');
    const serverIds = new Set(serverList.map(b => b.id));
    const localOnly = State.blacklist.filter(b => !serverIds.has(b.id));
    State.blacklist = [...serverList, ...localOnly];
    localStorage.setItem('as_blacklist', JSON.stringify(State.blacklist));
    console.log('[Sync] Blacklist loaded:', data.blacklist.length, 'tracks');
    return true;
  },

  async saveBlacklist() {
    if (!this.url) return false;
    const ok = await this._request('POST', '/api/blacklist', { blacklist: State.blacklist });
    if (ok) console.log('[Sync] Blacklist saved:', State.blacklist.length, 'tracks');
    return !!ok;
  },

  async loadTrackHistory() {
    if (!this.url) return false;
    const data = await this._request('GET', '/api/track-history');
    if (!data?.history || typeof data.history !== 'object') return false;
    // Mergen: Server + lokal (Union aller Track-IDs pro Artist)
    for (const [artistId, serverTracks] of Object.entries(data.history)) {
      if (!Array.isArray(serverTracks) || !isSpotifyId(artistId)) continue;
      const local = State.artistTrackHistory[artistId] || [];
      const merged = [...new Set([...serverTracks, ...local])];
      State.artistTrackHistory[artistId] = merged;
    }
    localStorage.setItem('as_track_history', JSON.stringify(State.artistTrackHistory));
    console.log('[Sync] Track history loaded:', Object.keys(data.history).length, 'artists');
    return true;
  },

  async saveTrackHistory() {
    if (!this.url) return false;
    const ok = await this._request('POST', '/api/track-history', { history: State.artistTrackHistory });
    if (ok) console.log('[Sync] Track history saved:', Object.keys(State.artistTrackHistory).length, 'artists');
    return !!ok;
  },

  async check() {
    if (!this.url) return false;
    try {
      const c = new AbortController();
      setTimeout(() => c.abort(), 2000);
      const res = await fetch(`${this.url}/api/health`, { signal: c.signal });
      return res.ok;
    } catch { return false; }
  },
};
