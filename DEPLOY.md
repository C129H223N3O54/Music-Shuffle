# Music Shuffle — Deployment auf der Synology

Updates laufen ohne Hochladen: Der Code liegt auf GitHub, die Synology holt ihn per `git pull` und baut den Docker-Container neu. Git muss auf der NAS **nicht** installiert sein — `deploy/update.sh` nutzt dafür bei Bedarf einen Wegwerf-Container (`alpine/git`).

> **Alle Befehle in diesem Dokument stehen in EINER Zeile.** Bitte genau so kopieren — keine Zeilenumbrüche mit `\`, sonst entstehen beim Einfügen Fehler wie „` clone`: command not found“.

---

## Überblick

| | |
|---|---|
| Repo | `https://github.com/C129H223N3O54/Music-Shuffle` (öffentlich — klonen ohne Token) |
| Pfad auf der NAS | `/volume1/docker/music-shuffle` |
| Container | `music-shuffle` (Compose-Projekt `music-shuffle`, `restart: unless-stopped`) |
| Port | `127.0.0.1:3001` — wie bisher, nur lokal; von außen über den Synology-Reverse-Proxy |
| App | `https://shuffle.jem.rocks:8443/music-shuffle/` (Web-App wird jetzt vom Container ausgeliefert) |
| Sync-API | `https://sync.jem.rocks:9443/api/…` (gleicher Container, gleicher Port) |
| Update | `sh /volume1/docker/music-shuffle/deploy/update.sh` (Aufgabenplaner, siehe unten) |

**Ein Container für alles:** Web-App (`/music-shuffle/`) und Sync-Server (`/api/…`) laufen zusammen. Ein Neubau aktualisiert beide — du musst nichts mehr in die Web Station hochladen.

### Laufzeitdaten: Ordner `data/`

Alles, was die Installation ausmacht, liegt in `/volume1/docker/music-shuffle/data/`. Der Ordner wird als Volume eingebunden, steht in `.gitignore` und wird bei Updates **nie** angefasst.

| Datei | Inhalt |
|---|---|
| `lists.json` | Deine Listen (Künstler, Alben, Genres, Filter) |
| `stats.json` | Statistik (gespielte Titel, Shuffles) |
| `blacklist.json` | Blacklist |
| `track-history.json` | Gesperrte Titel pro Künstler („Keine Track-Wiederholungen“) |
| `cache.json`, `tracks.json` | Album-/Track-Cache (24 h, darf gelöscht werden) |
| `config.js` | Konfiguration der App: Spotify Client ID, Redirect-URI, Sync-Adresse |
| `.env` | `ALLOWED_USERS`, `ALLOWED_ORIGINS` (wer den Sync-Server nutzen darf) |

Spotify-Tokens liegen nur im Browser, nicht auf dem Server.

---

## Voraussetzungen

- **Container Manager** ist installiert.
- **SSH** ist an: Systemsteuerung → Terminal & SNMP → „SSH-Dienst aktivieren“.
- Anmeldung per SSH, dann root werden (alle Befehle unten als root):

```
sudo -i
```

---

## Umstieg von der bisherigen Installation (einmalig)

Bisher lief die Web-App aus `/volume1/web/music-shuffle/` (Web Station) und der Sync-Server als Container `artist-shuffle-sync` aus `/volume1/docker/artist-shuffle-sync/`.

**1. Alten Container stoppen und entfernen** (die Daten bleiben im Ordner):

```
docker stop artist-shuffle-sync && docker rm artist-shuffle-sync
```

**2. Alten Ordner umbenennen** (bleibt als Sicherung):

```
mv /volume1/docker/artist-shuffle-sync /volume1/docker/artist-shuffle-sync.alt
```

**3. Repo klonen** (ohne Git auf der NAS — über einen Wegwerf-Container):

```
docker run --rm -v /volume1/docker:/git -w /git alpine/git clone https://github.com/C129H223N3O54/Music-Shuffle.git music-shuffle
```

> Repo **privat**? Dann einen *Fine-grained Token* anlegen (GitHub → Settings → Developer settings → Fine-grained tokens): nur **dieses Repo**, Berechtigung nur **„Contents: Read-only“**. Klonen mit `https://<TOKEN>@github.com/C129H223N3O54/Music-Shuffle.git`. Der Token steht danach in `.git/config` auf der NAS.

**4. Laufzeitdaten zurückkopieren:**

```
mkdir -p /volume1/docker/music-shuffle/data && cp -a /volume1/docker/artist-shuffle-sync.alt/data/. /volume1/docker/music-shuffle/data/
```

**5. Konfiguration der App übernehmen** (`config.js` aus dem bisherigen Web-Ordner):

