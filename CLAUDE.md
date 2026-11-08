# Music Shuffle — Hinweise für Claude

Self-hosted Spotify-PWA (Vanilla JS, kein Build-Schritt) von JEM. Antworten auf Deutsch, knapp.

## Aufbau
- `index.html` lädt der Reihe nach: `i18n.js`, Spotify-SDK, `config.js`, `spotify-api.js`, `js/core.js`, `js/sync.js`, `js/player.js`, `js/shuffle.js`, `js/lists.js`, `js/ui.js`, `js/changelog.js`, `app.js` (Einstieg).
- Klassische Skripte: Top-Level-Funktionen/-Konstanten sind dateiübergreifend global. Keine doppelten `const`-Namen.
- `sync-server/sync-server.js` = Node-Server: Sync-API (`/api/*`) **und** Auslieferung der Web-App (`/music-shuffle/`, `config.js` aus `data/`). Ein Container `music-shuffle` (`Dockerfile`, `docker-compose.yml`), Port `127.0.0.1:3001`.
- Laufzeitdaten + Konfiguration (`*.json`, `config.js`, `.env`) liegen in `data/` (Volume, `.gitignore`) — nie ins Repo.
- `/api/health` meldet `APP_VERSION` aus `js/core.js`; die App zeigt bei neuerer Server-Version „vX laden ↻“.
- Alle sichtbaren Texte über `I18N.t('key', { vars })` bzw. `data-i18n` / `data-i18n-title`; jeder Schlüssel DE **und** EN in `i18n.js`.

## Tests (vor jedem Release, alle müssen grün sein)
```
cd tests && npm install && npx playwright install chromium   # einmalig
node tests/run-all.js
```

## Release-Checkliste
1. `APP_VERSION` in `js/core.js`
2. Eintrag oben in `js/changelog.js` (DE + EN) und in `CHANGELOG.md` (EN)
3. `CACHE_NAME` in `service-worker.js`; neue Dateien in `STATIC_ASSETS`
4. Version-Badge in `README.md` und `README_de.md`
5. Tests grün (`L18` prüft 1–4) → Commit auf `main` (per PR) → Release-Text für `vX.Y.Z` an JEM
6. Die NAS holt den Commit selbst (`deploy/update.sh` im Aufgabenplaner) — nichts hochladen. Nur bei Änderungen an `data/`-Formaten oder `.env` JEM Hinweise geben.

## Deployment (NAS) — siehe `DEPLOY.md`
- Pfad `/volume1/docker/music-shuffle` (git-Klon), Update: `sh deploy/update.sh` (Aufgabenplaner „Music Shuffle Update“, root). Kein git auf der NAS → `alpine/git`-Container.
- App: `https://shuffle.jem.rocks:8443/music-shuffle/`, Sync-API: `https://sync.jem.rocks:9443` → beide Reverse Proxy auf `localhost:3001`.
- `data/.env`: `ALLOWED_USERS=kampfmade`, `ALLOWED_ORIGINS=https://shuffle.jem.rocks:8443`.
- SSH-Befehle für JEM immer in EINER Zeile (keine `\`-Umbrüche).
