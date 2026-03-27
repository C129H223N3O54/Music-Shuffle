# Contributing to Artist Shuffle

Thanks for your interest! 🎲

## Philosophy

- **Vanilla JS only** — no framework, no build step, no `node_modules` in the browser
- **Personal use focus** — features should work within Spotify's Development Mode limits
- **Simple over clever** — readable code beats clever one-liners

## Getting Started

```bash
git clone https://github.com/yourusername/artist-shuffle.git
cd artist-shuffle
cp config.example.js config.js
# Add your Spotify Client ID to config.js
python3 -m http.server 8080
```

## File Responsibilities

| File | Purpose |
|------|---------|
| `app.js` | UI, state management, all event handling |
| `spotify-api.js` | Spotify API calls only — no UI code here |
| `style.css` | All styles — use CSS variables from `:root` |
| `index.html` | Structure only |
| `service-worker.js` | PWA caching — bump `CACHE_NAME` version on changes |

## Code Style

- ES6+ (async/await, arrow functions, template literals, optional chaining)
- 2-space indentation
- Section headers: `// ── SECTION NAME ──────────`
- No semicolons (consistent with existing code)

## Spotify API Constraints

The app targets **Development Mode** — these endpoints are restricted and should not be used:

- ❌ `/audio-features` — energy, BPM, instrumentalness
- ❌ `/me/tracks` — like/save tracks
- ❌ `/me/top/tracks` and `/me/top/artists`
- ❌ `/recommendations`

These work fine:

- ✅ `/artists/{id}/albums`
- ✅ `/albums/{id}/tracks`
- ✅ `/search`
- ✅ `/artists/{id}/related-artists`
- ✅ Web Playback SDK (Premium required)
- ✅ `/me/player/*` — playback control

## Submitting a PR

1. Fork → feature branch → PR
2. Describe what changed and why
3. Test with a real Spotify Premium account

## Reporting Bugs

Open an issue with:
- Browser + OS
- Steps to reproduce
- Console errors (F12)
- Expected vs actual behavior