```
cp /volume1/web/music-shuffle/config.js /volume1/docker/music-shuffle/data/config.js
```

**6. Zugriff auf den Sync-Server festlegen:**

```
printf 'ALLOWED_USERS=kampfmade\nALLOWED_ORIGINS=https://shuffle.jem.rocks:8443\n' > /volume1/docker/music-shuffle/data/.env
```

**7. Erster Start** (baut den Container, auch ohne neuen Commit):

```
sh /volume1/docker/music-shuffle/deploy/update.sh --force
```

Am Ende muss `Health-Check OK: {"status":"ok","version":"…","auth":"on"}` stehen.

**8. Prüfen, ob die App ausgeliefert wird:**

```
curl -sI http://127.0.0.1:3001/music-shuffle/ | head -1
```

Erwartet: `HTTP/1.1 200 OK`.

**9. Reverse-Proxy für die App umstellen** (DSM-Oberfläche):

1. Läuft `shuffle.jem.rocks:8443` bisher über ein **Web-Station-Portal**: Web Station → Web-Portal → das Portal für Music Shuffle löschen (sonst ist Host + Port doppelt belegt).
2. Systemsteuerung → Anmeldeportal → Erweitert → **Reverse Proxy** → Erstellen:
   - Name: `Music Shuffle`
   - Quelle: Protokoll `HTTPS`, Hostname `shuffle.jem.rocks`, Port `8443`
   - Ziel: Protokoll `HTTP`, Hostname `localhost`, Port `3001`
3. Systemsteuerung → Sicherheit → Zertifikat → **Einstellungen**: dem neuen Eintrag `shuffle.jem.rocks:8443` das passende Zertifikat zuweisen.
4. Der Eintrag `sync.jem.rocks:9443 → localhost:3001` bleibt wie er ist.

Die Adresse der App bleibt `https://shuffle.jem.rocks:8443/music-shuffle/` — die Redirect-URI im Spotify-Dashboard muss **nicht** geändert werden.

**10. Im Browser testen**, dann den alten Web-Ordner wegräumen:

```
mv /volume1/web/music-shuffle /volume1/web/music-shuffle.alt
```

**11. Automatische Updates einrichten** (nächster Abschnitt).

Läuft alles eine Woche sauber, können `/volume1/docker/artist-shuffle-sync.alt` und `/volume1/web/music-shuffle.alt` gelöscht werden.

---

## Automatische Updates (Aufgabenplaner)

Systemsteuerung → **Aufgabenplaner** → Erstellen → Geplante Aufgabe → **Benutzerdefiniertes Script**

| Reiter | Einstellung |
|---|---|
| Allgemein | Aufgabe: `Music Shuffle Update`, Benutzer: **`root`** |
| Zeitplan | Täglich, Wiederholung z.B. alle 15 Minuten (oder 1× nachts) |
| Aufgabeneinstellungen | Benutzerdefiniertes Script (eine Zeile): |

```
sh /volume1/docker/music-shuffle/deploy/update.sh >> /volume1/docker/music-shuffle/update.log 2>&1
```

Optional: „Ausführungsdetails per E-Mail senden“ → „nur wenn das Script abnormal beendet wird“.

Ohne neuen Commit schreibt das Skript nur **eine** Zeile ins Log und fasst Docker nicht an. Mit neuem Commit:

```
[2026-11-08 16:30:01] === Music Shuffle Update — /volume1/docker/music-shuffle (git: alpine/git (Docker), Branch: main) ===
[2026-11-08 16:30:01] Update: eb48fdf → 1a2b3c4 v1.7.0 — Deployment per git pull
[2026-11-08 16:30:02] Baue und starte Container (docker compose -p music-shuffle up -d --build) …
[2026-11-08 16:30:41] Räume alte Images auf …
[2026-11-08 16:30:43] Health-Check OK: {"status":"ok","version":"1.7.0","auth":"on"}
[2026-11-08 16:30:43] === Fertig: 1a2b3c4 v1.7.0 — Deployment per git pull ===
```

Im Browser erscheint danach neben der Versionsnummer **„v1.7.0 laden ↻“** — ein Klick lädt die neue Version.

---

## Manuell

| Was | Befehl |
|---|---|
| Update jetzt holen | `sh /volume1/docker/music-shuffle/deploy/update.sh` |
| Neu bauen ohne neuen Commit | `sh /volume1/docker/music-shuffle/deploy/update.sh --force` |
| Läuft der Container? | `docker ps --filter name=music-shuffle` |
| Server-Log | `docker logs --tail 50 music-shuffle` |
| Update-Log | `tail -n 30 /volume1/docker/music-shuffle/update.log` |
| Health | `curl -s http://127.0.0.1:3001/api/health` |

