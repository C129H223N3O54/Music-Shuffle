// Regressionstests für spotify-api.js — läuft in einer Node-VM mit simuliertem Spotify (fetch-Mock).
// Start: node tests/logic.test.js
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const { check, report } = require('./harness');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'spotify-api.js'), 'utf8')
  .replace('const MIN_INTERVAL = 1000;', 'const MIN_INTERVAL = 0;'); // Drosselung im Test aus
const SCRIPT = new vm.Script(SRC + ';this.SpotifyAPI = SpotifyAPI;');

function resp(status, body, headers = {}) {
  return { status, ok: status >= 200 && status < 300, headers: { get: k => headers[k] ?? null }, json: async () => body };
}
function makeApi(routes, { loggedIn = true } = {}) {
  const calls = [], store = {};
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
  const fetchMock = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || 'GET', body: opts.body, headers: opts.headers || {} });
    for (const [re, fn] of routes) { const m = String(url).match(re); if (m) return fn(m, opts); }
    return resp(404, { error: 'no route' });
  };
  const win = { location: { href: '', search: '', pathname: '/' }, history: { replaceState() {} } };
  const ctx = { localStorage: ls, sessionStorage: ls, fetch: fetchMock, console: { log() {}, warn() {}, error() {} },
    window: win, document: { title: '' }, setTimeout, clearTimeout, AbortController, URLSearchParams, TextEncoder,
    crypto: globalThis.crypto, btoa, Date, Math, JSON, Promise };
  vm.createContext(ctx);
  SCRIPT.runInContext(ctx);
  if (loggedIn) store.spotify_auth = JSON.stringify({ accessToken: 'AT', tokenExpiry: Date.now() + 3600e3, refreshToken: 'RT1' });
  ctx.SpotifyAPI.init('cid', 'https://x/');
  return { api: ctx.SpotifyAPI, calls, store, win };
}
const album = (id, name, n, type = 'album', year = '2020') => ({ id, name, album_type: type, release_date: `${year}-01-01`, images: [{ url: 'img' }], total_tracks: n, available_markets: ['DE', 'AT'] });
const track = (id, name, artistId = 'A1') => ({ id, name, uri: 'spotify:track:' + id, duration_ms: 200000, artists: [{ id: artistId, name: 'Artist', href: 'x' }], available_markets: ['DE', 'AT', 'CH'], external_urls: { spotify: 'x' } });
const pickN = async (api, n, args) => { const out = []; for (let i = 0; i < n; i++) out.push(await api.getRandomTrack(...args())); return out; };

