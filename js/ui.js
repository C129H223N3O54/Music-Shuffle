/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/ui.js
   Track-Listen, Shuffle-Log, Statistiken, Theme, Tastatur, PWA, Changelog-Dialog
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── PWA ───────────────────────────────────────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  if (!document.getElementById('app')?.classList.contains('hidden')) showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById('pwa-install-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `<p>${I18N.t('pwa_install')}</p>
    <button class="btn-primary" id="pwa-install-btn">${I18N.t('pwa_install_btn')}</button>
    <button class="pwa-install-close" id="pwa-close-btn">✕</button>`;
  document.body.appendChild(banner);
  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (!_deferredPrompt) return;
    _deferredPrompt.prompt();
    const r = await _deferredPrompt.userChoice;
    if (r.outcome === 'accepted') showToast(I18N.t('pwa_installed'), 'success');
    _deferredPrompt = null; banner.remove();
  });
  document.getElementById('pwa-close-btn').addEventListener('click', () => banner.remove());
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/music-shuffle/service-worker.js')
      .then(r => console.log('[SW] Registered:', r.scope))
      .catch(e => console.warn('[SW] Failed:', e));
  });
}

// ── TRACK ITEM ────────────────────────────────────────────────────────────────
function createTrackItem(track, num, actions = []) {
  const item = document.createElement('div');
  item.className = 'track-item';
  const artist = track.artist || track.artists?.[0]?.name || '';
  const img    = track.albumArt || track.album?.images?.[0]?.url || '';
  item.innerHTML = `
    <span class="track-item-num">${num}</span>
    <img class="track-item-img" src="${safeUrl(img)}" alt="" />
    <div class="track-item-info">
      <div class="track-item-name">${escHtml(track.name)}</div>
      <div class="track-item-artist">${escHtml(artist)}</div>
    </div>
    <div class="track-item-actions">${actions.map(a => `<button class="btn-icon" title="${escHtml(a.title)}">${a.icon}</button>`).join('')}</div>`;
  actions.forEach((a, i) => item.querySelectorAll('.track-item-actions .btn-icon')[i]?.addEventListener('click', e => { e.stopPropagation(); a.action(); }));
  return item;
}

// ── SHUFFLE LOG ───────────────────────────────────────────────────────────────
function renderShuffleLog() {
  const list  = document.getElementById('shufflelog-list');
  const empty = document.getElementById('shufflelog-empty');
  if (!list) return;
  list.innerHTML = '';
  if (!State.shuffleLog.length) { empty?.classList.remove('hidden'); if (empty) empty.innerHTML = `<p>${I18N.t('log_empty')}</p>`; return; }
  empty?.classList.add('hidden');
  State.shuffleLog.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'track-item';
    const time = new Date(entry.ts).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    item.innerHTML = `
      <span class="track-item-num" style="font-size:0.7rem;min-width:38px">${time}</span>
      <div class="track-item-info">
        <div class="track-item-name">${escHtml(entry.trackName)}</div>
        <div style="font-size:0.72rem;color:var(--text3);margin-top:2px">${escHtml(entry.artistName)} &nbsp;<span style="color:var(--accent);font-weight:600">${escHtml(entry.reason)}</span></div>
      </div>`;
    list.appendChild(item);
  });
}

// ── STATS ──────────────────────────────────────────────────────────────────────
function trackPlay(track) {
  State.stats.plays.push({ trackId: track.id, trackName: track.name, artistId: track.artistId, artistName: track.artist, ts: Date.now(), duration: track.duration || 0 });
  LS.saveStatsDebounced();
  renderStats();
}

function renderStats() {
  const rangeEl = document.getElementById('stats-range');
  const range   = parseInt(rangeEl?.value || '30', 10);
  const since   = isNaN(range) ? 0 : Date.now() - range * 86400000;
  const plays   = State.stats.plays.filter(p => !since || p.ts >= since);

  document.getElementById('stat-total-plays').textContent = plays.length;
  document.getElementById('stat-shuffles').textContent    = State.stats.shuffles;
  const totalMs = plays.reduce((s, p) => s + (p.duration || 0), 0);
  document.getElementById('stat-total-time').textContent  = totalMs >= 3600000 ? (totalMs/3600000).toFixed(1)+'h' : Math.round(totalMs/60000)+'m';

  const artistCounts = {};
  plays.forEach(p => { if (p.artistName) artistCounts[p.artistName] = (artistCounts[p.artistName]||0)+1; });
  renderStatsBars('stats-top-artists', artistCounts, 5);

  const songCounts = {}, songArtists = {};
  plays.forEach(p => { if (!p.trackName) return; songCounts[p.trackName]=(songCounts[p.trackName]||0)+1; if(p.artistName) songArtists[p.trackName]=p.artistName; });
  const expandBtn = document.getElementById('stats-songs-expand');
  const expanded  = expandBtn?.dataset.expanded === '1';
  renderStatsBarsWithArtist('stats-top-songs', songCounts, songArtists, expanded ? 999 : 5);
  if (expandBtn) expandBtn.textContent = expanded ? (I18N.getLang()==='de'?'Weniger':'Show less') : (I18N.getLang()==='de'?'Alle anzeigen':'Show all');

  renderSessionsChart(plays);
}

function renderStatsBarsWithArtist(id, counts, artists, limit) {
  const el = document.getElementById(id);
  if (!el) return;
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, limit);
  const max    = sorted[0]?.[1] || 1;
  el.innerHTML = sorted.map(([name, count]) => `
    <div class="stat-bar-item">
      <div class="stat-bar-label">
        <span title="${escHtml(name)}">${escHtml(name)}${artists[name]?`<span style="color:var(--text3);font-weight:400"> · ${escHtml(artists[name])}</span>`:''}</span>
        <span style="flex-shrink:0">${count}×</span>
      </div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function renderStatsBars(id, counts, limit) {
  const el = document.getElementById(id);
  if (!el) return;
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, limit);
  const max    = sorted[0]?.[1] || 1;
  el.innerHTML = sorted.map(([name, count]) => `
    <div class="stat-bar-item">
      <div class="stat-bar-label"><span>${escHtml(name)}</span><span>${count}×</span></div>
      <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${(count/max*100).toFixed(1)}%"></div></div>
    </div>`).join('');
}

