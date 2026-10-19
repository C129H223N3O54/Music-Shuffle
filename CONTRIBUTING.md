# 🤝 Contributing — Music Shuffle

Danke für dein Interesse an Music Shuffle! Hier sind die Richtlinien für Beiträge.

---

## Grundregeln

- **Vanilla JS** — kein Framework, kein Build-Schritt, keine npm-Abhängigkeiten
- **Sideforge Design System** — alle UI-Änderungen nutzen `sideforge-tokens.css` Variablen
- **Keine externen Abhängigkeiten** — die App ist komplett statisch und selbst gehostet
- **Bilingual** — alle neuen UI-Strings in `i18n.js` auf Deutsch und Englisch

---

## Design System

Music Shuffle nutzt das [Sideforge Design System](https://github.com/C129H223N3O54/SideForge).

Farb-Tokens:
- Accent: `var(--accent)` / `var(--sf-ember-300)` — Ember Orange
- Backgrounds: `var(--bg)` bis `var(--bg5)` — Anvil Warm Grays
- Text: `var(--text)`, `var(--text2)`, `var(--text3)`
- Border: `var(--border)`

Schrift: **Verdana** — kein Webfont, keine externen Requests.

---

## Dateistruktur

| Datei | Zweck |
|-------|-------|
| `app.js` | Einstieg: Start, Login, Event-Verdrahtung |
| `js/core.js` | State, localStorage, Validierung, Hilfsfunktionen |
| `js/sync.js` | Sync-Server |
| `js/player.js` | Web Playback SDK, Geräte, Reconnect, Medientasten |
| `js/shuffle.js` | Shuffle, Queue, Verlauf, Blacklist |
| `js/lists.js` | Listen, Künstler, Alben, Genres, Suche, Filter |
| `js/ui.js` | Statistiken, Theme, Tastatur, PWA, Changelog-Dialog |
| `js/changelog.js` | In-App-Changelog |
| `spotify-api.js` | Spotify API Wrapper + OAuth PKCE |
| `i18n.js` | Übersetzungen DE/EN |
| `style.css` | Alle Styles (nutzt Sideforge-Tokens) |
| `sideforge-tokens.css` | Design System Tokens |
| `sync-server/` | Optionaler Node.js Sync-Server (`sync-server.js` + `Dockerfile` + Anleitung) |
| `tests/` | Automatische Tests (Logik, Sync-Server, UI) — nicht auf den Webserver |

---

## Neue Features

1. Fork erstellen
2. Feature im passenden Modul (`js/*.js`) bzw. `spotify-api.js` implementieren
3. UI-Strings in `i18n.js` ergänzen (DE + EN)
4. Styles in `style.css` mit Sideforge-Tokens
5. Tests ausführen: `cd tests && npm install && npm test` (bei neuen Features Test ergänzen)
6. Changelog-Eintrag in `CHANGELOG.md`
7. Pull Request erstellen

---

## Sync-Server Endpunkte

| Endpunkt | Methode | Zweck |
|----------|---------|-------|
| `/api/lists` | GET, POST, DELETE | Artist-Listen |
| `/api/stats` | GET, POST | Wiedergabe-Statistiken |
| `/api/blacklist` | GET, POST | Gesperrte Tracks |
| `/api/cache` | GET, POST | Album-Cache (24h) |
| `/api/tracks` | GET, POST | Track-Cache pro Album (24h) |
| `/api/track-history` | GET, POST | Gespielte Tracks pro Artist (Sperre) |
| `/api/health` | GET | Status-Check |

---

## Bekannte Einschränkungen

| Feature | Status |
|---------|--------|
| Ähnliche Artists (Discovery) | ❌ Von Spotify im Dev Mode gesperrt |
| Like-Button | ❌ Extended Quota erforderlich |
| Audio Features (BPM, Energy) | ❌ Extended Quota erforderlich |
| iOS Web Playback | ❌ Web Playback SDK läuft nicht auf iOS Safari |

---

## Versionierung

Music Shuffle folgt [Semantic Versioning](https://semver.org/):
- **Major** (x.0.0) — Breaking Changes
- **Minor** (1.x.0) — Neue Features
- **Patch** (1.1.x) — Bugfixes, kleine Verbesserungen

---

*MIT License — Idee & Richtung: Jan Erik Mueller — Code: Claude (Anthropic)*
