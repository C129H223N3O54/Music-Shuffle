// Fairness-Test: die echte App im Headless-Chromium, Spotify gemockt, 10 Artists mit
// 12–200 Songs. Ablauf wie in echt (Weiter → Queue/Shuffle → SDK meldet Titel → Verlauf).
// Prüft: Artist-Wiederholung, Song-Sperre, Gleichverteilung über Artists und Songs.
// Start: node tests/fairness.test.js   (optional: CHROMIUM_PATH=…, STEPS=1200)
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { check, report } = require('./harness');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const PORT = 38600 + Math.floor(Math.random() * 300);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const STEPS = +process.env.STEPS || 600;
const LIMIT = 3;

const web = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith('/music-shuffle/')) { res.writeHead(404); return res.end(); }
  p = p.slice('/music-shuffle/'.length) || 'index.html';
  if (p === 'config.js') { res.writeHead(200, { 'Content-Type': 'application/javascript' }); return res.end(`window.SPOTIFY_CONFIG={clientId:'cid',redirectUri:'${ORIGIN}/music-shuffle/',syncUrl:null};`); }
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  let data; try { data = fs.readFileSync(file); } catch { res.writeHead(404); return res.end(); }
  // Drosselung (1 Request/s) im Test aus
  if (p === 'spotify-api.js') data = Buffer.from(String(data).replace('const MIN_INTERVAL = 1000;', 'const MIN_INTERVAL = 0;'));
  res.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'application/javascript' : p.endsWith('.css') ? 'text/css' : 'text/html' });
  res.end(data);
});

// Katalog: Alben à 12 Songs + je eine Single (= Song 0 als „Radio Edit")
const SIZES = [12, 20, 30, 45, 60, 80, 100, 130, 160, 200];
const CAT = {}, TRACKS = {};
SIZES.forEach((n, i) => {
  const a = 'A' + i, albums = [], art = [{ id: a, name: 'Artist ' + i, uri: 'spotify:artist:' + a }];
  for (let k = 0; k * 12 < n; k++) {
    const id = `${a}AL${k}`, cnt = Math.min(12, n - k * 12);
    albums.push({ id, name: `${a} Album ${k}`, album_type: 'album', release_date: '2020-01-01', total_tracks: cnt, images: [] });
    TRACKS[id] = Array.from({ length: cnt }, (_, j) => ({ id: `${a}T${k * 12 + j}`, name: `${a} Song ${k * 12 + j}`, uri: `spotify:track:${a}T${k * 12 + j}`, duration_ms: 200000, artists: art }));
  }
  albums.push({ id: `${a}SG`, name: `${a} Song 0`, album_type: 'single', release_date: '2019-01-01', total_tracks: 1, images: [] });
  TRACKS[`${a}SG`] = [{ id: `${a}S0`, name: `${a} Song 0 - Radio Edit`, uri: `spotify:track:${a}S0`, duration_ms: 200000, artists: art }];
  CAT[a] = albums;
});
const ALL = Object.values(TRACKS).flat();
const FAKE_SDK = `window.Spotify={Player:class{constructor(o){this.l={};window.__p=this}addListener(e,c){(this.l[e]=this.l[e]||[]).push(c)}
connect(){setTimeout(()=>(this.l.ready||[]).forEach(c=>c({device_id:'DEV1'})),20);return Promise.resolve(true)}disconnect(){}
pause(){return Promise.resolve()}resume(){return Promise.resolve()}setVolume(){return Promise.resolve()}getCurrentState(){return Promise.resolve(null)}}};
window.__emit=s=>(window.__p.l.player_state_changed||[]).forEach(c=>c(s));`;

