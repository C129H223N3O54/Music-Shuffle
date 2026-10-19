// Regressionstests für sync-server/sync-server.js — startet den Server in einem Temp-Ordner.
// Start: node tests/sync-server.test.js
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), http = require('http');
const { check, report } = require('./harness');

const PORT = 39000 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-sync-'));
const F = n => path.join(DIR, n);
const DAY = 24 * 3600e3;

// Vorhandener (alter, aufgeblähter) Track-Cache: 1 frischer + 1 abgelaufener Eintrag
fs.writeFileSync(F('tracks.json'), JSON.stringify({ cache: {
  FRESH: { ts: Date.now(), tracks: [{ id: 't1', name: 'Song', uri: 'u', available_markets: Array(180).fill('DE'), external_urls: { spotify: 'x' }, artists: [{ id: 'a', name: 'A', href: 'h' }], album: { name: 'Alb', release_date: '2020', album_type: 'album', images: [] } }] },
  OLD:   { ts: Date.now() - 2 * DAY, tracks: [{ id: 't2', name: 'Alt' }] },
} }, null, 2));

function start(extraEnv = {}, port = PORT, dir = DIR) {
  const F = n => path.join(dir, n);
  const env = { ...process.env, ...extraEnv, PORT: String(port), DATA_FILE: F('lists.json'), STATS_FILE: F('stats.json'), CACHE_FILE: F('cache.json'),
    BLACKLIST_FILE: F('blacklist.json'), TRACKS_FILE: F('tracks.json'), HISTORY_FILE: F('track-history.json') };
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'sync-server', 'sync-server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((res, rej) => {
    p.stdout.on('data', d => { if (String(d).includes('läuft auf Port')) res(p); });
    p.on('exit', c => rej(new Error('Server beendet: ' + c)));
    setTimeout(() => rej(new Error('Server-Start Timeout')), 5000);
  });
}
const req = async (method, p, body, headers = {}, base = BASE) => {
  const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, headers: r.headers, json: await r.json().catch(() => null) };
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let srv = await start();

  // S1 Beim Start: abgelaufene Einträge raus, Rest verschlankt + kompakt
  {
    const disk = fs.readFileSync(F('tracks.json'), 'utf8');
    const d = JSON.parse(disk);
    check('S1 Start: abgelaufene Cache-Einträge entfernt, Tracks verschlankt, kompakt gespeichert',
      d.cache.FRESH && !d.cache.OLD && !('available_markets' in d.cache.FRESH.tracks[0]) && !disk.includes('\n  '),
      `Einträge: ${Object.keys(d.cache).join(',')}, Größe ${disk.length} B`);
  }

  // S2 history:null wird abgelehnt
  {
    const r1 = await req('POST', '/api/track-history', { history: null });
    const r2 = await req('POST', '/api/track-history', { history: { A1: ['t1'] } });
    const r3 = await req('POST', '/api/track-history', { history: ['x'] });
    check('S2 Track-History: null/Array → 400, Objekt → 200', r1.status === 400 && r2.status === 200 && r3.status === 400,
      `null=${r1.status}, Objekt=${r2.status}, Array=${r3.status}`);
  }

  // S3 Leere Album-Liste wird nicht gespeichert
  {
    await req('POST', '/api/cache', { artistId: 'EMPTY', albums: [], ts: Date.now() });
    await req('POST', '/api/cache', { artistId: 'A1', albums: [{ id: 'AL1', name: 'X', available_markets: ['DE'], total_tracks: 3 }], ts: Date.now() });
    const g = await req('GET', '/api/cache');
    check('S3 Album-Cache: leere Liste wird verworfen, Felder verschlankt',
      !g.json.cache.EMPTY && g.json.cache.A1 && !('available_markets' in g.json.cache.A1.albums[0]) && g.json.cache.A1.albums[0].total_tracks === 3,
      `Artists im Cache: ${Object.keys(g.json.cache).join(',')}`);
  }

  // S4 Abgelaufene POSTs landen nicht dauerhaft
  {
    await req('POST', '/api/tracks', { albumId: 'STALE', tracks: [{ id: 'x', name: 'x' }], ts: Date.now() - 2 * DAY });
    await req('POST', '/api/tracks', { albumId: 'NEW', tracks: [{ id: 'y', name: 'y' }], ts: Date.now() });
    await sleep(2500); // gebündeltes Schreiben abwarten
    const d = JSON.parse(fs.readFileSync(F('tracks.json'), 'utf8'));
    check('S4 Track-Cache: Abgelaufenes wird beim Schreiben entfernt', d.cache.NEW && !d.cache.STALE, Object.keys(d.cache).join(','));
  }

  // S5 Atomar: viele parallele Schreibvorgänge → Datei immer gültiges JSON, keine tmp-Reste
  {
    let bad = 0;
    const big = Array.from({ length: 3000 }, (_, i) => ({ id: 'L' + i, name: 'Liste ' + i, artists: [] }));
    const writes = Array.from({ length: 20 }, (_, i) => req('POST', '/api/lists', { lists: big.slice(0, 1000 + i * 100) }));
    const reader = (async () => { for (let i = 0; i < 60; i++) { try { if (fs.existsSync(F('lists.json'))) JSON.parse(fs.readFileSync(F('lists.json'), 'utf8')); } catch { bad++; } await sleep(2); } })();
    await Promise.all([...writes, reader]);
    const tmp = fs.readdirSync(DIR).filter(f => f.endsWith('.tmp'));
    check('S5 Atomare Writes: nie halbe JSON-Datei, keine .tmp-Reste', bad === 0 && tmp.length === 0, `ungültige Lesungen: ${bad}, tmp-Dateien: ${tmp.length}`);
  }

  // S6 Health mit Zählern
  {
    const h = await req('GET', '/api/health');
    check('S6 Health zeigt trackHistory/albumCache/trackCache', h.json.status === 'ok' && h.json.trackHistory === 1 && h.json.albumCache === 1 && h.json.trackCache >= 2,
      JSON.stringify(h.json));
  }

  // S7 Neustart: Daten bleiben erhalten (SIGTERM schreibt Cache weg)
  {
    await req('POST', '/api/tracks', { albumId: 'LAST', tracks: [{ id: 'z', name: 'z' }], ts: Date.now() });
    srv.kill('SIGTERM'); await new Promise(r => srv.on('exit', r));
    srv = await start();
    const g = await req('GET', '/api/tracks');
    const l = await req('GET', '/api/lists');
    check('S7 Nach Neustart: Cache (inkl. letztem Eintrag) und Listen vorhanden', g.json.cache.LAST && l.json.lists.length >= 1000,
      `Track-Cache: ${Object.keys(g.json.cache).join(',')}, Listen: ${l.json.lists.length}`);
  }

  srv.kill('SIGTERM'); await new Promise(r => srv.on('exit', r));

  // ═══ Mit Anmeldung (ALLOWED_USERS) ═══
  // Mini-„Spotify": /v1/me liefert je nach Token einen User
  let meCalls = 0;
  const TOKENS = { 'TOKEN_OWNER_xxxxxxxxxxxxxxxx': 'kampfmade', 'TOKEN_STRANGER_xxxxxxxxxxxxx': 'jemand' };
  const fake = http.createServer((q, r) => {
    meCalls++;
    const user = TOKENS[(q.headers.authorization || '').replace('Bearer ', '')];
    r.writeHead(user ? 200 : 401, { 'Content-Type': 'application/json' });
    r.end(JSON.stringify(user ? { id: user } : { error: { status: 401 } }));
  });
  await new Promise(r => fake.listen(PORT + 2, '127.0.0.1', r));
  const DIR2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-sync-auth-'));
  const PORT2 = PORT + 1, BASE2 = `http://127.0.0.1:${PORT2}`;
  srv = await start({ ALLOWED_USERS: 'KampfMade', ALLOWED_ORIGINS: 'https://shuffle.example', SPOTIFY_ME_URL: `http://127.0.0.1:${PORT + 2}/v1/me` }, PORT2, DIR2);
  const owner = { Authorization: 'Bearer TOKEN_OWNER_xxxxxxxxxxxxxxxx' };
  const stranger = { Authorization: 'Bearer TOKEN_STRANGER_xxxxxxxxxxxxx' };

  // S8 Ohne Token kein Zugriff, Health nur minimal
  {
    const r1 = await req('GET', '/api/lists', undefined, {}, BASE2);
    const r2 = await req('DELETE', '/api/lists', undefined, {}, BASE2);
    const h = await req('GET', '/api/health', undefined, {}, BASE2);
    check('S8 Ohne Anmeldung: Lesen/Löschen → 401, Health zeigt nur Status/Version',
      r1.status === 401 && r2.status === 401 && h.json.status === 'ok' && h.json.auth === 'on' && h.json.lists === undefined,
      `GET lists=${r1.status}, DELETE lists=${r2.status}, health=${JSON.stringify(h.json)}`);
  }

  // S9 Erlaubter User darf, fremder User nicht; Spotify wird pro Token nur einmal gefragt
  {
    meCalls = 0;
    const w = await req('POST', '/api/lists', { lists: [{ id: 'l1', name: 'Metal' }] }, owner, BASE2);
    const r = await req('GET', '/api/lists', undefined, owner, BASE2);
    const h = await req('GET', '/api/health', undefined, owner, BASE2);
    const f = await req('GET', '/api/lists', undefined, stranger, BASE2);
    const bad = await req('GET', '/api/lists', undefined, { Authorization: 'Bearer UNGUELTIG_xxxxxxxxxxxxxxxxx' }, BASE2);
    check('S9 Owner → 200, fremder Spotify-User → 403, ungültiges Token → 401, Prüfung gecacht',
      w.status === 200 && r.json.lists.length === 1 && h.json.lists === 1 && f.status === 403 && bad.status === 401 && meCalls === 3,
      `owner POST=${w.status} GET=${r.status}, fremd=${f.status}, ungültig=${bad.status}, Spotify-Abfragen=${meCalls} (für 3 Tokens)`);
  }

  // S10 CORS nur für die eigene App
  {
    const ok = await req('GET', '/api/health', undefined, { Origin: 'https://shuffle.example' }, BASE2);
    const evil = await req('GET', '/api/health', undefined, { Origin: 'https://evil.example' }, BASE2);
    check('S10 CORS: eigene App erlaubt, fremde Webseite nicht',
      ok.headers.get('access-control-allow-origin') === 'https://shuffle.example' && !evil.headers.get('access-control-allow-origin') && ok.headers.get('x-content-type-options') === 'nosniff',
      `eigene: ${ok.headers.get('access-control-allow-origin')}, fremd: ${evil.headers.get('access-control-allow-origin')}`);
  }

  // S11 Manipulierte IDs / kaputte Anfragen
  {
    const p1 = await req('POST', '/api/cache', { artistId: '__proto__', albums: [{ id: 'x' }] }, owner, BASE2);
    const p2 = await req('POST', '/api/tracks', { albumId: '../../etc', tracks: [{ id: 'x' }] }, owner, BASE2);
    const p3 = await req('POST', '/api/track-history', { history: { A1: ['t1'], '__proto__': ['x'], 'bad id': ['y'] } }, owner, BASE2);
    const hist = await req('GET', '/api/track-history', undefined, owner, BASE2);
    // Roh-Request mit kaputter URL darf den Server nicht abschießen
    let rawReply = '';
    await new Promise(res => {
      const sock = require('net').connect(PORT2, '127.0.0.1', () => sock.write('GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'));
      sock.on('data', d => { rawReply += d; sock.destroy(); res(); });
      sock.on('close', res); sock.on('error', res);
      setTimeout(() => { sock.destroy(); res(); }, 2000);
    });
    const alive = await req('GET', '/api/health', undefined, {}, BASE2).then(r => r.status).catch(() => 0);
    check('S11 Ungültige IDs abgelehnt/gefiltert, kaputte URL crasht den Server nicht',
      p1.status === 400 && p2.status === 400 && p3.status === 200 && Object.keys(hist.json.history).join() === 'A1' && alive === 200,
      `__proto__=${p1.status}, ../=${p2.status}, History-Keys=${Object.keys(hist.json.history)}, Server lebt=${alive === 200}, Antwort auf kaputte URL: ${rawReply.split('\r\n')[0]}`);
  }

  srv.kill('SIGTERM'); await new Promise(r => srv.on('exit', r));
  fake.close();
  fs.rmSync(DIR2, { recursive: true, force: true });
  fs.rmSync(DIR, { recursive: true, force: true });
  process.exit(report('sync-server.js') ? 1 : 0);
})().catch(e => { console.error('TESTFEHLER', e); fs.rmSync(DIR, { recursive: true, force: true }); process.exit(1); });
