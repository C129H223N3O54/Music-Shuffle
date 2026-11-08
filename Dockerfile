# ═══════════════════════════════════════════════════════
#  MUSIC SHUFFLE — ein Container für Web-App + Sync-Server
#  Gebaut von deploy/update.sh (docker compose up -d --build), Anleitung: DEPLOY.md
#  Laufzeitdaten + Konfiguration liegen NICHT im Image, sondern in ./data (Volume).
# ═══════════════════════════════════════════════════════
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3001 \
    DATA_DIR=/data \
    WEB_DIR=/app/web

WORKDIR /app

# Server (keine npm-Abhängigkeiten — nur Node-Standardmodule)
COPY sync-server/sync-server.js ./sync-server.js

# Web-App (nur was der Browser braucht — config.js kommt aus /data)
COPY index.html app.js i18n.js spotify-api.js service-worker.js manifest.json \
     style.css sideforge-tokens.css favicon.svg favicon.ico ./web/
COPY js/ ./web/js/
COPY icons/ ./web/icons/

# Datenordner gehört dem unprivilegierten User "node" (UID 1000);
# deploy/update.sh setzt die Rechte auf dem NAS passend.
RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "sync-server.js"]