### Ältere Version zurückholen

Aufgabe „Music Shuffle Update“ vorher **deaktivieren** (sonst zieht sie wieder die neueste Version), dann auf ein Release zurück und neu bauen — z.B. `v1.7.0` (frühere Stände haben noch kein Container-Setup):

```
docker run --rm -v /volume1/docker/music-shuffle:/git -w /git alpine/git -c safe.directory='*' checkout v1.7.0 && cd /volume1/docker/music-shuffle && docker compose -p music-shuffle up -d --build
```

Zurück auf den aktuellen Stand:

```
docker run --rm -v /volume1/docker/music-shuffle:/git -w /git alpine/git -c safe.directory='*' checkout main && sh /volume1/docker/music-shuffle/deploy/update.sh --force
```

---

## Fehlerbilder

| Meldung / Symptom | Ursache | Lösung |
|---|---|---|
| `Authentication failed` / `could not read Username` | Repo ist privat (oder Token abgelaufen) | Fine-grained Token (nur dieses Repo, „Contents: Read-only“) anlegen und eintragen: `docker run --rm -v /volume1/docker/music-shuffle:/git -w /git alpine/git -c safe.directory='*' remote set-url origin https://<TOKEN>@github.com/C129H223N3O54/Music-Shuffle.git` |
| `Not possible to fast-forward, aborting` | Auf der NAS wurde im Repo etwas geändert | Lokale Änderungen verwerfen (`data/` bleibt unberührt): `docker run --rm -v /volume1/docker/music-shuffle:/git -w /git alpine/git -c safe.directory='*' fetch origin && docker run --rm -v /volume1/docker/music-shuffle:/git -w /git alpine/git -c safe.directory='*' reset --hard origin/main` — danach `update.sh --force` |
| `detected dubious ownership` | git ohne `safe.directory` aufgerufen | Bei eigenen git-Befehlen immer `-c safe.directory='*'` mitgeben (das Skript macht das selbst) |
| `Bind mount failed: … /data does not exist` | `data/` fehlt (Synology legt Bind-Mount-Ordner nicht selbst an) | Immer über `update.sh` starten (legt `data/` an) oder `mkdir -p /volume1/docker/music-shuffle/data` |
| `env file …/data/.env not found` | `.env` fehlt | `update.sh` legt sie aus `deploy/env.example` an, oder Schritt 6 oben |
| `port is already allocated` / `Bind for 127.0.0.1:3001 failed` | Alter Container `artist-shuffle-sync` läuft noch | `docker ps` → `docker stop artist-shuffle-sync && docker rm artist-shuffle-sync` |
| `Permission denied` beim Speichern (Server-Log) | `data/` gehört nicht User 1000 | `chown -R 1000:1000 /volume1/docker/music-shuffle/data` (macht `update.sh` bei jedem Lauf) |
| `$'\r': command not found` / `bad interpreter` | Skript mit Windows-Zeilenenden | Kommt durch `.gitattributes` nicht mehr vor; Notlösung: `sed -i 's/\r$//' /volume1/docker/music-shuffle/deploy/update.sh` |
| 502 Bad Gateway | Container läuft nicht oder Reverse-Proxy-Ziel falsch | `docker ps --filter name=music-shuffle`, `docker logs music-shuffle`; Ziel muss `http://localhost:3001` sein |
| Falsches Zertifikat / Browser-Warnung | Neuem Reverse-Proxy-Eintrag kein Zertifikat zugewiesen | Systemsteuerung → Sicherheit → Zertifikat → Einstellungen |
| Browser zeigt alte Version | Seite/Service Worker noch aus dem Speicher | Auf **„vX laden ↻“** neben der Versionsnummer klicken, sonst Strg+F5. Installierte App: einmal schließen und neu öffnen |
| App fragt nach Client ID | `data/config.js` fehlt | Schritt 5 oben (Vorlage: `config.example.js`) |
| Health-Check schlägt fehl | Container startet nicht | `docker logs --tail 50 music-shuffle` |
| „Update läuft bereits“ | Zwei Läufe gleichzeitig, oder ein abgebrochener Lauf | Wartet von selbst; eine verwaiste Sperre wird nach 60 min entfernt (`rmdir /volume1/docker/music-shuffle/.update.lock`) |

---

## Für Entwicklung und Releases

- Release = Commit auf `main` (Checkliste in `CLAUDE.md`). Die NAS holt ihn beim nächsten Lauf des Aufgabenplaners.
- Die Version, die der Server meldet (`/api/health` → `version`), ist `APP_VERSION` aus `js/core.js`.
- Tests: `node tests/run-all.js` (u.a. `tests/deploy.test.js` für `update.sh` mit Test-Remote und Docker-Stub).
