# 🔄 Sync-Server — Referenz

Der Sync-Server speichert deine Daten auf der NAS und synchronisiert sie zwischen allen Geräten. Seit **v1.7.0** liefert er außerdem die Web-App unter `/music-shuffle/` aus — App und Server laufen zusammen in **einem** Container.

> **Installation und Updates:** siehe [DEPLOY.md](../DEPLOY.md) (git pull + Docker-Neubau auf der Synology).

---

## Endpunkte und Daten

| Daten | Datei (in `data/`) | Endpunkt |
|-------|-------|----------|
| Listen | `lists.json` | `/api/lists` |
| Wiedergabe-Statistiken | `stats.json` | `/api/stats` |
| Blacklist | `blacklist.json` | `/api/blacklist` |
| Album-Cache (24 h) | `cache.json` | `/api/cache` |
| Track-Cache (24 h) | `tracks.json` | `/api/tracks` |
| Gesperrte Titel pro Artist | `track-history.json` | `/api/track-history` |
| Status + App-Version | — | `/api/health` |
| Web-App | `config.js` (+ Dateien im Image) | `/music-shuffle/` |

Alle Dateien werden atomar geschrieben (temporäre Datei + Umbenennen). Caches werden auf die nötigen Felder reduziert, abgelaufene Einträge entfernt.

---

## Konfiguration

**`data/.env`** (Umgebungsvariablen, Vorlage: `deploy/env.example`):

| Variable | Bedeutung |
|----------|-----------|
| `ALLOWED_USERS` | Spotify-User-IDs, die zugreifen dürfen (kommagetrennt). Deine ID: Spotify → Profil → ⋯ → Link zum Profil kopieren (`open.spotify.com/user/<ID>`) |
| `ALLOWED_ORIGINS` | Adresse der App für CORS (Protokoll + Host + Port, ohne Pfad) |

Im Container fest gesetzt (`docker-compose.yml`): `PORT=3001`, `DATA_DIR=/data`, `WEB_DIR=/app/web`, `TZ=Europe/Berlin`.

**`data/config.js`** (wird unter `/music-shuffle/config.js` ausgeliefert, Vorlage: `config.example.js`):

```javascript
window.SPOTIFY_CONFIG = {
    clientId:    'DEINE_CLIENT_ID',
    redirectUri: 'https://deine-domain.de:8443/music-shuffle/',
    syncUrl:     'https://sync.deine-domain.de:9443',
    syncStats:   true,
};
```

---

## Sicherheit

- **Anmeldung über Spotify:** Die App schickt ihr Spotify-Access-Token mit (`Authorization: Bearer …`). Der Server fragt bei Spotify (`/v1/me`), wem es gehört, und lässt nur `ALLOWED_USERS` rein. Kein eigenes Passwort, nichts Geheimes in `config.js`. Ohne `ALLOWED_USERS` ist der Server **für jeden offen**, der die Adresse kennt (Warnung im Log).
- **Health ohne Anmeldung** liefert nur `status`, `version`, `auth`; mit Anmeldung zusätzlich alle Zähler.
- CORS nur für `ALLOWED_ORIGINS`, Sicherheits-Header, Größenlimit für Anfragen, IDs werden geprüft.
- Die Web-App wird nur aus `WEB_DIR` ausgeliefert (kein Ausbruch per `../`, keine versteckten Dateien).
- Der Container läuft als unprivilegierter User `node` (UID 1000); Port nur auf `127.0.0.1`.

**Empfohlene Header im Reverse Proxy** (DSM → Reverse Proxy → Eintrag → Benutzerdefinierte Kopfzeile):

| Header | Wert |
|--------|------|
| `Strict-Transport-Security` | `max-age=31536000` |

---

## Health-Check

```
curl -s http://127.0.0.1:3001/api/health
```

```json
{ "status": "ok", "version": "1.7.0", "auth": "on" }
```

`version` ist die Version der ausgelieferten App (`APP_VERSION` aus `js/core.js`). Die App vergleicht sie mit ihrer eigenen und bietet bei einer neueren Server-Version „vX laden ↻“ an.

---

## Datensicherung

Alle Daten liegen in `/volume1/docker/music-shuffle/data/` — einfach in die Synology-Backup-Aufgabe einbeziehen.

---

*Erstellt für Music Shuffle — MIT License*
