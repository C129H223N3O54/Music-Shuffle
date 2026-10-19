# Music Shuffle — Hinweise für Claude

Self-hosted Spotify-PWA (Vanilla JS, kein Build-Schritt) von JEM. Antworten auf Deutsch, knapp.

## Aufbau
- `index.html` lädt der Reihe nach: `i18n.js`, Spotify-SDK, `config.js`, `spotify-api.js`, `js/core.js`, `js/sync.js`, `js/player.js`, `js/shuffle.js`, `js/lists.js`, `js/ui.js`, `js/changelog.js`, `app.js` (Einstieg).
- Klassische Skripte: Top-Level-Funktionen/-Konstanten sind dateiübergreifend global. Keine doppelten `const`-Namen.
- `sync-server/` = Node-Sync-Server (`sync-server.js` + `Dockerfile` + `SYNC-SERVER.md`), läuft auf der NAS als Container `artist-shuffle-sync`.
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
5. Tests grün → Commit → GitHub-Release `vX.Y.Z` mit Changelog-Text
6. JEM sagen, welche Dateien auf die NAS müssen (`/volume1/web/music-shuffle/`) und ob der Sync-Server neu gebaut werden muss

## Deployment (NAS)
- App: `https://shuffle.jem.rocks:8443/music-shuffle/` → nur Web-Dateien (kein `tests/`, `sync-server/`, `*.md`).
- Sync-Server: `/volume1/docker/artist-shuffle-sync/`, `https://sync.jem.rocks:9443`, Start mit `-p 127.0.0.1:3001:3001 -e ALLOWED_USERS=kampfmade -e ALLOWED_ORIGINS=https://shuffle.jem.rocks:8443`.
