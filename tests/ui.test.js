// UI-Regressionstests im Headless-Chromium mit simuliertem Spotify (Web API + Web Playback SDK)
// und echtem Sync-Server (Temp-Ordner).
// Voraussetzung: npm i -D playwright && npx playwright install chromium
// Start: node tests/ui.test.js   (optional: CHROMIUM_PATH=/pfad/zu/chrome)
'use strict';
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');
const { check, report } = require('./harness');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const WEB_PORT = 38100 + Math.floor(Math.random() * 400);
const SYNC_PORT = WEB_PORT + 500;
const ORIGIN = `http://127.0.0.1:${WEB_PORT}`;
const SYNC = `http://127.0.0.1:${SYNC_PORT}`;
const MIME = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const CONFIG = `window.SPOTIFY_CONFIG = { clientId: 'cid', redirectUri: '${ORIGIN}/music-shuffle/', syncUrl: '${SYNC}' };`;

// ── Statischer Server: /music-shuffle/* → Repo, config.js generiert ──
const hits = {};
const web = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  hits[p] = (hits[p] || 0) + 1;
  if (p === '/fake-spotify/v1/me') { // für die Anmeldung am Sync-Server
    const ok = req.headers.authorization === 'Bearer AT';
    res.writeHead(ok ? 200 : 401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(ok ? { id: 'kampfmade' } : { error: { status: 401 } }));
  }
  if (!p.startsWith('/music-shuffle/')) { res.writeHead(404); return res.end(); }
  p = p.slice('/music-shuffle/'.length) || 'index.html';
  if (p === 'config.js') { res.writeHead(200, { 'Content-Type': MIME['.js'] }); return res.end(CONFIG); }
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ── Sync-Server ──
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-ui-'));
function startSync() {
  const F = n => path.join(DIR, n);
  const env = { ...process.env, PORT: String(SYNC_PORT),
    ALLOWED_USERS: 'kampfmade', ALLOWED_ORIGINS: ORIGIN, SPOTIFY_ME_URL: `${ORIGIN}/fake-spotify/v1/me`, DATA_FILE: F('lists.json'), STATS_FILE: F('stats.json'), CACHE_FILE: F('cache.json'),
    BLACKLIST_FILE: F('blacklist.json'), TRACKS_FILE: F('tracks.json'), HISTORY_FILE: F('track-history.json') };
  const p = spawn(process.execPath, [path.join(ROOT, 'sync-server', 'sync-server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((res, rej) => {
    p.stdout.on('data', d => { if (String(d).includes('läuft auf Port')) res(p); });
    setTimeout(() => rej(new Error('Sync-Server Timeout')), 5000);
  });
}

// ── Spotify-Katalog ──
const mkTrack = (id, name, artistId) => ({ id, name, uri: 'spotify:track:' + id, duration_ms: 200000, artists: [{ id: artistId, name: artistId === 'A1' ? 'ROBSE' : 'Hiraes', uri: 'spotify:artist:' + artistId }] });
const CATALOG = {
  A1: { albums: [{ id: 'AL1', name: 'Harlekin', album_type: 'album', release_date: '2023-01-01', total_tracks: 6, images: [{ url: '' }] },
                 { id: 'SG1', name: 'ROBSE Song 0', album_type: 'single', release_date: '2022-06-01', total_tracks: 1, images: [{ url: '' }] }] },
  A2: { albums: [{ id: 'AL2', name: 'Solitary', album_type: 'album', release_date: '2021-01-01', total_tracks: 6, images: [{ url: '' }] }] },
};
const TRACKS = {
  AL1: Array.from({ length: 6 }, (_, i) => mkTrack('A1T' + i, 'ROBSE Song ' + i, 'A1')),
  SG1: [mkTrack('A1S0', 'ROBSE Song 0 - Single Version', 'A1')],
  AL2: Array.from({ length: 6 }, (_, i) => mkTrack('A2T' + i, 'Hiraes Song ' + i, 'A2')),
};
const ALL_TRACKS = Object.values(TRACKS).flat();
const albumOf = id => Object.keys(TRACKS).find(a => TRACKS[a].some(t => t.id === id));

const FAKE_SDK = `
window.__state = null;
window.__emit = (patch) => { window.__state = Object.assign({}, window.__state || {}, patch); (window.__player?.l.player_state_changed || []).forEach(cb => cb(window.__state)); };
window.Spotify = { Player: class {
  constructor(o) { this.o = o; this.l = {}; window.__player = this; }
  addListener(ev, cb) { (this.l[ev] = this.l[ev] || []).push(cb); }
  connect() {
    window.__connects = (window.__connects || 0) + 1;
    const id = 'DEV' + window.__connects;
    setTimeout(() => { window.__aliveDevice = id; (this.l.ready || []).forEach(cb => cb({ device_id: id })); }, 50);
    return Promise.resolve(true);
  }
  disconnect() { window.__disconnected = true; window.__aliveDevice = null; }
  pause() { window.__emit({ paused: true }); return Promise.resolve(); }
  resume() { window.__emit({ paused: false }); return Promise.resolve(); }
  setVolume() { return Promise.resolve(); }
  getCurrentState() { return Promise.resolve(window.__state); }
}};
if (window.onSpotifyWebPlaybackSDKReady) window.onSpotifyWebPlaybackSDKReady();`;

async function setupPage(context, { preloadAuth = true } = {}) {
  const page = await context.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
  page.on('request', r => requests.push({ url: r.url(), method: r.method(), body: r.postData() }));

  await page.route('https://sdk.scdn.co/**', r => r.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }));
  await page.route('https://accounts.spotify.com/api/token', r => r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant"}' }));
  await page.route('https://accounts.spotify.com/authorize**', r => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Spotify Login</h1>' }));
  await page.route('https://i.scdn.co/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://api.spotify.com/**', async (route) => {
    const req = route.request(); const u = new URL(req.url()); const p = u.pathname.replace('/v1', '');
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    let m;
    if (p === '/me') return json({ id: 'kampfmade', display_name: 'kampfmade', images: [] });
    if (p === '/me/player/devices') {
      const alive = await page.evaluate(() => window.__aliveDevice).catch(() => null);
      return json({ devices: alive ? [{ id: alive, name: 'Music Shuffle', type: 'Computer', is_active: true }] : [] });
    }
    if ((m = p.match(/^\/artists\/(\w+)\/albums$/))) return json({ items: +u.searchParams.get('offset') ? [] : (CATALOG[m[1]]?.albums || []) });
    if ((m = p.match(/^\/albums\/(\w+)\/tracks$/))) return json({ items: TRACKS[m[1]] || [] });
    if (p === '/search') return json({ artists: { items: [] }, tracks: { items: [] } });
    if (p === '/me/playlists' && req.method() === 'POST') return json({ id: 'PL1' }, 201);
    if (p === '/playlists/PL1/items' && req.method() === 'POST') return json({ snapshot_id: 's' }, 201);
    if (p === '/me/player/play') {
      // Gerät, das Spotify nicht (mehr) kennt → 404 wie im echten Leben
      const alive = await page.evaluate(() => window.__aliveDevice).catch(() => null);
      if (u.searchParams.get('device_id') !== alive) return json({ error: { status: 404, message: 'Device not found' } }, 404);
      const uri = JSON.parse(req.postData() || '{}').uris?.[0];
      const t = ALL_TRACKS.find(x => x.uri === uri);
      await route.fulfill({ status: 204, body: '' });
      if (t) await page.evaluate(({ t, al }) => window.__emit({ paused: false, position: 0, duration: t.duration_ms,
        track_window: { current_track: { id: t.id, name: t.name, uri: t.uri, artists: t.artists, album: { name: 'Album', uri: 'spotify:album:' + al, images: [{ url: '' }] } }, previous_tracks: [], next_tracks: [] } }), { t, al: albumOf(t.id) }).catch(() => {});
      return;
    }
    if (req.method() === 'PUT' || req.method() === 'POST') return route.fulfill({ status: 204, body: '' });
    return json({});
  });

  if (preloadAuth) {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__init')) return; sessionStorage.setItem('__init', '1');
      localStorage.setItem('spotify_auth', JSON.stringify({ accessToken: 'AT', tokenExpiry: Date.now() + 3600e3, refreshToken: 'RT' }));
      localStorage.setItem('as_lists', JSON.stringify([{ id: 'l1', name: 'Metal', artists: [
        { id: 'A1', name: 'ROBSE', images: [{ url: 'https://i.scdn.co/image/broken' }], genres: [] },
        { id: 'A2', name: 'Hiraes', images: [], genres: [] }], albums: [], genres: [], filters: { noRepeat: true } }]));
      localStorage.setItem('as_active_list', 'l1');
    });
  }
  return { page, errors, requests };
}

