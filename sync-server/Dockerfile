# ═══════════════════════════════════════════════════════
#  MUSIC SHUFFLE — Sync-Server
#  Diesen Ordner (Dockerfile + sync-server.js) auf die NAS kopieren,
#  z.B. nach /volume1/docker/artist-shuffle-sync/ — Anleitung: SYNC-SERVER.md
# ═══════════════════════════════════════════════════════
FROM node:22-alpine

WORKDIR /app

# Keine npm-Abhängigkeiten — nur Node-Standardmodule
COPY sync-server.js .

# Datenverzeichnis (wird per Volume gemountet)
RUN mkdir -p /data

EXPOSE 3001
ENV PORT=3001

# Optional härten (nicht als root laufen): die nächste Zeile einkommentieren und
# einmalig  sudo chown -R 1000:1000 <data-Ordner>  ausführen
# USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
    CMD wget -q --spider http://localhost:3001/api/health || exit 1

CMD ["node", "sync-server.js"]