async function simulate(browser, { smart, albums = [] }) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.route('https://sdk.scdn.co/**', r => r.fulfill({ contentType: 'application/javascript', body: FAKE_SDK }));
  await page.route('https://i.scdn.co/**', r => r.fulfill({ status: 404, body: '' }));
  await page.route('https://api.spotify.com/**', async route => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname.replace('/v1', '');
    const json = (b, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(b) });
    let m;
    if (p === '/me') return json({ id: 'kampfmade', images: [] });
    if (p === '/me/player/devices') return json({ devices: [{ id: 'DEV1', name: 'Music Shuffle', type: 'Computer', is_active: true }] });
    if ((m = p.match(/^\/artists\/(\w+)\/albums$/))) { const o = +u.searchParams.get('offset') || 0; return json({ items: (CAT[m[1]] || []).slice(o, o + 10) }); }
    if ((m = p.match(/^\/albums\/(\w+)\/tracks$/))) return json({ items: TRACKS[m[1]] || [] });
    if (p === '/me/player/play') {
      const t = ALL.find(x => x.uri === JSON.parse(req.postData() || '{}').uris?.[0]);
      await route.fulfill({ status: 204, body: '' });
      if (t) await page.evaluate(t => window.__emit({ paused: false, position: 0, duration: 200000,
        track_window: { current_track: { id: t.id, name: t.name, uri: t.uri, artists: t.artists, album: { name: 'x', uri: 'spotify:album:x', images: [] } }, previous_tracks: [], next_tracks: [] } }), t).catch(() => {});
      return;
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(([artists, albums, limit]) => {
    if (sessionStorage.getItem('i')) return; sessionStorage.setItem('i', 1);
    localStorage.setItem('spotify_auth', JSON.stringify({ accessToken: 'AT', tokenExpiry: Date.now() + 3600e3, refreshToken: 'RT' }));
    localStorage.setItem('as_lists', JSON.stringify([{ id: 'l1', name: 'Sim', artists, albums, genres: [], filters: { noRepeat: true, artistRepeatLimit: limit } }]));
    localStorage.setItem('as_active_list', 'l1');
  }, [SIZES.map((_, i) => ({ id: 'A' + i, name: 'Artist ' + i, images: [], genres: [] })), albums, LIMIT]);
  await page.goto(`${ORIGIN}/music-shuffle/`);
  await page.waitForFunction(() => typeof State !== 'undefined' && State.activeDeviceId, null, { timeout: 15000 });

  const seq = await page.evaluate(async ({ steps, smart }) => {
    State.smartShuffle = smart; State.roundRobin = false;
    // Wartezeiten der App verkürzen; die fillQueue-Timer übernimmt die Simulation
    const realST = window.setTimeout;
    window.setTimeout = (fn, ms, ...a) => (ms === 5000 || ms === 20000) ? 0 : realST(fn, ms === 1000 ? 0 : ms, ...a);
    const out = [];
    for (let i = 0; i < steps; i++) {
      const before = State.history.length + ':' + State.currentTrack?.id;
      await playNextFromQueue();
      for (let w = 0; w < 100 && (State.history.length + ':' + State.currentTrack?.id) === before; w++) await new Promise(r => realST(r, 5));
      out.push({ a: State.currentTrack.artistId, n: State.currentTrack.name.replace(' - Radio Edit', '') });
      State.stats.plays.forEach(p => { p.ts -= 4 * 60000; }); // 4 Minuten pro Titel
      await fillQueue();
    }
    return out;
  }, { steps: STEPS, smart });
  await ctx.close();
  return seq;
}

function analyze(seq) {
  let repeat = 0, early = 0, minGap = Infinity;
  const last = {}, cnt = {}, songs = {}, cycle = {};
  seq.forEach((s, i) => {
    if (last[s.a] !== undefined) { const gap = i - last[s.a]; minGap = Math.min(minGap, gap); if (gap <= LIMIT) repeat++; }
    last[s.a] = i;
    cnt[s.a] = (cnt[s.a] || 0) + 1;
    (songs[s.a] = songs[s.a] || {})[s.n] = (songs[s.a][s.n] || 0) + 1;
    const c = cycle[s.a] = cycle[s.a] || new Set(), size = SIZES[+s.a.slice(1)];
    if (c.has(s.n)) { if (c.size < size) early++; else c.clear(); }
    c.add(s.n);
  });
  const artists = Object.keys(cnt), exp = seq.length / SIZES.length;
  const chi2 = artists.reduce((x, a) => x + (cnt[a] - exp) ** 2 / exp, 0);
  const spread = Math.max(...artists.map(a => { const v = Object.values(songs[a]); return v.length < SIZES[+a.slice(1)] ? Math.max(...v) : Math.max(...v) - Math.min(...v); }));
  return { repeat, early, minGap, chi2: +chi2.toFixed(1), spread, shares: artists.sort().map(a => cnt[a]).join('/') };
}

(async () => {
  await new Promise(r => web.listen(PORT, '127.0.0.1', r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const CHI2_95 = 16.92; // 9 Freiheitsgrade

  for (const [label, smart] of [['Smart Shuffle', true], ['Zufall', false]]) {
    const r = analyze(await simulate(browser, { smart }));
    check(`F ${label}: kein Artist innerhalb von ${LIMIT} Titeln doppelt, kein Song doppelt vor Ende der Diskografie, gleich verteilt`,
      r.repeat === 0 && r.early === 0 && r.chi2 < CHI2_95 && r.spread <= 1,
      `${STEPS} Titel — Wiederholungen: ${r.repeat}, kleinster Abstand: ${r.minGap}, Song zu früh doppelt: ${r.early}, χ²=${r.chi2} (<${CHI2_95}), Plays/Song-Spanne ≤ ${r.spread}, Anteile ${r.shares}`);
  }

  const albums = [0, 1].map(k => ({ id: `A3AL${k}`, name: `A3 Album ${k}`, artistId: 'A3', artistName: 'Artist 3', release_date: '2020-01-01', album_type: 'album', images: [] }));
  const r = analyze(await simulate(browser, { smart: true, albums }));
  check(`F Liste mit Alben: Album-Einträge halten Artist-Wiederholung und Song-Sperre ein`,
    r.repeat === 0 && r.early <= STEPS * 0.02,
    `${STEPS} Titel — Wiederholungen: ${r.repeat}, kleinster Abstand: ${r.minGap}, Song zu früh doppelt: ${r.early} (Album ausgeschöpft), Anteile ${r.shares}`);

  await browser.close(); web.close();
  process.exit(report('Fairness (Chromium)') ? 1 : 0);
})().catch(e => { console.error('TESTFEHLER', e); web.close(); process.exit(1); });
