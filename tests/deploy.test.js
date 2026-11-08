// Test für deploy/update.sh mit einem Test-Remote (Bare-Repo) und einem Docker-Stub.
// Prüft: ohne Änderung → nichts tun; mit Änderung → pull + build; --force; git über
// alpine/git-Container; data/ wird angelegt und nie angefasst; LF-Zeilenenden.
// Start: node tests/deploy.test.js   (braucht sh + git)
'use strict';
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { check, report } = require('./harness');

const ROOT = path.join(__dirname, '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'ms-deploy-'));
const ORIGIN = path.join(T, 'origin.git'), WORK = path.join(T, 'work'), NAS = path.join(T, 'nas', 'music-shuffle');
const BIN = path.join(T, 'bin'), STUB_LOG = path.join(T, 'docker.log');
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=t@t', ...a], { cwd, encoding: 'utf8' }).trim();

// Docker-Stub: protokolliert Aufrufe; „docker run … alpine/git …“ führt echtes git im gemounteten Ordner aus
fs.mkdirSync(BIN);
fs.writeFileSync(path.join(BIN, 'docker'), `#!/bin/sh
echo "docker $*" >> "${STUB_LOG}"
if [ "$1" = "run" ]; then
  shift; dir=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --rm) shift ;;
      -v) dir="\${2%%:/git}"; shift 2 ;;
      -w) shift 2 ;;
      alpine/git) shift; cd "$dir" && exec git "$@" ;;
      *) shift ;;
    esac
  done
  exit 1
fi
[ "$1" = "compose" ] && [ "$2" = "version" ] && { echo "Docker Compose version v2.20.1"; exit 0; }
exit 0
`, { mode: 0o755 });

const run = (args = [], env = {}) => {
  fs.writeFileSync(STUB_LOG, '');
  const r = spawnSync('sh', [path.join(NAS, 'deploy', 'update.sh'), ...args], {
    encoding: 'utf8', env: { ...process.env, PATH: `${BIN}:${process.env.PATH}`, HEALTH_URL, ...env },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || ''), docker: fs.readFileSync(STUB_LOG, 'utf8') };
};

let HEALTH_URL;
(async () => {
  // Health-Server als eigener Prozess (spawnSync blockiert diesen Prozess während update.sh läuft)
  const health = require('child_process').spawn(process.execPath, ['-e',
    `require('http').createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end('{"status":"ok","version":"9.9.9","auth":"on"}')}).listen(0,'127.0.0.1',function(){console.log(this.address().port)})`]);
  const hport = await new Promise(r => health.stdout.once('data', d => r(String(d).trim())));
  HEALTH_URL = `http://127.0.0.1:${hport}/api/health`;

  // Test-Remote mit den echten Deploy-Dateien
  fs.mkdirSync(WORK, { recursive: true });
  git(T, 'init', '-q', '--bare', '-b', 'main', ORIGIN);
  git(WORK, 'init', '-q', '-b', 'main');
  for (const f of ['deploy/update.sh', 'deploy/env.example', 'docker-compose.yml', 'Dockerfile', '.gitignore', '.gitattributes']) {
    fs.mkdirSync(path.join(WORK, path.dirname(f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(WORK, f));
  }
  fs.writeFileSync(path.join(WORK, 'README.md'), 'v1\n');
  git(WORK, 'add', '-A'); git(WORK, 'commit', '-q', '-m', 'Erster Stand');
  git(WORK, 'remote', 'add', 'origin', ORIGIN); git(WORK, 'push', '-q', 'origin', 'main');
  fs.mkdirSync(path.dirname(NAS), { recursive: true });
  git(path.dirname(NAS), 'clone', '-q', ORIGIN, NAS);

  // D0 — Zeilenenden: update.sh darf kein CR enthalten
  const sh = fs.readFileSync(path.join(ROOT, 'deploy', 'update.sh'), 'utf8');
  check('D0 update.sh hat LF-Zeilenenden und .gitattributes erzwingt eol=lf',
    !sh.includes('\r') && /\* text=auto eol=lf/.test(fs.readFileSync(path.join(ROOT, '.gitattributes'), 'utf8')));

  // D1 — ohne Änderung: nichts tun
  let r = run();
  check('D1 Ohne neuen Commit: kein Build, kein Docker-Aufruf', r.code === 0 && /Keine Änderung/.test(r.out) && !/compose .*up/.test(r.docker),
    r.out.split('\n').filter(Boolean).slice(-1)[0]);

  // D2 — neuer Commit: pull + build + prune + Health
  fs.writeFileSync(path.join(WORK, 'README.md'), 'v2\n');
  git(WORK, 'commit', '-q', '-am', 'Neue Version'); git(WORK, 'push', '-q', 'origin', 'main');
  const newHead = git(WORK, 'rev-parse', '--short', 'HEAD');
  fs.mkdirSync(path.join(NAS, 'data'), { recursive: true });
  fs.writeFileSync(path.join(NAS, 'data', 'lists.json'), '{"lists":["meine"]}');
  r = run();
  const pulled = fs.readFileSync(path.join(NAS, 'README.md'), 'utf8') === 'v2\n';
  check('D2 Neuer Commit: pull, dann compose -p music-shuffle up -d --build, image prune, Health-Check',
    r.code === 0 && pulled && /compose -p music-shuffle up -d --build/.test(r.docker) && /image prune -f/.test(r.docker)
      && new RegExp(`→ ${newHead} Neue Version`).test(r.out) && /Health-Check OK: .*9\.9\.9/.test(r.out),
    r.out.split('\n').filter(l => /Update:|Health|Fertig|FEHLER/.test(l)).join(' | '));

  // D3 — Laufzeitdaten bleiben, .env wird angelegt, data/ ist ignoriert
  const status = git(NAS, 'status', '--porcelain');
  check('D3 data/ bleibt erhalten, data/.env aus Vorlage, Git sieht data/ nicht',
    fs.readFileSync(path.join(NAS, 'data', 'lists.json'), 'utf8') === '{"lists":["meine"]}' && fs.existsSync(path.join(NAS, 'data', '.env')) && status === '',
    `git status: "${status}"`);

  // D4 — data/ fehlt komplett → wird vor dem Start angelegt
  fs.rmSync(path.join(NAS, 'data'), { recursive: true });
  r = run(['--force']);
  check('D4 --force ohne neuen Commit baut neu; fehlendes data/ wird angelegt',
    r.code === 0 && /erzwungen/.test(r.out) && /up -d --build/.test(r.docker) && fs.existsSync(path.join(NAS, 'data', '.env')));

  // D5 — ohne git: über Wegwerf-Container alpine/git
  fs.writeFileSync(path.join(WORK, 'README.md'), 'v3\n');
  git(WORK, 'commit', '-q', '-am', 'Version drei'); git(WORK, 'push', '-q', 'origin', 'main');
  r = run([], { USE_DOCKER_GIT: '1' });
  check('D5 Ohne git: docker run --rm -v …:/git -w /git alpine/git -c safe.directory=* pull --ff-only',
    r.code === 0 && /git: alpine\/git/.test(r.out) && /run --rm -v .*:\/git -w \/git alpine\/git -c safe.directory=\* pull --ff-only/.test(r.docker)
      && fs.readFileSync(path.join(NAS, 'README.md'), 'utf8') === 'v3\n' && /up -d --build/.test(r.docker));

  // D6 — lokale Änderung blockiert Fast-Forward → klarer Fehler, kein Build
  fs.writeFileSync(path.join(NAS, 'README.md'), 'lokal geändert\n');
  git(NAS, 'commit', '-q', '-am', 'lokal');
  fs.writeFileSync(path.join(WORK, 'README.md'), 'v4\n');
  git(WORK, 'commit', '-q', '-am', 'Version vier'); git(WORK, 'push', '-q', 'origin', 'main');
  r = run();
  check('D6 Nicht fast-forward-fähig → Abbruch mit Hinweis, kein Build', r.code === 1 && /fast-forward/.test(r.out) && !/up -d/.test(r.docker),
    r.out.split('\n').filter(l => /FEHLER/.test(l))[0]);

  // D7 — zweiter gleichzeitiger Lauf wird übersprungen
  fs.mkdirSync(path.join(NAS, '.update.lock'));
  r = run(['--force']);
  fs.rmdirSync(path.join(NAS, '.update.lock'));
  check('D7 Läuft schon ein Update, bricht ein zweiter Lauf sauber ab', r.code === 0 && /läuft bereits/.test(r.out) && !r.docker);

  // D8 — Dockerfile: alle COPY-Quellen existieren, alles was index.html/Service Worker laden, ist im Image
  {
    const df = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8').replace(/\\\n/g, ' ');
    const copied = [];
    for (const m of df.matchAll(/^COPY\s+(.+)$/gm)) { const parts = m[1].trim().split(/\s+/); parts.pop(); copied.push(...parts); }
    const missing = copied.filter(f => !fs.existsSync(path.join(ROOT, f)));
    const inImage = f => copied.some(c => c === f || (c.endsWith('/') && f.startsWith(c)));
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'service-worker.js'), 'utf8');
    const needed = [...html.matchAll(/(?:src|href)="([^"#:]+?)"/g), ...sw.matchAll(/'\/music-shuffle\/([^']+)'/g)].map(m => m[1])
      .filter(f => f && f !== 'config.js' && !f.startsWith('http') && /\.(js|css|png|svg|ico|json|html)$/.test(f));
    const notInImage = [...new Set(needed)].filter(f => !inImage(f));
    check('D8 Dockerfile: alle COPY-Quellen vorhanden, alle von index.html/Service Worker geladenen Dateien im Image',
      missing.length === 0 && notInImage.length === 0, `fehlt im Repo: ${missing.join(', ') || '—'}; fehlt im Image: ${notInImage.join(', ') || '—'}`);
  }

  health.kill();
  fs.rmSync(T, { recursive: true, force: true });
  process.exit(report('deploy/update.sh') ? 1 : 0);
})().catch(e => { console.error('TESTFEHLER', e); process.exit(1); });