(async () => {
  // L1 — Fehlgeschlagener Album-Abruf wird NICHT gecacht
  {
    let down = true;
    const { api, calls } = makeApi([
      [/\/artists\/A1\/albums/, () => down ? resp(403, { error: { message: 'Forbidden' } }) : resp(200, { items: [album('AL1', 'Album', 2)] })],
      [/\/albums\/AL1\/tracks/, () => resp(200, { items: [track('T1', 'Song 1'), track('T2', 'Song 2')] })],
      [/sync\.test\/api\//, () => resp(200, { success: true })],
    ]);
    api.setServerCacheUrl('https://sync.test');
    const first = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, {});
    down = false;
    const second = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, {});
    const pushedEmpty = calls.some(c => c.url.includes('/api/cache') && c.method === 'POST' && JSON.parse(c.body).albums.length === 0);
    check('L1 Album-Abruf mit 403 wird nicht gecacht, nächster Versuch klappt', first === null && second && !pushedEmpty,
      `1. Versuch: ${first?.name ?? null}, 2. Versuch: ${second?.name ?? null}, leere Liste gepusht: ${pushedEmpty}`);
  }

  // L2 — Ergebnis trägt artistId + variantIds (Single + Albumversion)
  {
    const { api } = makeApi([
      [/\/artists\/A1\/albums/, () => resp(200, { items: [album('AL1', 'Album', 2), album('S1', 'Hey Sturm', 1, 'single')] })],
      [/\/albums\/AL1\/tracks/, () => resp(200, { items: [track('ALB1', 'Hey Sturm'), track('ALB2', 'Anderer Song')] })],
      [/\/albums\/S1\/tracks/, () => resp(200, { items: [track('SGL1', 'Hey Sturm - Single Version')] })],
    ]);
    await api.getArtistTrackStatus('A1'); // Cache warm (beide Alben bekannt)
    let t;
    for (let i = 0; i < 40 && !(t && t.name.startsWith('Hey Sturm')); i++) t = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, {});
    const v = (t?.variantIds || []).slice().sort().join(',');
    check('L2 Track hat artistId und alle Versions-IDs (für die Sofort-Sperre)', t?.artistId === 'A1' && v === 'ALB1,SGL1',
      `artistId=${t?.artistId}, gewählt=${t?.id}, variantIds=${v}`);
  }

  // L3 — Single + Album: Song kommt nicht doppelt so oft (mit Sperre: jeder Song genau 1× pro Durchlauf)
  {
    const albumTracks = Array.from({ length: 12 }, (_, i) => track('ALB' + i, `Song ${i}`));
    albumTracks[0].name = 'Harlekin und Krieger'; albumTracks[1].name = 'Hey Sturm';
    const { api } = makeApi([
      [/\/artists\/A1\/albums/, () => resp(200, { items: [album('AL1', 'Album', 12), album('S1', 'Harlekin und Krieger', 1, 'single'), album('S2', 'Hey Sturm (Radio Edit)', 1, 'single')] })],
      [/\/albums\/AL1\/tracks/, () => resp(200, { items: albumTracks })],
      [/\/albums\/S1\/tracks/, () => resp(200, { items: [track('SGL1', 'Harlekin und Krieger')] })],
      [/\/albums\/S2\/tracks/, () => resp(200, { items: [track('SGL2', 'Hey Sturm (Radio Edit)')] })],
    ]);
    const hist = { A1: [] }, counts = {};
    for (let i = 0; i < 120; i++) {
      const t = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, hist);
      const key = t.name.replace(' (Radio Edit)', '');
      counts[key] = (counts[key] || 0) + 1;
      for (const id of t.variantIds) if (!hist.A1.includes(id)) hist.A1.push(id); // wie lockTrackForArtist
    }
    const vals = Object.values(counts);
    check('L3 Single + Albumversion zählen als EIN Song (120 Picks, 12 Songs → je 10×)',
      Object.keys(counts).length === 12 && Math.min(...vals) === 10 && Math.max(...vals) === 10,
      `"Harlekin und Krieger": ${counts['Harlekin und Krieger']}×, "Hey Sturm": ${counts['Hey Sturm']}×, Spanne ${Math.min(...vals)}–${Math.max(...vals)}`);
  }

  // L4 — Kalter Cache: ein Shuffle braucht nur wenige Spotify-Requests
  {
    const albums = Array.from({ length: 30 }, (_, i) => album('AL' + i, 'Album ' + i, 10));
    const { api, calls } = makeApi([
      [/\/artists\/A1\/albums\?.*offset=(\d+)/, (m) => resp(200, { items: albums.slice(+m[1], +m[1] + 10) })],
      [/\/albums\/(AL\d+)\/tracks/, (m) => resp(200, { items: Array.from({ length: 10 }, (_, j) => track(m[1] + 'T' + j, m[1] + ' S' + j)) })],
    ]);
    const t = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, {});
    const n = calls.filter(c => c.url.includes('api.spotify.com')).length;
    check('L4 Kalter Cache (30 Alben): ein Shuffle braucht ≤ 8 Requests (vorher 29)', t && n <= 8, `${n} Requests`);
  }

  // L5 — Gleichverteilung bei kaltem Cache (Rejection Sampling): Single-Track-Alben nicht bevorzugt
  {
    const ALBUMS = [album('B1', 'Single A', 1, 'single'), album('B2', 'Single B', 1, 'single'), album('B3', 'EP', 4), album('B4', 'Big', 14)];
    const TR = { B1: [track('x1', 'Single A')], B2: [track('x2', 'Single B')],
      B3: Array.from({ length: 4 }, (_, i) => track('ep' + i, 'EP ' + i)), B4: Array.from({ length: 14 }, (_, i) => track('bg' + i, 'Big ' + i)) };
    const routes = [
      [/\/artists\/A1\/albums/, () => resp(200, { items: ALBUMS })],
      [/\/albums\/(B\d)\/tracks/, (m) => resp(200, { items: TR[m[1]] })],
    ];
    const RUNS = 2000, counts = {};
    for (let i = 0; i < RUNS; i++) {
      const { api } = makeApi(routes); // jedes Mal frischer (kalter) Cache
      const t = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, {});
      counts[t.id] = (counts[t.id] || 0) + 1;
    }
    const exp = RUNS / 20, singles = ((counts.x1 || 0) + (counts.x2 || 0)) / 2;
    const big = Object.entries(counts).filter(([k]) => k.startsWith('bg')).reduce((s, [, c]) => s + c, 0) / 14;
    check('L5 Kalter Cache: jeder Song gleich wahrscheinlich (Single ≈ Albumtrack)',
      Math.abs(singles / exp - 1) < 0.35 && Math.abs(big / exp - 1) < 0.15,
      `erwartet ${exp}× je Song — Singles Ø ${singles.toFixed(0)}×, Album-Tracks Ø ${big.toFixed(0)}× (${RUNS} kalte Starts)`);
  }

  // L6 — Gleichzeitiger Token-Refresh → nur EIN Refresh, kein Logout
  {
    let current = 'RT1', refreshes = 0;
    const { api, store } = makeApi([
      [/accounts\.spotify\.com\/api\/token/, async (m, opts) => {
        refreshes++;
        const sent = new URLSearchParams(opts.body).get('refresh_token');
        await new Promise(r => setTimeout(r, 20));
        if (sent !== current) return resp(400, { error: 'invalid_grant' });
        current = 'RT' + (refreshes + 1);
        return resp(200, { access_token: 'AT' + refreshes, expires_in: 3600, refresh_token: current });
      }],
    ], { loggedIn: false });
    store.spotify_auth = JSON.stringify({ accessToken: 'OLD', tokenExpiry: Date.now() - 1000, refreshToken: 'RT1' });
    api.init('cid', 'https://x/');
    const r = await Promise.allSettled([api.getToken(), api.getToken(), api.getToken()]);
    check('L6 Drei gleichzeitige Token-Refreshes → 1 Request, eingeloggt bleiben',
      refreshes === 1 && api.isLoggedIn() && r.every(x => x.status === 'fulfilled' && x.value === 'AT1'),
      `Refresh-Requests: ${refreshes}, Ergebnisse: ${r.map(x => x.value || x.reason?.message).join(', ')}, eingeloggt: ${api.isLoggedIn()}`);
  }

  // L7 — Live-Filter: Wortgrenzen
  {
    const names = ['Deliverance', 'Alive', 'Olive Tree', 'Live at Wacken', 'Oblivion'];
    const trackNames = { AL0: 'Born to Live Free', AL1: 'Alive', AL2: 'Song (Live)', AL3: 'Intro', AL4: 'Song - Live in Berlin' };
    const { api } = makeApi([
      [/\/artists\/A1\/albums/, () => resp(200, { items: names.map((n, i) => album('AL' + i, n, 1)) })],
      [/\/albums\/(AL\d)\/tracks/, (m) => resp(200, { items: [track(m[1] + 'T', trackNames[m[1]])] })],
    ]);
    const seen = new Set();
    for (let i = 0; i < 80; i++) { const t = await api.getRandomTrack('A1', { noLive: true }, new Set(), new Set(), false, {}); if (t) seen.add(t.name); }
    const ok = seen.has('Born to Live Free') && seen.has('Alive') && !seen.has('Song (Live)') && !seen.has('Intro') && !seen.has('Song - Live in Berlin');
    check('L7 Live-Filter: „Deliverance/Alive/Olive" bleiben, „Live at …/(Live)" fliegen raus', ok, `gespielt: ${[...seen].join(', ')}`);
  }

  // L8 — Commentary-Filter (Track- UND Albumname)
  {
    const { api } = makeApi([
      [/\/artists\/A1\/albums/, () => resp(200, { items: [album('AL1', 'The Nexus', 2), album('AL2', 'The Nexus (Commentary)', 2)] })],
      [/\/albums\/AL1\/tracks/, () => resp(200, { items: [track('N1', 'The Nexus'), track('N2', 'The Nexus - Commentary')] })],
      [/\/albums\/AL2\/tracks/, () => resp(200, { items: [track('C1', 'Ekleipsis'), track('C2', 'Aenimus')] })],
    ]);
    const on = new Set((await pickN(api, 60, () => ['A1', { noCommentary: true }, new Set(), new Set(), false, {}])).map(t => t?.id));
    const off = new Set((await pickN(api, 120, () => ['A1', {}, new Set(), new Set(), false, {}])).map(t => t?.id));
    check('L8 Commentary-Filter entfernt „… - Commentary" und Alben „(Commentary)"',
      on.size === 1 && on.has('N1') && off.has('N2') && off.has('C1'),
      `mit Filter: ${[...on].join(',')} — ohne Filter: ${[...off].sort().join(',')}`);
  }

  // L9 — Track-Cache wird verschlankt zum Server geschickt
  {
    const { api, calls } = makeApi([
      [/\/artists\/A1\/albums/, () => resp(200, { items: [album('AL1', 'Album', 1)] })],
      [/\/albums\/AL1\/tracks/, () => resp(200, { items: [track('T1', 'Song')] })],
      [/sync\.test\/api\//, () => resp(200, { success: true })],
    ]);
    api.setServerCacheUrl('https://sync.test');
    await api.getRandomTrack('A1', {}, new Set(), new Set(), false, {});
    await new Promise(r => setTimeout(r, 10));
    const tPost = calls.find(c => c.url.includes('/api/tracks') && c.method === 'POST');
    const aPost = calls.find(c => c.url.includes('/api/cache') && c.method === 'POST');
    const t = tPost && JSON.parse(tPost.body).tracks[0], a = aPost && JSON.parse(aPost.body).albums[0];
    check('L9 Cache-Einträge ohne available_markets/href/external_urls',
      t && a && !('available_markets' in t) && !('external_urls' in t) && !t.artists[0].href && !('available_markets' in a) && t.album.release_date && a.total_tracks === 1,
      `Track-Felder: ${t && Object.keys(t).join(',')}`);
  }

  // L10 — Playlist über die seit Feb 2026 gültigen Endpunkte
  {
    const { api, calls } = makeApi([
      [/\/me\/playlists$/, () => resp(201, { id: 'PL1' })],
      [/\/playlists\/PL1\/items$/, () => resp(201, { snapshot_id: 's' })],
    ]);
    const uris = Array.from({ length: 150 }, (_, i) => 'spotify:track:' + i);
    await api.createPlaylist('Test', 'desc', uris);
    const posts = calls.filter(c => c.method === 'POST').map(c => c.url.replace('https://api.spotify.com/v1', ''));
    check('L10 Playlist: POST /me/playlists + /playlists/{id}/items (in 100er-Blöcken)',
      posts.join(' ') === '/me/playlists /playlists/PL1/items /playlists/PL1/items', posts.join(' '));
  }

  // L11 — Login fragt die Playlist-Berechtigungen an
  {
    const { api, win } = makeApi([], { loggedIn: false });
    await api.startLogin();
    const scope = new URL(win.location.href).searchParams.get('scope') || '';
    check('L11 Login-Scopes enthalten playlist-modify-private/-public',
      scope.includes('playlist-modify-private') && scope.includes('playlist-modify-public'), scope);
  }

  // L12 — Erschöpfte Diskografie → Sperre wird zurückgesetzt
  {
    const { api } = makeApi([
      [/\/artists\/A1\/albums/, () => resp(200, { items: [album('AL1', 'Album', 2)] })],
      [/\/albums\/AL1\/tracks/, () => resp(200, { items: [track('T1', 'Song 1'), track('T2', 'Song 2')] })],
    ]);
    const hist = { A1: ['T1', 'T2'] };
    const t = await api.getRandomTrack('A1', {}, new Set(), new Set(), false, hist);
    check('L12 Alle Songs gespielt → Reset, es wird weitergespielt', t && hist.A1.length === 0, `gewählt: ${t?.id}, Sperre danach: [${hist.A1}]`);
  }

  // L13 — Manipulierte IDs landen nicht in API-URLs
  {
    const { api, calls } = makeApi([[/./, () => resp(200, { items: [] })]]);
    const r1 = await api.getRandomTrack('../../me/player', {}, new Set(), new Set(), false, {});
    const r2 = await api.getAlbumTracks('x/../../me').catch(e => e.status);
    const leaked = calls.filter(c => c.url.includes('..') || c.url.includes('/me/player'));
    check('L13 Ungültige Spotify-IDs werden abgelehnt, bevor ein Request rausgeht', r1 === null && r2 === 400 && leaked.length === 0,
      `getRandomTrack=${r1}, getAlbumTracks=${r2}, Requests mit manipulierter ID: ${leaked.length}`);
  }

  // L14 — HTTP-Fehler tragen den Status (für den Geräte-Reconnect bei 404)
  {
    const { api } = makeApi([[/\/me\/player\/play/, () => resp(404, { error: { status: 404, message: 'Device not found' } })]]);
    const err = await api.playTrack('spotify:track:x', 'DEV1').catch(e => e);
    check('L14 Abspielen auf verschwundenem Gerät → Fehler mit status 404', err?.status === 404, `status=${err?.status}, msg=${err?.message}`);
  }

  // L15 — Sync-Requests schicken das Spotify-Token mit
  {
    const { api, calls } = makeApi([[/sync\.test\/api\/lists/, () => resp(200, { lists: [] })]]);
    const r = await api.syncFetch('/api/lists', { baseUrl: 'https://sync.test' });
    const c = calls.find(x => x.url.includes('sync.test'));
    check('L15 Sync-Requests mit Authorization: Bearer <Spotify-Token>', r && c?.headers?.Authorization === 'Bearer AT', `Header: ${c?.headers?.Authorization}`);
  }

  // L16 — Jeder in der App benutzte Übersetzungsschlüssel existiert auf Deutsch UND Englisch
  {
    const root = path.join(__dirname, '..');
    const c = { document: { querySelectorAll: () => [], documentElement: {}, dispatchEvent() {} }, CustomEvent: class {},
      localStorage: { getItem: () => null, setItem() {} }, navigator: { language: 'de' }, console };
    vm.createContext(c);
    vm.runInContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8') + ';this.I18N = I18N;', c);
    const files = ['app.js', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)];
    const code = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
      + fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const keys = new Set([...code.matchAll(/I18N\.t\('([a-z_0-9]+)'/g), ...code.matchAll(/'((?:msg|toast)_[a-z_0-9]+)'/g), ...code.matchAll(/data-i18n(?:-title)?="([a-z_0-9]+)"/g)].map(m => m[1]));
    const missing = [];
    for (const lang of ['de', 'en']) { c.I18N.setLang(lang); for (const k of keys) if (c.I18N.t(k) === k) missing.push(`${lang}:${k}`); }
    check('L16 Alle benutzten Übersetzungsschlüssel gibt es auf DE und EN', missing.length === 0,
      missing.length ? missing.join(', ') : `${keys.size} Schlüssel geprüft`);
  }

  process.exit(report('spotify-api.js') ? 1 : 0);
})().catch(e => { console.error('TESTFEHLER', e); process.exit(1); });