function renderSessionsChart(plays) {
  const el = document.getElementById('stats-sessions');
  if (!el) return;
  const weeks = Array(8).fill(0);
  const now   = Date.now();
  plays.forEach(p => { const w = Math.floor((now - p.ts) / (7 * 86400000)); if (w < 8) weeks[7-w]++; });
  const max = Math.max(...weeks, 1);
  el.innerHTML = weeks.map((v, i) => `<div class="stats-chart-bar" style="height:${(v/max*100).toFixed(1)}%" title="${escHtml(I18N.t('msg_week', { n: i + 1, songs: v }))}"></div>`).join('');
}

// ── KEYBOARD ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select, [contenteditable]')) return;
  // Browser-Shortcuts (Strg+F, Strg+P, Strg+N, Alt+…) nicht abfangen
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  // Nicht auf dem Login-Screen
  if (document.getElementById('app')?.classList.contains('hidden')) return;
  switch (e.code) {
    case 'Space':      e.preventDefault(); State.isPlaying ? State.player?.pause() : State.player?.resume(); break;
    case 'KeyN':       playNextFromQueue(); break;
    case 'KeyP':       playPrevFromHistory(); break;
    case 'KeyF':       toggleFullscreen(); break;
    case 'KeyB':       if (State.currentTrack) addToBlacklist(State.currentTrack); break;
    case 'KeyM':       toggleMute(); break;
    case 'ArrowUp':    e.preventDefault(); setVolume(State.volume + 5); break;
    case 'ArrowDown':  e.preventDefault(); setVolume(State.volume - 5); break;
    default:
      const idx = parseInt(e.code.replace('Digit', ''), 10) - 1;
      if (/^Digit[1-9]$/.test(e.code) && State.lists[idx]) switchActiveList(State.lists[idx].id);
  }
});


// ── SYNC STATUS ───────────────────────────────────────────────────────────────
function updateSyncStatus() {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;
  if (!Sync.url) { indicator.style.display = 'none'; return; }
  Sync.check().then(ok => {
    indicator.title      = I18N.t(ok ? 'msg_sync_active' : 'toast_sync_fail');
    indicator.style.color = ok ? 'var(--accent)' : 'var(--text3)';
  });
}

function updateLangBtn() {
  const label = document.getElementById('lang-label');
  if (label) label.textContent = I18N.getLang().toUpperCase();
}

// ── THEME ──────────────────────────────────────────────────────────────────
function getEffectiveTheme() {
  if (State.theme) return State.theme;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
}

function initTheme() {
  const saved = localStorage.getItem('as_theme');
  State.theme = saved || null;
  applyTheme(getEffectiveTheme());
  // System-Theme Änderungen beobachten
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!State.theme) applyTheme(getEffectiveTheme());
  });
}

function toggleTheme() {
  const current = getEffectiveTheme();
  State.theme = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('as_theme', State.theme);
  applyTheme(State.theme);
}

// ── CHANGELOG-DIALOG ──────────────────────────────────────────────────────────
function showChangelog() {
  const modal   = document.getElementById('modal-changelog');
  const content = document.getElementById('changelog-content');
  if (!modal || !content) return;
  const lang = I18N.getLang();
  const L    = { added: I18N.t('changelog_added'), changed: I18N.t('changelog_changed'), fixed: I18N.t('changelog_fixed'), removed: I18N.t('changelog_removed') };

  content.innerHTML = CHANGELOG.map(entry => {
    const label   = entry.label?.[lang] || entry.label?.en || '';
    const added   = entry.added?.[lang]   || entry.added?.en   || [];
    const changed = entry.changed?.[lang] || entry.changed?.en || [];
    const fixed   = entry.fixed?.[lang]   || entry.fixed?.en   || [];
    const removed = entry.removed?.[lang] || entry.removed?.en || [];
    const MARK = { 'var(--accent)': '+', '#f0a500': '~', '#e74c3c': '✓', 'var(--text3)': '−' };
    const section = (title, items, color) => items.length ? `
      <div style="font-size:0.75rem;font-weight:700;color:var(--text2);margin:10px 0 6px;text-transform:uppercase;letter-spacing:0.05em">${title}</div>
      <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px">
        ${items.map(i => `<li style="display:flex;gap:8px;font-size:0.8rem;color:var(--text2)"><span style="color:${color};flex-shrink:0">${MARK[color] || '•'}</span><span>${escHtml(i)}</span></li>`).join('')}
      </ul>` : '';
    return `
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <span style="font-size:1rem;font-weight:800;color:var(--text)">v${entry.version}</span>
          <span style="font-size:0.75rem;color:var(--accent);font-weight:700;background:var(--accent-glow);padding:2px 8px;border-radius:20px">${escHtml(label)}</span>
          <span style="font-size:0.72rem;color:var(--text3);margin-left:auto">${entry.date}</span>
        </div>
        ${section(L.added,   added,   'var(--accent)')}
        ${section(L.changed, changed, '#f0a500')}
        ${section(L.fixed,   fixed,   '#e74c3c')}
        ${section(L.removed, removed, 'var(--text3)')}
      </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">');

  modal.classList.remove('hidden');
}
