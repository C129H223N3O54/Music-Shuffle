# 🔄 SYNC-SERVER — Geräteübergreifende Synchronisation

Anleitung zum Einrichten des Sync-Servers auf der Synology NAS mit Docker/Container Manager.

---

## Was macht der Sync-Server?

Der Sync-Server speichert deine Daten auf der NAS und synchronisiert sie automatisch zwischen allen Geräten.

| Daten | Datei | Endpunkt |
|-------|-------|----------|
| Artist-Listen | `lists.json` | `/api/lists` |
| Wiedergabe-Statistiken | `stats.json` | `/api/stats` |
| Blacklist | `blacklist.json` | `/api/blacklist` |
| Album-Cache | `cache.json` | `/api/cache` |
| Track-Cache | `tracks.json` | `/api/tracks` |
| Gespielte Tracks pro Artist | `track-history.json` | `/api/track-history` |

> **Sicherheit (ab v1.6.0):** Mit `ALLOWED_USERS` dürfen nur deine Spotify-Accounts auf die Daten zugreifen. Die App schickt dazu ihr Spotify-Token mit, der Server prüft es direkt bei Spotify. Ohne `ALLOWED_USERS` ist der Server **für jeden offen**, der die URL kennt (lesen, ändern, löschen).

---

## Voraussetzungen

- Synology NAS mit DSM 7.x
- Container Manager installiert
- Reverse Proxy läuft bereits (aus DEPLOYMENT.md)

---

## Schritt 1 — Dateien hochladen

1. Öffne die **File Station**
2. Navigiere zu `/volume1/docker/` und erstelle `artist-shuffle-sync`
3. Lade die beiden Dateien aus dem Repo-Ordner `sync-server/` hoch:
   - `sync-server.js`
   - `Dockerfile`

```
/volume1/docker/artist-shuffle-sync/
├── sync-server.js
├── Dockerfile
└── data/          ← wird automatisch erstellt
    ├── lists.json
    ├── stats.json
    ├── blacklist.json
    ├── cache.json
    ├── tracks.json
    └── track-history.json
```

---

## Schritt 2 — Docker Image bauen

Per SSH auf der NAS:

```bash
cd /volume1/docker/artist-shuffle-sync
sudo docker build -t artist-shuffle-sync:latest .
```

---

## Schritt 3 — Container erstellen

```bash
sudo docker run -d --name artist-shuffle-sync --restart always -p 127.0.0.1:3001:3001 -e ALLOWED_USERS=dein-spotify-username -e ALLOWED_ORIGINS=https://deine-domain.de:8443 -v /volume1/docker/artist-shuffle-sync/data:/data artist-shuffle-sync:latest
```

| Variable | Bedeutung |
|----------|-----------|
| `ALLOWED_USERS` | Spotify-User-IDs, die zugreifen dürfen (kommagetrennt). Deine ID steht in Spotify unter *Profil → ⋯ → Link zum Profil kopieren* (`open.spotify.com/user/<ID>`) |
| `ALLOWED_ORIGINS` | Adresse der App für CORS (ohne Pfad, mit Port) |
| `-p 127.0.0.1:3001:3001` | Port nur lokal — erreichbar nur über den Reverse Proxy |

---

## Schritt 4 — Reverse Proxy einrichten

**DSM → Systemsteuerung → Anmeldeportal → Reverse Proxy → Erstellen:**

| Feld | Wert |
|------|------|
| Name | Music Shuffle Sync |
| Quelle Protokoll | HTTPS |
| Quelle Hostname | `sync.deine-domain.de` |
| Quelle Port | `9443` |
| Ziel Protokoll | HTTP |
| Ziel Hostname | `127.0.0.1` |
| Ziel Port | `3001` |

---

## Schritt 5 — Testen

```
https://sync.deine-domain.de:9443/api/health
```

Erwartete Antwort im Browser (ohne Anmeldung nur Status):

```json
{ "status": "ok", "version": "1.6.0", "auth": "on" }
```

`"auth": "on"` = Anmeldung aktiv. Die App selbst bekommt (angemeldet) alle Zähler:

```json
{
  "status": "ok",
  "version": "1.6.0",
  "auth": "on",
  "lists": 1,
  "plays": 937,
  "blacklist": 12,
  "trackHistory": 101,
  "albumCache": 27,
  "trackCache": 385,
  "updatedAt": "2026-04-25T20:20:57.001Z"
}
```

---

## Schritt 6 — config.js anpassen

```javascript
window.SPOTIFY_CONFIG = {
    clientId:    'DEINE_CLIENT_ID',
    redirectUri: 'https://deine-domain.de/music-shuffle/',
    syncUrl:     'https://sync.deine-domain.de:9443',
    syncStats:   true,
};
```

---

## Updates einspielen

Bei neuer `sync-server.js`:

```bash
cd /volume1/docker/artist-shuffle-sync
sudo docker build -t artist-shuffle-sync:latest .
sudo docker stop artist-shuffle-sync
sudo docker rm artist-shuffle-sync
sudo docker run -d --name artist-shuffle-sync --restart always -p 127.0.0.1:3001:3001 -e ALLOWED_USERS=dein-spotify-username -e ALLOWED_ORIGINS=https://deine-domain.de:8443 -v /volume1/docker/artist-shuffle-sync/data:/data artist-shuffle-sync:latest
```

> Die `/data/` Dateien bleiben beim Rebuild erhalten. Befehl in **einer** Zeile einfügen.

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Health-Check schlägt fehl | Container läuft? `sudo docker logs artist-shuffle-sync` |
| CORS-Fehler | Reverse Proxy Konfiguration prüfen |
| Daten werden nicht gespeichert | Schreibrechte auf `/volume1/docker/artist-shuffle-sync/data/` prüfen |
| Sync-Icon grau | `syncUrl` in `config.js` prüfen |
| Konsole: `→ 401` / `→ 403` bei Sync-Requests | 401: neu bei Spotify anmelden. 403: Spotify-User-ID in `ALLOWED_USERS` prüfen (`sudo docker logs artist-shuffle-sync` zeigt die erlaubten User) |
| CORS-Fehler nach v1.6.0 | `ALLOWED_ORIGINS` muss exakt der App-Adresse entsprechen (Protokoll + Host + Port, ohne Pfad) |

---

## Härtung (empfohlen)

**Reverse Proxy — Benutzerdefinierte Kopfzeilen** (DSM → Reverse Proxy → App-Eintrag → Benutzerdefinierte Kopfzeile):

| Header | Wert |
|--------|------|
| `Strict-Transport-Security` | `max-age=31536000` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |

**Container ohne root:** In der `Dockerfile` die Zeile `# USER node` einkommentieren und einmalig `sudo chown -R 1000:1000 /volume1/docker/artist-shuffle-sync/data` ausführen.

**Keine Backups/Tests auf dem Webserver:** `*.bak-*`, `tests/` und `sync-server.js` gehören nicht in den Web-Ordner der App.

---

## Datensicherung

Alle Daten liegen in `/volume1/docker/artist-shuffle-sync/data/` — einfach in die Synology Backup-Aufgabe einbeziehen.

---

*Erstellt für Music Shuffle — MIT License*
