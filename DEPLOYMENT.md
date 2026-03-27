# 🚀 Deployment Guide

Artist Shuffle is a **pure static web app** — no backend, no build step, no database.
Just serve the files over HTTPS and you're done.

---

## Requirements

- Any web server capable of serving static files
- **HTTPS** — required by Spotify OAuth (exception: `http://localhost` for local dev)
- A valid SSL certificate (Let's Encrypt is free and widely supported)

---

## General Setup

### 1. Upload files

Copy these files to your web server's document root (or a subdirectory):

```
index.html
style.css
app.js
spotify-api.js
config.js          ← create from config.example.js
manifest.json
service-worker.js
favicon.svg
favicon.ico
icons/
```

Do **not** upload `config.example.js`, `sync-server/`, `README.md`, etc. to production — only the files listed above are needed to run the app.

### 2. Create config.js

```javascript
window.SPOTIFY_CONFIG = {
    clientId: 'YOUR_CLIENT_ID',
    redirectUri: 'https://your-domain.com/',      // trailing slash required
    syncUrl: null,                                  // optional
};
```

### 3. Set Redirect URI in Spotify Dashboard

Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → your app → Settings → add:

```
https://your-domain.com/
```

> The URI must **exactly** match `redirectUri` in `config.js` — including the trailing slash and protocol.

---

## Platform-Specific Notes

### Apache

No special configuration needed. If you serve from a subdirectory (e.g. `/artist-shuffle/`), update `redirectUri` and `manifest.json` `start_url` accordingly.

Optional `.htaccess` for correct MIME types:

```apache
AddType application/javascript .js
AddType text/css .css
AddType image/svg+xml .svg
```

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    root /var/www/artist-shuffle;
    index index.html;

    # Correct MIME types
    include /etc/nginx/mime.types;

    # Cache static assets
    location ~* \.(js|css|png|svg|ico|json)$ {
        expires 1d;
        add_header Cache-Control "public";
    }
}
```

### Caddy

```caddyfile
your-domain.com {
    root * /var/www/artist-shuffle
    file_server
    encode gzip
}
```

Caddy handles HTTPS automatically with Let's Encrypt.

### GitHub Pages

1. Push the project to a GitHub repository
2. Go to **Settings → Pages → Source → Deploy from branch**
3. Select `main` branch, root folder
4. Your app will be at `https://yourusername.github.io/artist-shuffle/`
5. Update `redirectUri` and `manifest.json` `start_url` to match

### Netlify

1. Drag and drop the project folder to [netlify.com/drop](https://app.netlify.com/drop)
2. Or connect your GitHub repo for automatic deploys
3. HTTPS is included automatically
4. Update `config.js` with your Netlify domain

### Vercel

```bash
npm i -g vercel
vercel deploy
```

### Synology NAS

See the detailed step-by-step guide in [SYNOLOGY.md](SYNOLOGY.md) if you're hosting on a Synology NAS with Web Station and Reverse Proxy.

---

## Subdirectory Deployment

If you deploy to a subdirectory (e.g. `https://your-domain.com/shuffle/`):

1. **`config.js`** — set `redirectUri: 'https://your-domain.com/shuffle/'`
2. **`manifest.json`** — update `start_url` and `scope` to `/shuffle/`
3. **`service-worker.js`** — update `STATIC_ASSETS` paths to include `/shuffle/` prefix
4. **Spotify Dashboard** — add `https://your-domain.com/shuffle/` as Redirect URI

---

## Updating the App

When you upload new versions of `app.js`, `style.css`, or other files, bump the Service Worker cache version so users get the fresh files:

In `service-worker.js`, change:
```javascript
const CACHE_NAME = 'artist-shuffle-v2';
// to:
const CACHE_NAME = 'artist-shuffle-v3';
```

Upload the updated `service-worker.js` — browsers will detect the change and clear the old cache automatically.

---

## SSL / HTTPS

If your server doesn't have SSL yet, the easiest options are:

- **Let's Encrypt** — free, auto-renewing, supported by most servers and control panels
- **Cloudflare** — free proxy + SSL, just change your nameservers
- **Netlify / Vercel / GitHub Pages** — SSL included automatically

---

## Optional: Cross-Device Sync Server

To sync your artist lists across devices, deploy the optional sync server.
See [sync-server/SYNC-SERVER.md](sync-server/SYNC-SERVER.md) for Docker-based setup instructions.

After deploying the sync server, update `config.js`:

```javascript
syncUrl: 'https://sync.your-domain.com',
```
