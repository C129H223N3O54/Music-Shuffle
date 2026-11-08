#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════
#  MUSIC SHUFFLE — Update vom GitHub-Repo + Container-Neubau
#
#  Aufruf (als root, z.B. im Synology-Aufgabenplaner):
#    sh /volume1/docker/music-shuffle/deploy/update.sh [--force]
#
#  Ablauf:
#    1. git pull --ff-only (git vom System oder – falls nicht installiert –
#       über einen Wegwerf-Container alpine/git)
#    2. Nur wenn sich der Commit geändert hat (oder --force):
#       data/ anlegen, Container neu bauen + starten, alte Images aufräumen
#    3. Health-Check
#
#  Umgebungsvariablen (optional):
#    BRANCH=main                     Branch, der ausgerollt wird
#    HEALTH_URL=http://127.0.0.1:3001/api/health
#    USE_DOCKER_GIT=1                git immer über alpine/git (auch wenn git da ist)
#  Anleitung: DEPLOY.md
# ═══════════════════════════════════════════════════════════════════════
set -eu

PROJECT="music-shuffle"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
FORCE=0

for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=1 ;;
    -h|--help)  sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $arg (erlaubt: --force)"; exit 2 ;;
  esac
done

# Der Synology-Aufgabenplaner startet mit sehr knappem PATH (docker liegt in /usr/local/bin)
PATH="${PATH:-}:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin"
export PATH

log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "FEHLER: $*"; exit 1; }

# ── Nur ein Lauf gleichzeitig (Sperre, verwaiste Sperren > 60 min werden entfernt) ──
LOCK="$DIR/.update.lock"
if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then
  rmdir "$LOCK" 2>/dev/null || true
fi
if ! mkdir "$LOCK" 2>/dev/null; then
  log "Update läuft bereits (Sperre $LOCK) – nichts zu tun"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM

# ── git: vom System oder über einen Wegwerf-Container ──
if [ "${USE_DOCKER_GIT:-0}" != "1" ] && command -v git >/dev/null 2>&1; then
  GIT_MODE="git"
  g() { git -C "$DIR" -c safe.directory='*' "$@"; }
else
  command -v docker >/dev/null 2>&1 || fail "weder git noch docker gefunden"
  GIT_MODE="alpine/git (Docker)"
  g() { docker run --rm -v "$DIR":/git -w /git alpine/git -c safe.directory='*' "$@"; }
fi

[ -d "$DIR/.git" ] || fail "$DIR ist kein Git-Repository (siehe DEPLOY.md, Schritt „Klonen“)"

OLD="$(g rev-parse HEAD)" || fail "git rev-parse fehlgeschlagen ($DIR, git: $GIT_MODE)"

if ! g pull --ff-only --quiet origin "$BRANCH"; then
  fail "git pull fehlgeschlagen ($DIR, git: $GIT_MODE). Häufige Ursachen: kein Netz, Authentifizierung (privates Repo) oder lokale Änderungen („Not possible to fast-forward“ → DEPLOY.md, Fehlerbilder)."
fi

NEW="$(g rev-parse HEAD)"
# Ohne Änderung nur eine Zeile ins Log (der Aufgabenplaner ruft das Skript regelmäßig auf)
if [ "$OLD" = "$NEW" ] && [ "$FORCE" -ne 1 ]; then
  log "Keine Änderung ($(g log -1 --format='%h' HEAD)) – nichts zu tun"
  exit 0
fi

log "=== Music Shuffle Update — $DIR (git: $GIT_MODE, Branch: $BRANCH) ==="

if [ "$OLD" = "$NEW" ]; then
  log "Keine neuen Commits – Neubau erzwungen (--force)"
else
  log "Update: $(g log -1 --format='%h' "$OLD") → $(g log -1 --format='%h %s' "$NEW")"
  g log --format='           • %h %s' "$OLD..$NEW" || true
fi

# ── Laufzeitdaten: data/ muss existieren (Synology legt Bind-Mount-Ordner NICHT selbst an) ──
mkdir -p "$DIR/data"
if [ ! -f "$DIR/data/.env" ]; then
  cp "$DIR/deploy/env.example" "$DIR/data/.env"
  log "data/.env aus deploy/env.example angelegt – bitte ALLOWED_USERS und ALLOWED_ORIGINS eintragen"
fi
[ -f "$DIR/data/config.js" ] || log "WARNUNG: data/config.js fehlt – die App fragt dann nach der Client-ID (Vorlage: config.example.js)"
# Der Container läuft als User „node“ (UID 1000)
chown -R 1000:1000 "$DIR/data" 2>/dev/null || log "Hinweis: Rechte auf data/ konnten nicht gesetzt werden (nicht als root gestartet?)"

# ── Bauen + starten ──
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  fail "weder „docker compose“ noch „docker-compose“ gefunden"
fi

log "Baue und starte Container ($DC -p $PROJECT up -d --build) …"
cd "$DIR"
$DC -p "$PROJECT" up -d --build || fail "Build/Start fehlgeschlagen – Ausgabe oben prüfen"

log "Räume alte Images auf …"
docker image prune -f >/dev/null 2>&1 || log "Hinweis: docker image prune fehlgeschlagen (nicht schlimm)"

# ── Health-Check (bis zu 60 s) ──
http_get() {
  if command -v curl >/dev/null 2>&1; then curl -fsS --max-time 3 "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -O - -T 3 "$1"
  else return 1; fi
}
i=0
while [ "$i" -lt 30 ]; do
  if BODY="$(http_get "$HEALTH_URL" 2>/dev/null)"; then
    log "Health-Check OK: $BODY"
    log "=== Fertig: $(g log -1 --format='%h %s' HEAD) ==="
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done
fail "Health-Check nach 60 s nicht erreichbar ($HEALTH_URL) – Logs: docker logs $PROJECT"
