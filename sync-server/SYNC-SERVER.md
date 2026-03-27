# 🔄 SYNC-SERVER — Geräteübergreifende Listen

Anleitung zum Einrichten des Sync-Servers auf der Synology NAS mit Docker/Container Manager.

---

## Was macht der Sync-Server?

Der Sync-Server speichert deine Artist-Listen auf der NAS und synchronisiert sie automatisch zwischen allen Geräten — egal ob PC, Handy oder Tablet. Jede Änderung (Artist hinzufügen, Liste erstellen, löschen) wird automatisch gespeichert und auf anderen Geräten geladen.

---

## Voraussetzungen

- Synology NAS mit DSM 7.x
- Container Manager installiert
- `your-domain.com` Reverse Proxy läuft bereits (aus DEPLOYMENT.md)

---

## Schritt 1 — Sync-Server Dateien hochladen

1. Öffne die **File Station**
2. Navigiere zu `/volume1/docker/` (oder erstelle den Ordner)
3. Erstelle einen neuen Ordner: `artist-shuffle-sync`
4. Lade folgende Dateien in den Ordner hoch:
   - `sync-server.js`
   - `Dockerfile`

```
/volume1/docker/artist-shuffle-sync/
├── sync-server.js
├── Dockerfile
└── data/          ← wird automatisch erstellt
```

---

## Schritt 2 — Docker Image bauen

1. Öffne den **Container Manager** in DSM
2. Klicke auf **"Image"** → **"Hinzufügen"** → **"Aus Dockerfile erstellen"**

   Falls diese Option nicht vorhanden ist → Schritt 2b verwenden.

### Schritt 2b — Über SSH bauen (Alternative)

SSH auf die NAS:
```bash
ssh your-user@your-nas-ip
cd /volume1/docker/artist-shuffle-sync
sudo docker build -t artist-shuffle-sync:latest .
```

---

## Schritt 3 — Container erstellen

Im **Container Manager** → **"Container"** → **"Erstellen"**:

### Allgemein:
- **Image:** `artist-shuffle-sync:latest`
- **Containername:** `artist-shuffle-sync`
- **Automatisch neu starten:** ✅ Aktiviert

### Port-Einstellungen:
| Container-Port | Host-Port | Protokoll |
|---------------|-----------|-----------|
| 3001          | 3001      | TCP       |

### Volume-Einstellungen:
| Host-Pfad | Container-Pfad | Typ |
|-----------|---------------|-----|
| `/volume1/docker/artist-shuffle-sync/data` | `/data` | Lese/Schreiben |

Den Host-Ordner `/volume1/docker/artist-shuffle-sync/data` vorher in der File Station erstellen!

### Umgebungsvariablen (optional):
| Variable | Wert |
|----------|------|
| `PORT` | `3001` |
| `DATA_FILE` | `/data/lists.json` |

Klicke **"Anwenden"** → Container startet automatisch.

---

## Schritt 4 — Reverse Proxy für Sync-Server einrichten

Damit der Sync-Server über HTTPS erreichbar ist, muss ein Reverse Proxy Eintrag erstellt werden.

**DSM → Systemsteuerung → Anmeldeportal → Reverse Proxy → Erstellen:**

| Feld | Wert |
|------|------|
| Name | Artist Shuffle Sync |
| Quelle Protokoll | HTTPS |
| Quelle Hostname | `your-domain.com` |
| Quelle Port | `8443` |
| Quelle Pfad | `/sync/` |
| Ziel Protokoll | HTTP |
| Ziel Hostname | `127.0.0.1` |
| Ziel Port | `3001` |

> **Hinweis:** Wenn dein Reverse Proxy keine Pfad-basierte Weiterleitung unterstützt, kannst du alternativ einen eigenen Port verwenden (z.B. `3001` direkt über `your-domain.com:3001`).

---

## Schritt 5 — Sync-Server testen

Öffne im Browser:
```
https://your-domain.com/sync/api/health
```

oder intern:
```
http://192.168.1.100:3001/api/health
```

Du solltest folgendes sehen:
```json
{
  "status": "ok",
  "lists": 0,
  "updatedAt": null
}
```

---

## Schritt 6 — config.js anpassen

Öffne `/volume1/web/music-shuffle/config.js` und trage die Sync-URL ein:

```javascript
window.SPOTIFY_CONFIG = {
    clientId: 'DEINE_CLIENT_ID',
    redirectUri: 'https://your-domain.com/music-shuffle/',
    syncUrl: 'https://your-domain.com/sync',
    // Intern kannst du auch direkt verwenden:
    // syncUrl: 'http://192.168.1.100:3001',
};
```

---

## Schritt 7 — Testen

1. Öffne die App auf Gerät 1
2. Erstelle eine Liste und füge Artists hinzu
3. Warte kurz (ca. 2 Sekunden)
4. Öffne die App auf Gerät 2
5. Die Liste sollte automatisch erscheinen ✓

---

## Wie funktioniert die Synchronisation?

- **Beim Start:** App lädt Listen vom Server und merged sie mit lokalen Listen
- **Bei Änderungen:** Nach jeder Änderung (Artist hinzufügen/entfernen, Liste erstellen) wird automatisch nach 1,5 Sekunden gespeichert
- **Manuell:** Sync-Button (🔄) in der App oben rechts
- **Konflikt-Auflösung:** Server-Listen haben Vorrang, lokale Listen die nicht auf dem Server sind bleiben erhalten

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Health-Check schlägt fehl | Container läuft? Container Manager → Container → Status prüfen |
| CORS-Fehler in Browser-Konsole | Reverse Proxy Pfad prüfen |
| Listen werden nicht gespeichert | Schreibrechte auf `/volume1/docker/artist-shuffle-sync/data/` prüfen |
| Sync-Icon grau | `syncUrl` in `config.js` prüfen |

### Container Logs einsehen

Container Manager → Container → `artist-shuffle-sync` → **"Details"** → **"Log"**

---

## Datensicherung

Die Listen werden in `/volume1/docker/artist-shuffle-sync/data/lists.json` gespeichert. Diese Datei kannst du regelmäßig sichern oder in die Synology Backup-Aufgabe einbeziehen.

---

*Erstellt für Artist Shuffle — MIT License*
