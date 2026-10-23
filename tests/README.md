# Tests

🇩🇪 Regressionstests für Music Shuffle. **Nicht auf den Webserver/NAS kopieren** — nur fürs Repo.
🇬🇧 Regression tests for Music Shuffle. **Do not copy to the web server/NAS** — repo only.

| Datei / File | Prüft / Covers | Braucht / Needs |
|---|---|---|
| `logic.test.js` | `spotify-api.js` in einer Node-VM mit simuliertem Spotify: Cache bei Fehlern, Song-Erkennung Single/Album, Gleichverteilung, Request-Anzahl bei kaltem Cache, Token-Refresh, Live-/Commentary-Filter, Playlist-Endpunkte, Scopes | Node ≥ 18 |
| `sync-server.test.js` | `sync-server/sync-server.js` im Temp-Ordner: atomare Writes, Cache-Pruning, Verschlankung, Validierung, Health, Neustart | Node ≥ 18 |
| `fairness.test.js` | Simuliert 600 Titel je Szenario mit der echten App: Artist-Wiederholung, Song-Sperre, Gleichverteilung (χ²) | Playwright + Chromium |
| `ui.test.js` | Komplette App im Headless-Chromium mit Fake-Web-Playback-SDK, gemockter Spotify-API und echtem Sync-Server | Playwright + Chromium |

```bash
cd tests
npm install                      # nur für die UI-Tests (Playwright)
npx playwright install chromium
npm test                         # alle Suiten / all suites
```

Ohne Playwright laufen `node tests/logic.test.js` und `node tests/sync-server.test.js` direkt.
Without Playwright, run `node tests/logic.test.js` and `node tests/sync-server.test.js` directly.

Eigenes Chromium / custom Chromium: `CHROMIUM_PATH=/pfad/zu/chrome npm run test:ui`
