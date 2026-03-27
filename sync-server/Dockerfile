FROM node:18-alpine

WORKDIR /app

COPY sync-server.js .

# Datenverzeichnis erstellen
RUN mkdir -p /data

EXPOSE 3001

ENV PORT=3001
ENV DATA_FILE=/data/lists.json

CMD ["node", "sync-server.js"]
