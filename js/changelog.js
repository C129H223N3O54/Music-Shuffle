/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — js/changelog.js
   In-App-Changelog (reine Daten)
   ═══════════════════════════════════════════════════════ */
'use strict';

// ── CHANGELOG ─────────────────────────────────────────────────────────────────
const CHANGELOG = [
  {
    version: '1.6.4',
    date: '2026-10-23',
    label: { de: 'Artist-Wiederholung repariert', en: 'Artist Repeat Fixed' },
    fixed: {
      de: [
        'Alben in der Liste haben die Artist-Wiederholung umgangen — derselbe Artist konnte direkt hintereinander kommen',
        'Album-Einträge halten jetzt auch die Song-Sperre ein (vorher konnten Songs vor Ende der Diskografie doppelt kommen)',
        'Beim Neustart eines Diskografie-Durchlaufs konnte ein bereits eingereihter Song noch einmal gezogen werden',
      ],
      en: [
        'Albums in a list bypassed the artist repeat limit — the same artist could play back to back',
        'Album entries now also respect the song lock (songs could repeat before the discography was exhausted)',
        'When a discography cycle restarted, a song already in the queue could be drawn again',
      ],
    },
    added: {
      de: ['Fairness-Test: simuliert tausende Titel mit dem echten App-Code und prüft Abstände, Sperre und Verteilung'],
      en: ['Fairness test: simulates thousands of tracks with the real app code and checks spacing, lock and distribution'],
    },
  },
  {
    version: '1.6.3',
    date: '2026-10-19',
    label: { de: 'Neues Logo', en: 'New Logo' },
    changed: {
      de: [
        'Eigenes App-Logo „Zufalls-Equalizer": Balken in zufälligen Höhen, der gezogene leuchtet hell — Favicon, App-Icons, Android-/iPhone-Icons und Login-Seite',
        'Favicon für den Browser-Tab mit eigener, pixelgenauer Kleinversion (4 Balken), damit es auch bei 16 px scharf bleibt',
      ],
      en: [
        'New app logo "random equalizer": bars of random height, the picked one lights up — favicon, app icons, Android/iPhone icons and login page',
        'Browser-tab favicon gets its own pixel-aligned small version (4 bars) so it stays sharp at 16 px',
      ],
    },
  },
  {
    version: '1.6.2',
    date: '2026-10-19',
    label: { de: 'Neue Icons', en: 'New Icons' },
    changed: {
      de: [
        'Alle App-Icons und favicon.ico neu im Sideforge-Logo — passen jetzt zum Favicon im Tab',
        'Eigene Icons für Android (randlos, Logo in der sicheren Zone) und iPhone-Homescreen',
      ],
      en: [
        'All app icons and favicon.ico regenerated with the Sideforge logo — now matching the tab favicon',
        'Dedicated icons for Android (full-bleed, logo in the safe zone) and the iPhone home screen',
      ],
    },
  },
  {
    version: '1.6.1',
    date: '2026-10-19',
    label: { de: 'Aufgeräumt & übersetzt', en: 'Tidied Up & Translated' },
    changed: {
      de: [
        'app.js in Module aufgeteilt (js/core, sync, player, shuffle, lists, ui, changelog) — von 2900 auf knapp 500 Zeilen',
        'Alle Meldungen, Tooltips und Ladehinweise sind jetzt übersetzt (DE/EN) statt fest auf Deutsch',
      ],
      en: [
        'app.js split into modules (js/core, sync, player, shuffle, lists, ui, changelog) — from 2900 down to under 500 lines',
        'All messages, tooltips and loading hints are now translated (DE/EN) instead of hard-coded German',
      ],
    },
  },
  {
    version: '1.6.0',
    date: '2026-10-19',
    label: { de: 'Sicherheit & Auto-Reconnect', en: 'Security & Auto-Reconnect' },
    added: {
      de: [
        'Automatischer Player-Reconnect: Hat der Browser den Tab eingefroren und Spotify das Gerät abgemeldet (404 „Not found"), verbindet sich der Player neu und spielt den Titel weiter',
        'Sync-Server mit Anmeldung: nur freigeschaltete Spotify-Accounts (ALLOWED_USERS) dürfen Daten lesen, ändern oder löschen — ohne eigenes Passwort',
        'Content-Security-Policy und Clickjacking-Schutz für die App',
      ],
      en: [
        'Automatic player reconnect: if the browser froze the tab and Spotify dropped the device (404 "Not found"), the player reconnects and keeps playing',
        'Sync server with login: only allowed Spotify accounts (ALLOWED_USERS) can read, change or delete data — no extra password',
        'Content Security Policy and clickjacking protection for the app',
      ],
    },
    changed: {
      de: [
        'Filter „Artist-Wiederholung nach N Tracks" wirkt jetzt (war bisher ohne Funktion)',
        'Shuffle-Button und Queue nutzen dieselbe Auswahl-Logik',
        'Listen aus Sync, Import und Speicher werden geprüft und bereinigt',
        'Sync-Server: CORS nur für die eigene App, Sicherheits-Header, Health ohne Anmeldung nur mit Status',
      ],
      en: [
        '"Artist repeat after N tracks" filter now works (previously had no effect)',
        'Shuffle button and queue share the same selection logic',
        'Lists from sync, import and storage are validated and cleaned',
        'Sync server: CORS only for your own app, security headers, health shows status only without login',
      ],
    },
    fixed: {
      de: [
        'Eingeschleuster Code über manipulierte Listen-Daten (Bild-URLs, IDs) möglich — jetzt abgesichert',
        'Eine einzige kaputte Anfrage konnte den Sync-Server abstürzen lassen',
        'Importierte Listen mit gleicher ID überschrieben vorhandene Listen',
      ],
      en: [
        'Code injection via manipulated list data (image URLs, IDs) was possible — now prevented',
        'A single malformed request could crash the sync server',
        'Imported lists with the same ID overwrote existing lists',
      ],
    },
  },
  {
    version: '1.5.2',
    date: '2026-10-10',
    label: { de: 'Code-Review & Fairness', en: 'Code Review & Fairness' },
    added: {
      de: [
        'Filter „Keine Kommentar-Tracks" — blendet z.B. „The Nexus - Commentary" und Alben wie „The Nexus (Commentary)" aus (Track- und Albumname)',
        'Automatische Tests im Ordner tests/ (Logik, Sync-Server, komplette Oberfläche im Browser)',
      ],
      en: [
        '"No commentary tracks" filter — hides e.g. "The Nexus - Commentary" and albums like "The Nexus (Commentary)" (track and album name)',
        'Automated tests in the tests/ folder (logic, sync server, full UI in a browser)',
      ],
    },
    changed: {
      de: [
        'Song-Erkennung: Single- und Albumversion desselben Songs zählen als ein Song (kommen nicht mehr doppelt so oft) und werden gemeinsam gesperrt',
        'Schnellerer Shuffle bei leerem Cache: statt bis zu 25 Alben werden meist nur 1–2 geladen — bei weiterhin gleichmäßiger Verteilung',
        'Track-Status nutzt jetzt Cache, Listen-Filter und Song-Erkennung wie der Shuffle',
        'Service Worker lädt App-Dateien online immer frisch — Cache nach Updates nicht mehr manuell leeren',
        'Sync-Server: Track-Cache verschlankt und abgelaufene Einträge entfernt (tracks.json deutlich kleiner), atomares Speichern',
        'Playlist aus Verlauf: neue Spotify-Endpunkte (einmal ab- und wieder anmelden für die Berechtigung)',
      ],
      en: [
        'Song detection: single and album version of the same song count as one song (no longer come up twice as often) and are locked together',
        'Faster shuffle with an empty cache: usually 1–2 albums are loaded instead of up to 25 — still evenly distributed',
        'Track status now uses the cache, list filters and song detection like the shuffle',
        'Service worker always fetches app files fresh when online — no more manual cache clearing after updates',
        'Sync server: slimmer track cache, expired entries removed (much smaller tracks.json), atomic saving',
        'Playlist from history: new Spotify endpoints (log out and in once for the permission)',
      ],
    },
    fixed: {
      de: [
        'Sofort-Sperre für vorgeladene Queue-Titel griff nie — Titel konnten doppelt vorgeladen werden',
        '✕ an der Künstler-Kachel warf einen Fehler statt den Künstler zu entfernen',
        'Fehlgeschlagener Album-Abruf (z.B. 403) wurde 24h als „keine Alben" gecacht — auch auf dem Sync-Server',
        'Gleichzeitige Token-Erneuerung konnte zum ungewollten Logout führen',
        'Album-Blacklist wurde nicht zum Sync-Server übertragen',
        'Live-Filter warf Alben wie „Deliverance" oder „Alive" fälschlich raus',
        'Round Robin wurde beim Shuffle-Button von Smart Shuffle überschrieben',
        'Tastenkürzel fingen Browser-Shortcuts ab (Strg+F öffnete das Vollbild)',
        'Login-Button reagierte nach fehlgeschlagenem Login nicht mehr',
        'Nach Logout lief der stumme Medientasten-Anker weiter',
        'Tabs im Album-Fenster zeigten „tab_albums" statt Text; Platzhalterbild für Künstler ohne Bild',
      ],
      en: [
        'Immediate lock for pre-loaded queue tracks never applied — tracks could be queued twice',
        '✕ on the artist card threw an error instead of removing the artist',
        'Failed album fetch (e.g. 403) was cached as "no albums" for 24h — on the sync server too',
        'Concurrent token refresh could cause an unwanted logout',
        'Album blacklist was not sent to the sync server',
        'Live filter wrongly dropped albums like "Deliverance" or "Alive"',
        'Round Robin was overridden by Smart Shuffle on the shuffle button',
        'Keyboard shortcuts swallowed browser shortcuts (Ctrl+F opened fullscreen)',
        'Login button stopped working after a failed login',
        'Silent media-key anchor kept running after logout',
        'Album window tabs showed "tab_albums" instead of text; placeholder image for artists without a picture',
      ],
    },
  },
  {
    version: '1.5.1',
    date: '2026-08-19',
    label: { de: 'Shuffle-Fairness & Genre zurück', en: 'Shuffle Fairness & Genre Back' },
    added: {
      de: [
        'Genre-Shuffle wieder aktiviert — die Spotify-Suche funktioniert mit dem seit Feb 2026 gültigen Limit (max. 10) wieder; der "Invalid limit"-Fehler kam nur vom zu hohen alten Limit, nicht von einer Sperre',
      ],
      en: [
        'Genre shuffle re-enabled — Spotify search works again with the limit valid since Feb 2026 (max. 10); the "Invalid limit" error was only caused by the old too-high limit, not by a restriction',
      ],
    },
    fixed: {
      de: [
        'Shuffle-Fairness — einzelne Songs kamen deutlich öfter als andere. Ursache: vorgeladene Queue-Tracks landeten erst beim Abspielen in der Wiederholungssperre, wodurch dieselben Tracks mehrfach gezogen werden konnten. Jetzt wird jeder gewählte Track sofort gesperrt',
        'Track-Auswahl gleichverteilt — alle Tracks aller Alben werden zusammen betrachtet statt erst ein Album, dann ein Track (verhinderte Übergewichtung von Singles/kurzen Alben)',
        'Stats zurücksetzen — leere Statistik wird jetzt sofort zum Sync-Server geschrieben; vorher kamen die alten Stats beim nächsten Start zurück',
      ],
      en: [
        'Shuffle fairness — individual songs came up far more often than others. Cause: pre-loaded queue tracks only entered the repeat lock when played, so the same tracks could be drawn multiple times. Every chosen track is now locked immediately',
        'Even track selection — all tracks from all albums are pooled together instead of picking an album first, then a track (prevented over-weighting of singles/short albums)',
        'Reset stats — the empty statistic is now written to the sync server immediately; previously the old stats returned on next start',
      ],
    },
    changed: {
      de: [
        'market-Parameter — nutzt jetzt fest den Ländercode DE, da Spotify das country-Feld aus /me entfernt hat (Feb 2026)',
      ],
      en: [
        'market parameter — now uses fixed country code DE since Spotify removed the country field from /me (Feb 2026)',
      ],
    },
  },
  {
    version: '1.5.0',
    date: '2026-06-19',
    label: { de: 'Kompakte Menüs & API-Anpassungen', en: 'Compact Menus & API Fixes' },
    added: {
      de: [
        'Kompaktes Listen-Dropdown — Klick auf den Listennamen öffnet ein schlankes Dropdown direkt darunter statt eines Sheets über die volle Breite',
        'Kompaktes Optionen-Menü — die drei Punkte öffnen jetzt ebenfalls ein kompaktes Dropdown',
        'Listen-Zähler zeigt Artists + Alben zusammen (vorher nur Artists)',
      ],
      en: [
        'Compact list dropdown — clicking the list name opens a slim dropdown right below it instead of a full-width sheet',
        'Compact options menu — the three-dot button now also opens a compact dropdown',
        'List counter shows artists + albums combined (was artists only)',
      ],
    },
    changed: {
      de: [
        'market-Parameter — nutzt jetzt den echten Ländercode des Accounts statt des abgekündigten "from_token" (verursachte HTTP 400)',
      ],
      en: [
        'market parameter — now uses the account\'s actual country code instead of the deprecated "from_token" (was causing HTTP 400)',
      ],
    },
    removed: {
      de: [
        'Genre-Shuffle entfernt — Spotify hat die Track-Suche (type=track) für Development-Mode-Apps ohne Extended Quota gesperrt (HTTP 400 "Invalid limit" = fehlender Katalog-Zugriff). Wie schon bei "Ähnliche Artists" eine bewusste Spotify-Einschränkung, kein App-Fehler',
      ],
      en: [
        'Genre shuffle removed — Spotify has restricted track search (type=track) for Development Mode apps without Extended Quota (HTTP 400 "Invalid limit" = missing catalog access). Like "Similar Artists" before, this is a deliberate Spotify restriction, not an app bug',
      ],
    },
  },
  {
    version: '1.4.2',
    date: '2026-06-18',
    label: { de: 'Token-Handling & Fixes', en: 'Token Handling & Fixes' },
    changed: {
      de: [
        'Spotify Refresh-Token-Ablauf vorbereitet — ab 20. Juli 2026 laufen Refresh-Tokens nach 6 Monaten ab; bei abgelaufenem Token (invalid_grant) wird automatisch zum Login weitergeleitet, keine Datenverluste (Listen/Stats/Blacklist/History liegen auf dem Sync-Server)',
      ],
      en: [
        'Prepared for Spotify refresh token expiry — starting July 20, 2026 refresh tokens expire after 6 months; on expired token (invalid_grant) the app redirects to login automatically, no data loss (lists/stats/blacklist/history live on the sync server)',
      ],
    },
    fixed: {
      de: [
        'Künstler-Kachel öffnet wieder das Album-/Track-Status-Fenster (durch versehentlichen Code-Rest beim Discovery-Entfernen blockiert)',
        'Fortschrittsbalken — Punkt (Thumb) folgt jetzt korrekt der Wiedergabeposition statt am rechten Rand zu kleben',
      ],
      en: [
        'Artist card opens the album/track-status modal again (was blocked by leftover code from Discovery removal)',
        'Progress bar — the thumb now follows the playback position correctly instead of sticking to the right edge',
      ],
    },
  },
  {
    version: '1.4.1',
    date: '2026-05-18',
    label: { de: 'Light Mode & Restore', en: 'Light Mode & Restore' },
    added: {
      de: [
        'Light Mode — vollständiges helles Theme, folgt automatisch dem System (prefers-color-scheme), manuell überschreibbar per 🌙/☀️ Button im Header',
        'Letzter Track wiederherstellen — beim Öffnen der App wird der zuletzt gespielte Track angezeigt; Play startet ihn von vorne',
        '🗑️ Track-History leeren — Button im Stats-Tab löscht die gesamte Artist-Track-History sofort lokal und auf dem Server',
      ],
      en: [
        'Light mode — full light theme, follows system preference (prefers-color-scheme) automatically, manually overridable via 🌙/☀️ button in header',
        'Last track restore — on app open the last played track is shown; pressing Play starts it from the beginning',
        '🗑️ Clear track history — button in Stats tab clears the entire artist track history immediately, locally and on server',
      ],
    },
    changed: {
      de: [
        'Player-Buttons — Hover-Farbe auf Ember Orange geändert (war grau)',
        'Play/Pause-Button — Hover auf Ember Orange, im Ruhezustand neutral (war immer orange)',
        'Sidebar — rechte Ecken abgerundet',
        'Artist-Name und Albumname unter dem Cover — besserer Kontrast im Light Mode',
      ],
      en: [
        'Player buttons — hover color changed to Ember orange (was gray)',
        'Play/Pause button — hover shows Ember orange, idle state neutral (was always orange)',
        'Sidebar — right corners rounded',
        'Artist name and album name below cover — better contrast in light mode',
      ],
    },
  },
  {
    version: '1.4.0',
    date: '2026-05-09',
    label: { de: 'Cache & History Release', en: 'Cache & History Release' },
    added: {
      de: [
        'Track-Status Tab im Album-Browser — zeigt alle Tracks eines Artists mit Status ✅ gespielt / 🔒 noch offen',
        'Track-Cache auf dem Sync-Server — Album-Tracks werden serverseitig gecacht (/api/tracks), eliminiert 429er nach dem ersten Durchlauf',
        'Track-History Sync — gespielte Tracks pro Artist werden geräteübergreifend gespeichert (/api/track-history)',
        'Track-History Persistenz — artistTrackHistory wird in localStorage gespeichert, überlebt Browser-Neustart',
        '🔒 Keine Track-Wiederholungen — neuer Filter pro Liste, schaltet die Artist-Track-Sperre ein/aus (Standard: aktiv)',
        'PWA Icons auf SF-Logo aktualisiert (96, 128, 192, 512px)',
      ],
      en: [
        'Track status tab in album browser — shows all tracks for an artist with status ✅ played / 🔒 still locked',
        'Track cache on sync server — album tracks cached server-side (/api/tracks), eliminates 429s after first run',
        'Track history sync — played tracks per artist stored across devices (/api/track-history)',
        'Track history persistence — artistTrackHistory saved to localStorage, survives browser restart',
        '🔒 No track repeats — new per-list filter to toggle the artist track lock on/off (default: on)',
        'PWA icons updated to SF logo (96, 128, 192, 512px)',
      ],
    },
    changed: {
      de: [
        'Discovery (Ähnliche Artists) entfernt — Spotify hat diesen Endpunkt für Development Mode Apps dauerhaft gesperrt',
        'Live-Filter prüft jetzt auch Tracknamen auf eindeutige Muster (" live", "(live", "live at ", "live in ")',
        'manifest.json theme_color auf Ember Orange (#E8600A) aktualisiert',
        'DEPLOYMENT.md, CONTRIBUTING.md, SYNC-SERVER.md komplett neu geschrieben',
      ],
      en: [
        'Discovery (Similar Artists) removed — Spotify has permanently restricted this endpoint for Development Mode apps',
        'Live filter now also checks track names for unambiguous patterns (" live", "(live", "live at ", "live in ")',
        'manifest.json theme_color updated to Ember Orange (#E8600A)',
        'DEPLOYMENT.md, CONTRIBUTING.md, SYNC-SERVER.md completely rewritten',
      ],
    },
  },
  {
    version: '1.3.3',
    date: '2026-04-25',
    label: { de: 'Sideforge & Blacklist-Sync', en: 'Sideforge & Blacklist Sync' },
    added: {
      de: [
        'Sideforge Design System migriert — Ember-Orange Palette, Anvil-Grautöne (ersetzt Spotify-Grün)',
        'Sideforge Logo (SF-Monogramm) im Sidebar-Header neben der Version',
        'Sideforge Logo als Favicon (SVG)',
        'Blacklist-Sync — gesperrte Tracks werden geräteübergreifend über den Sync-Server synchronisiert',
        'Sync-Server: /api/blacklist Endpunkt (GET/POST), blacklist.json in /data/',
        'Verdana als UI-Schrift (Sideforge v1.0.1) — keine Google Fonts mehr, schnellerer Start',
      ],
      en: [
        'Sideforge Design System migrated — Ember orange palette, Anvil warm grays (replaces Spotify green)',
        'Sideforge logo (SF monogram) in sidebar header next to version button',
        'Sideforge logo as favicon (SVG)',
        'Blacklist sync — blacklisted tracks synced across devices via sync server',
        'Sync server: /api/blacklist endpoint (GET/POST), blacklist.json in /data/',
        'Verdana as UI font (Sideforge v1.0.1) — no Google Fonts, faster page load',
      ],
    },
    changed: {
      de: [
        'Google Fonts (Syne, DM Sans) entfernt — Verdana ist auf Windows/macOS/Linux vorinstalliert',
        'Sync-Server /api/health gibt jetzt auch Blacklist-Count zurück',
        'Blacklist-Sync mit Merge-Logik — lokale Einträge bleiben erhalten wenn sie nicht auf dem Server sind',
      ],
      en: [
        'Google Fonts (Syne, DM Sans) removed — Verdana is pre-installed on Windows/macOS/Linux',
        'Sync server /api/health now also returns blacklist count',
        'Blacklist sync uses merge logic — local entries are preserved if not on server',
      ],
    },
  },
  {
    version: '1.3.2',
    date: '2026-04-25',
    label: { de: 'Sideforge v1.0.1 — Verdana', en: 'Sideforge v1.0.1 — Verdana' },
    changed: {
      de: [
        'Schrift auf Verdana umgestellt (Sideforge Design System v1.0.1) — keine Webfont-Downloads mehr, einheitlicher Look auf Windows/macOS/Linux',
        'Google Fonts (Syne, DM Sans) entfernt — schnellerer Seitenstart, kein externer Request mehr',
        'Logo-Schrift (Georgia italic) und Mono-Bereiche unverändert',
      ],
      en: [
        'Font switched to Verdana (Sideforge Design System v1.0.1) — no webfont downloads, consistent look on Windows/macOS/Linux',
        'Google Fonts (Syne, DM Sans) removed — faster page load, no external font request',
        'Logo font (Georgia italic) and mono areas unchanged',
      ],
    },
  },
  {
    version: '1.3.1',
    date: '2026-04-22',
    label: { de: 'Album Blacklist', en: 'Album Blacklist' },
    added: {
      de: ['Album-Blacklist-Button in den Player-Controls — ganzes Album auf einmal sperren (💿-Button neben dem Track-Blacklist-Button)'],
      en: ['Album blacklist button in player controls — blacklist entire album at once (💿 button next to track blacklist button)'],
    },
    fixed: {
      de: ['Album-ID wird jetzt im currentTrack gespeichert — wird für Album-Blacklist benötigt'],
      en: ['Album ID now stored in currentTrack — required for album blacklist feature'],
    },
  },
  {
    version: '1.3.0',
    date: '2026-04-22',
    label: { de: 'Filter & Shuffle Release', en: 'Filter & Shuffle Release' },
    added: {
      de: [
        'Akustik-Filter — Tracks mit "acoustic", "unplugged", "stripped" usw. im Track- oder Albumnamen ausblenden (pro Liste)',
        'Orchestral-Filter — Tracks mit "orchestral" im Track- oder Albumnamen ausblenden (pro Liste)',
        'Artist-Wiederholung konfigurierbar — Anzahl der Tracks zwischen zwei Tracks desselben Artists einstellbar (pro Liste)',
        'Blacklist-Button direkt im Verlauf — 🚫 neben jedem Track ohne Shortcut-Workaround',
        'Round-Robin Modus — je ein Song pro Artist reihum, zufällig gemischt, Button im Player',
        'Track-Sperre pro Artist — jeder Track wird erst wieder gespielt wenn die gesamte Diskografie durch ist',
      ],
      en: [
        'Acoustic filter — hide tracks with "acoustic", "unplugged", "stripped" etc. in track or album name (per list)',
        'Orchestral filter — hide tracks with "orchestral" in track or album name (per list)',
        'Artist repeat limit configurable — set number of tracks between repeats of the same artist (per list)',
        'Blacklist button in history — 🚫 next to every track without needing the keyboard shortcut',
        'Round Robin mode — one song per artist in turn, randomly shuffled, button in player',
        'Per-artist track lock — each track is only repeated after the entire discography has been played',
      ],
    },
    changed: {
      de: [
        'Live-Filter prüft jetzt auch den Tracknamen — "Far from the Fame - Live, at Wacken" wird korrekt gefiltert',
        'Artist-Cooldown nach Round-Robin — die letzten 5 Artists werden nach Deaktivierung für 5 Songs gesperrt',
        'fillQueue im Round-Robin nutzt dieselbe Artist-Reihenfolge wie doShuffle — kein Durcheinander mehr',
      ],
      en: [
        'Live filter now also checks track name — "Far from the Fame - Live, at Wacken" correctly filtered',
        'Artist cooldown after Round Robin — last 5 artists locked for 5 songs after deactivation',
        'fillQueue in Round Robin uses same artist order as doShuffle — no more out-of-order picks',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-04-03',
    label: { de: 'Sync & Filter Release', en: 'Sync & Filter Release' },
    added: {
      de: [
        'Stats-Sync — Wiedergabe-Statistiken werden geräteübergreifend über den Sync-Server gespeichert',
        'Album-Cache auf dem Sync-Server — Spotify API Calls werden nach dem ersten Abruf serverübergreifend gecacht (24h TTL)',
        'Instrumental-Filter — Tracks mit "instrumental", "karaoke", "backing track" usw. im Namen ausblenden (pro Liste)',
        'config.js: syncStats Flag — Stats-Sync unabhängig von Listen-Sync deaktivierbar',
      ],
      en: [
        'Stats sync — play statistics stored across devices via sync server',
        'Server-side album cache — Spotify API calls cached on sync server after first fetch (24h TTL)',
        'Instrumental filter — hide tracks with "instrumental", "karaoke", "backing track" etc. in name (per list)',
        'config.js: syncStats flag — disable stats sync independently of list sync',
      ],
    },
    changed: {
      de: [
        'Spotify 429 Rate Limit: bis zu 3 Retries statt 1 — Musik läuft bei vorübergehenden Limits weiter',
        'Rate Limit Recovery: automatischer Shuffle-Retry nach 35s statt Musik-Stopp',
        'fillQueue startet 20s nach dem ersten Track — gibt Server-Cache Zeit zum Laden',
        'Stats-Debounce: 30s Verzögerung vor Server-Sync (statt pro Song)',
        'Sync-Server: /api/health gibt jetzt auch Anzahl der gecachten Plays zurück',
      ],
      en: [
        'Spotify 429 rate limit: up to 3 retries instead of 1 — music continues during temporary limits',
        'Rate limit recovery: automatic shuffle retry after 35s instead of stopping',
        'fillQueue starts 20s after first track — gives server cache time to load',
        'Stats debounce: 30s delay before server sync (instead of per song)',
        'Sync server: /api/health now also returns cached play count',
      ],
    },
  },
  {
    version: '1.1.2',
    date: '2026-03-29',
    label: { de: 'Aufräum & Balance Release', en: 'Cleanup & Balance Release' },
    added: {
      de: [
        'Künstler-Bereich mit Anzahl — "🎤 Künstler (31)" über dem Grid',
        'Alben-Bereich zeigt Anzahl — "🎵 Alben (2)"',
        'Beschriftungen wechseln mit DE/EN Toggle',
      ],
      en: [
        'Artist section header with count — "🎤 Artists (31)" above grid',
        'Album section now shows count — "🎵 Albums (2)"',
        'Section labels switch with DE/EN toggle',
      ],
    },
    changed: {
      de: [
        'Artists haben 3× Gewicht gegenüber Alben (1×) — verhindert Alben-Dominanz',
        'Komplettes Code-Rewrite — app.js von 3039 auf ~1900 Zeilen (−37%)',
        'spotify-api.js von 651 auf 300 Zeilen (−54%)',
        'Start-API-Calls verzögert — weniger 429 beim Laden',
        'Geräte-Refresh alle 2 Minuten statt 30 Sekunden',
        'Player-State Polling alle 15 Sekunden statt 5 Sekunden',
      ],
      en: [
        'Artist pool weight 3× vs albums (1×) — prevents album dominance',
        'Complete code rewrite — app.js from 3039 to ~1900 lines (−37%)',
        'spotify-api.js from 651 to 300 lines (−54%)',
        'Startup API calls delayed — fewer 429 on page load',
        'Device refresh every 2 minutes instead of 30 seconds',
        'Player state polling every 15 seconds instead of 5 seconds',
      ],
    },
    fixed: {
      de: [
        'fillQueue referenzierte undefinierte Variable — Nächster Song funktioniert immer',
        'duplicateActiveList kopiert jetzt korrekt Alben',
        'Toter Code entfernt (Like-Sektion, ungenutzte Funktionen)',
      ],
      en: [
        'fillQueue referenced undefined variable — next track always works now',
        'duplicateActiveList now correctly copies albums',
        'Dead code removed (Like section, unused functions)',
      ],
    },
  },
  {
    version: '1.1.2', date: '2026-03-29',
    label: { de: 'Bugfix Release', en: 'Bugfix Release' },
    fixed: {
      de: ['Shuffle vollkommen zufällig — Artists, Alben und Genres gleichberechtigt im Pool', 'Listen mit nur Alben funktionieren korrekt', 'Skip sofort wenn Queue gefüllt', 'Leere Queue fällt auf Shuffle zurück'],
      en: ['Shuffle truly random — artists, albums and genres in equal pool', 'Albums-only lists now work correctly', 'Skip instant when queue has tracks', 'Empty queue falls back to direct shuffle'],
    },
    changed: {
      de: ['Jeder Artist und jedes Album hat gleiche Chance', 'Smart Shuffle bleibt aktiv'],
      en: ['Each artist and album has equal chance', 'Smart Shuffle still active'],
    },
  },
  {
    version: '1.1.0', date: '2026-03-28',
    label: { de: 'Mobile & Alben Release', en: 'Mobile & Albums Release' },
    added: {
      de: ['Alben zur Liste hinzufügen via Diskografie-Browser', 'Album-Suche ohne Artist hinzuzufügen', 'Mobile Mini-Player', 'Mobile Geräte-Auswahl', 'Mobile Shuffle-Button', 'iOS Unterstützung (teilweise)', 'Top Songs erweiterbar'],
      en: ['Add albums via discography browser', 'Album search without adding artist', 'Mobile mini player', 'Mobile device selector', 'Mobile shuffle button', 'iOS support (partial)', 'Expandable top songs'],
    },
    changed: {
      de: ['Artist-Grid 2 Spalten, alphabetisch', 'Filter-Toggle-Buttons', 'Album-Cache 24h', 'API Throttle 1 req/s'],
      en: ['Artist grid 2 columns, alphabetical', 'Filter toggle buttons', 'Album cache 24h', 'API throttle 1 req/s'],
    },
    fixed: {
      de: ['iOS Scrolling', 'Bottom Sheet Menü', 'Mobile Layout ohne unsichtbaren Player'],
      en: ['iOS scrolling', 'Bottom sheet menu', 'Mobile layout without invisible player'],
    },
  },
  {
    version: '1.0.2', date: '2026-03-27',
    label: { de: 'Bugfix Release', en: 'Bugfix Release' },
    added: {
      de: ['Alphabetische Sortierung', 'Filter-Toggle-Buttons', 'Track-Tooltips'],
      en: ['Alphabetical sorting', 'Filter toggle buttons', 'Track tooltips'],
    },
    fixed: {
      de: ['Artist-Cards scrumpfen nicht mehr', 'Jahres-Filter immer aktiv'],
      en: ['Artist cards no longer shrink', 'Year filters always active'],
    },
  },
  {
    version: '1.0.0', date: '2026-03-26',
    label: { de: 'Erster Release', en: 'Initial Release' },
    added: {
      de: ['Shuffle durch gesamte Diskografie', 'Smart Shuffle', 'Favoriten-Artists', 'Genre-Listen', 'Queue & Verlauf', 'Blacklist', 'Crossfade', 'Auto-Skip', 'Shuffle-Log', 'Listen-Verwaltung', 'Import / Export', 'Sync-Server', 'PWA', 'Vollbild', 'Statistiken', 'Mehrsprachig', 'Tastatur-Shortcuts'],
      en: ['Full discography shuffle', 'Smart Shuffle', 'Favorite artists', 'Genre lists', 'Queue & history', 'Blacklist', 'Crossfade', 'Auto-Skip', 'Shuffle log', 'List management', 'Import / Export', 'Sync server', 'PWA', 'Fullscreen', 'Statistics', 'Multilingual', 'Keyboard shortcuts'],
    },
  },
];