(async () => {
  await new Promise(r => web.listen(WEB_PORT, '127.0.0.1', r));
  const sync = await startSync();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  // ═══ Durchlauf 1: normaler Start ═══
  let context = await browser.newContext({ serviceWorkers: 'block' });
  let { page, errors, requests } = await setupPage(context);
  await page.goto(`${ORIGIN}/music-shuffle/`);
  await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(1500);
  const fallbackSrc = await page.evaluate(() => document.querySelector('.artist-card[data-artist-id="A1"] .artist-card-img')?.src || '');
  check('U0 Start ohne JS-Fehler, Platzhalterbild greift bei kaputtem Artist-Bild',
    errors.length === 0 && fallbackSrc.startsWith('data:image/svg+xml'), `${errors.join(' | ') || 'keine Fehler'}; img=${fallbackSrc.slice(0, 30)}`);

  const tabLabels = await page.evaluate(() => [document.getElementById('tab-albums-btn').textContent, document.getElementById('tab-trackstatus-btn').textContent]);
  check('U1 Tabs im Album-Fenster sind übersetzt', tabLabels[0] === '🎵 Alben' && tabLabels[1] === '📊 Track-Status', tabLabels.join(' / '));

  await page.waitForFunction(() => State.activeDeviceId, null, { timeout: 10000 }); // Gerät aus loadDevices()
  await page.click('#shuffle-btn-idle');
  await page.waitForFunction(() => State.currentTrack && State.isPlaying, null, { timeout: 15000 });
  check('U2 Shuffle startet einen Titel', true, await page.evaluate(() => State.currentTrack.name));

  const lockInfo = await page.evaluate(async () => {
    State.queue = []; await fillQueue();
    return State.queue.map(t => ({ name: t.name, ids: t.variantIds, locked: (t.variantIds || [t.id]).every(id => (State.artistTrackHistory[t.artistId] || []).includes(id)) }));
  });
  check('U3 Vorgeladene Queue-Titel sind sofort gesperrt (inkl. aller Versionen)', lockInfo.length === 2 && lockInfo.every(x => x.locked),
    lockInfo.map(x => `${x.name}: gesperrt=${x.locked} [${x.ids}]`).join('; '));

  const silentPlaying = await page.evaluate(() => !!(_silentAudio && !_silentAudio.paused));
  check('U4 Stummer Audio-Anker läuft während der Wiedergabe', silentPlaying);

  await page.mouse.click(700, 5);
  await page.keyboard.press('Control+f');
  const afterCtrl = await page.evaluate(() => document.getElementById('fullscreen-overlay').classList.contains('hidden'));
  await page.keyboard.press('f');
  const afterF = await page.evaluate(() => document.getElementById('fullscreen-overlay').classList.contains('hidden'));
  check('U5 Strg+F bleibt beim Browser, F allein öffnet das Vollbild', afterCtrl && !afterF, `nach Strg+F versteckt=${afterCtrl}, nach F versteckt=${afterF}`);
  await page.keyboard.press('Escape');

  const before = requests.length;
  await page.evaluate(() => { State.currentTrack = { ...State.currentTrack, albumId: 'AL1', album: 'Harlekin' }; });
  await page.click('#blacklist-album-btn');
  await page.waitForTimeout(11500); // > 10s Debounce
  const after = requests.slice(before);
  const blPost = after.filter(r => r.url.startsWith(SYNC + '/api/blacklist') && r.method === 'POST').length;
  const fromToken = after.filter(r => r.url.includes('market=from_token')).length;
  const blCount = await page.evaluate(() => State.blacklist.length);
  check('U6 Album-Blacklist wird zum Sync-Server übertragen (ohne market=from_token)', blCount >= 6 && blPost >= 1 && fromToken === 0,
    `Blacklist: ${blCount}, POST /api/blacklist: ${blPost}, from_token: ${fromToken}`);

  // Track-Status vor dem Entfernen prüfen (A1 = ROBSE)
  const before2 = requests.length;
  await page.click('.artist-card[data-artist-id="A1"]', { position: { x: 20, y: 20 } });
  await page.waitForSelector('#modal-album-browser:not(.hidden)');
  await page.click('#tab-trackstatus-btn');
  await page.waitForFunction(() => /gespielt/.test(document.getElementById('trackstatus-sub').textContent), null, { timeout: 8000 });
  const ts = await page.evaluate(() => ({ sub: document.getElementById('trackstatus-sub').textContent, items: [...document.querySelectorAll('.trackstatus-item .ts-name')].map(e => e.textContent) }));
  const tsReq = requests.slice(before2).filter(r => r.url.includes('/albums/') && r.url.includes('/tracks'));
  check('U7 Track-Status: Cache + Filter + Blacklist, Single/Album zusammengefasst, kein from_token',
    !tsReq.some(r => r.url.includes('from_token')) && !ts.items.some(n => /ROBSE Song [1-5]$/.test(n)) && ts.items.filter(n => n.startsWith('ROBSE Song 0')).length === 1,
    `${ts.sub}; Einträge: ${ts.items.join(', ')}; Track-Requests: ${tsReq.length}`);
  await page.click('#close-album-browser');

  errors.length = 0;
  const artistsBefore = await page.evaluate(() => getActiveList().artists.length);
  await page.click('.artist-card[data-artist-id="A2"] .artist-card-remove', { force: true });
  await page.waitForTimeout(300);
  const artistsAfter = await page.evaluate(() => getActiveList().artists.length);
  check('U8 ✕ an der Künstler-Kachel entfernt den Künstler', artistsAfter === artistsBefore - 1 && !errors.length,
    `vorher ${artistsBefore}, nachher ${artistsAfter}; Fehler: ${errors.join(' | ') || 'keine'}`);

  // Round Robin hat Vorrang vor Smart Shuffle
  const rr = await page.evaluate(async () => {
    getActiveList().artists.push({ id: 'A2', name: 'Hiraes', images: [], genres: [] });
    State.roundRobin = true; State.smartShuffle = true;
    State._rrQueue = [{ type: 'artist', data: getActiveList().artists.find(a => a.id === 'A2') }, { type: 'artist', data: getActiveList().artists.find(a => a.id === 'A1') }];
    State._rrIndex = 0;
    const seen = [], orig = SpotifyAPI.getRandomTrack;
    SpotifyAPI.getRandomTrack = (id, ...rest) => { seen.push(id); return orig(id, ...rest); };
    await doShuffle(); await doShuffle();
    SpotifyAPI.getRandomTrack = orig; State.roundRobin = false;
    return seen;
  });
  check('U9 Round Robin + Smart Shuffle: Shuffle-Button folgt der Round-Robin-Reihenfolge', rr.join(',') === 'A2,A1', rr.join(','));

  // Commentary-Filter in der UI
  await page.evaluate(() => { document.getElementById('filter-no-commentary').click(); });
  const cf = await page.evaluate(() => ({ f: getActiveList().filters.noCommentary, label: document.querySelector('[data-i18n="filter_no_commentary"]').textContent }));
  check('U10 Commentary-Filter wird pro Liste gespeichert', cf.f === true && cf.label.includes('Kommentar'), JSON.stringify(cf));

  // Playlist aus Verlauf
  const before3 = requests.length;
  await page.evaluate(() => createPlaylistFromHistory());
  await page.waitForTimeout(500);
  const plReq = requests.slice(before3).filter(r => r.url.startsWith('https://api.spotify.com') && r.method === 'POST').map(r => new URL(r.url).pathname);
  check('U11 Playlist aus Verlauf nutzt /me/playlists + /playlists/{id}/items', plReq.join(' ') === '/v1/me/playlists /v1/playlists/PL1/items', plReq.join(' '));

  // Sync läuft angemeldet (Spotify-Token) gegen den Server mit ALLOWED_USERS
  const syncReqs = requests.filter(r => r.url.startsWith(SYNC + '/api/') && !r.url.endsWith('/api/health'));
  const syncAuthed = await page.evaluate(async (SYNC) => (await fetch(SYNC + '/api/lists')).status, SYNC);
  check('U16 Sync-Server: App kommt angemeldet rein, ohne Token → 401',
    syncReqs.length > 0 && blPost >= 1 && syncAuthed === 401, `Sync-Requests: ${syncReqs.length}, direkter Request ohne Token: ${syncAuthed}`);

  // Gerät verschwindet (Tab war eingefroren) → 404 → automatisch neu verbinden und weiterspielen
  errors.length = 0;
  const rc = await page.evaluate(async () => {
    State.queue = [];
    window.__aliveDevice = null;                 // Spotify hat das Gerät abgemeldet
    const before = State.activeDeviceId;
    await playNextFromQueue();
    await new Promise(r => setTimeout(r, 400));
    return { before, after: State.activeDeviceId, connects: window.__connects, playing: State.isPlaying, track: State.currentTrack?.name };
  });
  check('U17 Gerät weg (404) → Player verbindet neu und spielt weiter',
    rc.before !== rc.after && rc.after === 'DEV' + rc.connects && rc.playing && !errors.some(e => /Playback Error/.test(e)),
    `${rc.before} → ${rc.after}, connects=${rc.connects}, spielt: ${rc.track}; Fehler: ${errors.join(' | ') || 'keine'}`);

  const bf = await page.evaluate(async () => {
    const c = window.__connects;
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    await new Promise(r => setTimeout(r, 400));
    return { reconnected: window.__connects === c + 1, device: State.activeDeviceId, alive: window.__aliveDevice };
  });
  check('U18 Rückkehr aus dem Back-Forward-Cache → sofort neu verbunden', bf.reconnected && bf.device === bf.alive, JSON.stringify(bf));

  // XSS: manipulierte Listen-Daten (z.B. vom Sync-Server oder Import) dürfen keinen Code ausführen
  const xss = await page.evaluate(async () => {
    window.__xss = 0;
    State.lists.push(normalizeList({ id: 'evil', name: '<img src=x onerror="window.__xss=1">', artists: [
      { id: 'A9', name: '<img src=x onerror="window.__xss=2">', images: [{ url: 'x" onerror="window.__xss=3' }] },
      { id: '"><img src=x onerror=window.__xss=4>', name: 'kaputte ID' }],
      albums: [{ id: 'B9', name: 'Alb', artistName: '<svg onload=window.__xss=5>', release_date: '<img src=x onerror=window.__xss=6>', images: [{ url: 'javascript:window.__xss=7' }] }] }));
    State.activeListId = 'evil';
    renderLists(); renderArtistGrid(); renderAlbumGrid();
    updateBackground('x) ; background:url(javascript:window.__xss=8');
    await new Promise(r => setTimeout(r, 500));
    const list = getActiveList();
    return { xss: window.__xss, artists: list.artists.length, img: document.querySelector('.artist-card-img')?.getAttribute('src')?.slice(0, 20) };
  });
  check('U19 Manipulierte Listen-Daten führen keinen Code aus (XSS)', xss.xss === 0 && xss.artists === 1, JSON.stringify(xss));
  await page.evaluate(() => { State.lists = State.lists.filter(l => l.id !== 'evil'); State.activeListId = 'l1'; renderLists(); renderArtistGrid(); renderAlbumGrid(); });

  const csp = await page.evaluate(async () => {
    window.__inline = 0;
    const sc = document.createElement('script'); sc.textContent = 'window.__inline = 1'; document.body.appendChild(sc);
    const d = document.createElement('div'); d.innerHTML = '<img src="data:," onerror="window.__inline = 2">'; document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 300));
    return window.__inline;
  });
  check('U20 Content-Security-Policy blockt eingeschleuste Inline-Skripte', csp === 0, `window.__inline = ${csp}`);

  // Englisch: keine deutschen Reste, keine rohen Schlüssel
  const en = await page.evaluate(async () => {
    I18N.setLang('en'); renderArtistGrid(); renderAlbumGrid(); renderQueue();
    const toasts = []; const orig = window.showToast; window.showToast = (m) => toasts.push(m);
    createList(''); toggleArtistFavorite(getActiveList().artists[0]?.id);
    window.showToast = orig;
    const text = document.getElementById('app').innerText;
    const titles = [...document.querySelectorAll('[title]')].map(e => e.title).join(' ');
    const res = { toasts, rawKeys: /\b(msg|toast|tab)_[a-z_]+\b/.test(text + titles), german: (text + ' ' + titles + ' ' + toasts.join(' ')).match(/.{0,40}(Entfernen|hinzugefügt|Künstler).{0,20}/)?.[0] || false };
    State.lists.pop(); State.activeListId = 'l1'; I18N.setLang('de'); renderLists(); renderArtistGrid();
    return res;
  });
  check('U21 Englische Oberfläche ohne deutsche Reste oder rohe Schlüssel', !en.rawKeys && !en.german && en.toasts[0] === 'List "New list" created',
    JSON.stringify(en));

  // Changelog-Dialog
  errors.length = 0;
  const cl = await page.evaluate(() => { showChangelog(); const c = document.getElementById('changelog-content').textContent; document.getElementById('modal-changelog').classList.add('hidden'); return { top: c.includes('v' + APP_VERSION), removed: c.includes('Entfernt') }; });
  check('U15 Changelog zeigt aktuelle Version und „Entfernt"-Abschnitte', cl.top && cl.removed && !errors.length, JSON.stringify(cl));

  // Logout stoppt den stummen Audio-Anker
  await page.evaluate(() => window.__emit({ paused: false }));
  await page.click('#logout-btn');
  await page.waitForTimeout(300);
  const silentAfterLogout = await page.evaluate(() => !!(_silentAudio && !_silentAudio.paused));
  check('U12 Nach Logout ist der stumme Audio-Loop gestoppt', !silentAfterLogout, `läuft noch: ${silentAfterLogout}`);
  await context.close();

  // ═══ Durchlauf 2: Login-Callback schlägt fehl → Login-Button muss funktionieren ═══
  context = await browser.newContext({ serviceWorkers: 'block' });
  ({ page, errors, requests } = await setupPage(context, { preloadAuth: false }));
  await page.goto(`${ORIGIN}/music-shuffle/?code=abc&state=falsch`);
  await page.waitForSelector('#login-screen:not(.hidden)', { timeout: 5000 });
  await page.click('#login-btn');
  const navigated = await page.waitForURL(/accounts\.spotify\.com\/authorize/, { timeout: 3000 }).then(() => true).catch(() => false);
  check('U13 Nach fehlgeschlagenem Login-Callback führt der Login-Button zu Spotify', navigated);
  await context.close();

  // ═══ Durchlauf 3: Service Worker network-first ═══
  context = await browser.newContext();
  ({ page } = await setupPage(context));
  await page.goto(`${ORIGIN}/music-shuffle/`);
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
  const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
  if (!controlled) { await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {}); }
  const hitsBefore = hits['/music-shuffle/app.js'] || 0;
  await page.reload();
  await page.waitForSelector('#app:not(.hidden)', { timeout: 10000 });
  const hitsAfter = hits['/music-shuffle/app.js'] || 0;
  check('U14 Service Worker holt app.js online immer frisch vom Server (kein Cache-Leeren nötig)',
    await page.evaluate(() => !!navigator.serviceWorker.controller) && hitsAfter > hitsBefore, `app.js-Abrufe beim Reload: ${hitsAfter - hitsBefore}`);
  await context.close();

  await browser.close(); web.close();
  sync.kill('SIGTERM'); await new Promise(r => sync.on('exit', r));
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch {}
  process.exit(report('UI (Chromium)') ? 1 : 0);
})().catch(e => { console.error('TESTFEHLER', e); report('UI (Chromium) — abgebrochen'); web.close(); process.exit(1); });
