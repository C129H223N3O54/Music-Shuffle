// ═══════════════════════════════════════════════════════════════
// config.js — Music Shuffle Configuration
//
// 1. Go to https://developer.spotify.com/dashboard
// 2. Create a new app
// 3. Add your Redirect URI (e.g. http://localhost:8080/)
// 4. Enable Web API + Web Playback SDK
// 5. Paste your Client ID below
//
// ⚠️  This file is in .gitignore — never commit your real credentials!
// ═══════════════════════════════════════════════════════════════

window.SPOTIFY_CONFIG = {
    clientId: 'YOUR_CLIENT_ID_HERE',
    redirectUri: 'http://localhost:8080/',
    syncUrl: null,
};
