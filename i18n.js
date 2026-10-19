/* ═══════════════════════════════════════════════════════
   MUSIC SHUFFLE — i18n.js
   Internationalization — Deutsch / English
   ═══════════════════════════════════════════════════════ */

'use strict';

const I18N = (() => {

  const strings = {
    de: {
      // Login
      login_title: 'Deine Musik.\nDein Shuffle.',
      login_sub: 'Verbinde deinen Spotify-Account und shuffle durch deine liebsten Artists und Genres — ohne Algorithmus, nur deine Auswahl.',
      login_client_id_label: 'Spotify Client ID',
      login_client_id_placeholder: 'z.B. abc123def456…',
      login_client_id_hint: 'App erstellen unter',
      login_redirect_hint: 'Redirect URI eintragen:',
      login_btn: 'Mit Spotify einloggen',
      login_note: '⚠️ Erfordert Spotify Premium für die Web-Wiedergabe.',

      // Nav
      nav_lists: 'Listen',
      nav_queue: 'Queue',
      nav_history: 'Verlauf',
      nav_stats: 'Stats',
      nav_log: 'Log',
      nav_blacklist: 'Blacklist',

      // Lists
      list_new_placeholder: 'z.B. Metal Abend, Gym Rotation…',
      list_new_title: 'Neue Liste erstellen',
      list_rename_title: 'Liste umbenennen',
      list_delete_title: 'Liste löschen?',
      list_delete_confirm: 'Diese Aktion kann nicht rückgängig gemacht werden.',
      list_empty: 'Keine Artists in dieser Liste',
      list_empty_sub: 'Suche oben nach Artists zum Hinzufügen',
      list_none: '— Keine Listen —',
      list_rename: '✏️ Umbenennen',
      list_duplicate: '📋 Duplizieren',
      list_merge: '🔀 Liste einmischen',
      list_export: '📤 Exportieren',
      list_import: '📥 Importieren',
      list_delete: '🗑️ Liste löschen',
      list_merge_title: '🔀 Liste einmischen',
      list_merge_sub: 'Welche Liste soll in die aktive Liste eingemischt werden?',

      // Search
      search_artist_placeholder: 'Artist suchen und hinzufügen…',
      search_album_artist_placeholder: 'Artist für Album-Suche…',
      search_genre_placeholder: 'Genre suchen und hinzufügen…',
      search_loading: 'Suche…',
      search_empty: 'Keine Artists gefunden',
      search_genre_empty: 'Keine Genres gefunden',
      search_selected: ' ausgewählt',
      search_add_btn: '✚ Alle hinzufügen',

      // Filters
      filter_title: 'Filter',
      filter_no_live: '🚫 Keine Live-Alben',
      filter_no_instrumental: '🎼 Keine Instrumentals',
      filter_no_acoustic: '🎸 Keine Akustik-Versionen',
      filter_no_orchestral: '🎻 Keine Orchestral-Versionen',
      filter_no_commentary: '🎙️ Keine Kommentar-Tracks',
      tab_albums: '🎵 Alben',
      tab_track_status: '📊 Track-Status',
      filter_artist_repeat_limit: '🔁 Artist-Wiederholung nach',
      filter_no_repeat: '🔒 Keine Track-Wiederholungen',
      stats_clear_history: '🗑️ History',
      toast_track_history_cleared: 'Track-History geleert — alle Tracks sind wieder freigegeben',
      filter_artist_repeat_limit_suffix: 'Tracks',
      filter_year_from: '📅 Ab Jahr',
      filter_year_from_placeholder: '1990',
      filter_year_to: '📅 Bis Jahr',
      filter_year_to_placeholder: '2025',

      // Player
      player_idle_hint: 'Wähle eine Liste und drücke Shuffle',
      player_shuffle: 'SHUFFLE',
      player_no_device: 'Kein Gerät aktiv',
      player_device_none: 'Kein Gerät',
      player_device_choose: '— Gerät wählen —',
      player_device_not_found: 'Keine Geräte gefunden — Spotify öffnen',

      // Queue
      queue_title: 'Queue',
      queue_empty: 'Queue ist leer',
      queue_empty_sub: 'Starte den Shuffle um die Queue zu füllen',
      queue_regenerate: '↻ Neu generieren',

      // History
      history_title: 'Verlauf',
      history_empty: 'Noch nichts gespielt',
      history_clear: 'Leeren',
      history_only_new: '🆕 Nur neue',
      history_playlist: '🎵 Playlist',

      // Stats
      stats_title: 'Statistiken',
      stats_plays: '🎵 Songs gespielt',
      stats_time: '⏱️ Hörzeit',
      stats_shuffles: '🎲 Shuffles',
      stats_top_artists: '🏆 Top Artists',
      stats_top_songs: '🎵 Top Songs',
      stats_sessions: '📅 Sessions (letzte Wochen)',
      stats_reset: 'Stats zurücksetzen',
      stats_range_7: '7 Tage',
      stats_range_30: '30 Tage',
      stats_range_all: 'Alles',

      // Shuffle Log
      log_title: 'Shuffle-Log',
      log_empty: 'Noch keine Shuffles',
      log_smart: 'Smart',

      // Blacklist
      blacklist_title: 'Blacklist',
      blacklist_empty: 'Blacklist ist leer',
      blacklist_empty_sub: 'Drücke B beim Abspielen um einen Song zu blockieren',
      blacklist_active: 'Aktiv',

      // Artist stats
      artist_stats_played: '🎵 Songs gespielt',
      artist_stats_time: '⏱️ Hörzeit',
      artist_stats_last: 'Zuletzt gespielt:',
      artist_stats_top: '🏆 Top Songs',
      artist_stats_none: 'Noch nicht gespielt',
      artist_stats_close: 'Schließen',

      // Discovery

      // Genres
      genres_label: '🎸 Genres',

      // Buttons / Controls
      btn_cancel: 'Abbrechen',
      btn_save: 'Speichern',
      btn_create: 'Erstellen',
      btn_delete: 'Löschen',
      btn_merge: 'Einmischen',
      btn_play: 'Abspielen',
      btn_remove: 'Entfernen',

      // Toasts
      toast_synced: 'Listen synchronisiert ✓',
      toast_sync_fail: 'Sync-Server nicht erreichbar',
      toast_list_created: 'Liste erstellt',
      toast_list_renamed: 'Liste umbenannt',
      toast_artist_added: 'hinzugefügt',
      toast_artist_exists: 'ist bereits in der Liste',
      toast_genre_added: 'Genre hinzugefügt',
      toast_no_artists: 'Keine Artists in der aktiven Liste!',
      toast_no_track: 'Kein passender Track gefunden',
      toast_autoskip: '⏭️ Auto-Skip: Track zu kurz',
      toast_queue_empty: 'Queue leer',
      toast_premium: 'Spotify Premium wird benötigt!',
      toast_device_none: 'Kein Wiedergabegerät aktiv. Bitte Gerät auswählen.',
      toast_device_changed: 'Gerät gewechselt',
      toast_repeat_on: 'Wiederholen: an',
      toast_repeat_off: 'Wiederholen: aus',
      toast_crossfade_on: '🎵 Crossfade aktiv',
      toast_crossfade_off: 'Crossfade deaktiviert',
      toast_autoskip_on: '⏭️ Auto-Skip aktiv',
      toast_autoskip_off: 'Auto-Skip deaktiviert',
      toast_smart_on: '🧠 Smart Shuffle aktiv',
      toast_smart_off: 'Smart Shuffle deaktiviert',
      toast_only_new_on: '🆕 Nur neue Songs aktiv',
      toast_only_new_off: 'Alle Songs',
      toast_notification_on: '🔔 Benachrichtigungen aktiviert',
      toast_notification_blocked: 'Benachrichtigungen blockiert — bitte in Browser-Einstellungen erlauben',
      toast_blacklisted: 'zur Blacklist hinzugefügt',
      toast_exported: 'Listen exportiert',
      toast_imported: 'Listen importiert',
      toast_import_fail: 'Import fehlgeschlagen',
      toast_stats_reset: 'Statistiken zurückgesetzt',
      toast_playlist_creating: 'Playlist wird erstellt…',
      toast_playlist_relogin: 'Keine Playlist-Berechtigung — bitte einmal ab- und wieder anmelden',
      // ── Tooltips (v1.6.1) ──
      tip_prev: 'Zurück (P)',
      tip_repeat: 'Wiederholen',
      tip_clear_track_history: 'Track-History löschen — alle Tracks werden wieder freigegeben',
      tip_sync: 'Sync',
      tip_smart_shuffle: 'Smart Shuffle — Artists die lange nicht gespielt wurden kommen öfter dran',
      tip_round_robin: 'Round Robin — je ein Song pro Artist',
      tip_play_pause: 'Play/Pause (Leertaste)',
      tip_options: 'Optionen',
      tip_next: 'Nächster (N)',
      tip_only_new: 'Nur Songs die noch nicht gespielt wurden',
      tip_new_list: 'Neue Liste',
      tip_mute: 'Stumm (M)',
      tip_sync_lists: 'Listen synchronisieren',
      tip_theme: 'Hell/Dunkel',
      tip_refresh_devices: 'Geräte aktualisieren',
      tip_blacklist_album: 'Ganzes Album blacklisten',
      tip_fullscreen: 'Vollbild (F)',
      tip_crossfade: 'Crossfade',
      tip_changelog: 'Changelog / Version',
      tip_blacklist: 'Blacklist (B)',
      tip_notifications: 'Benachrichtigungen aktivieren',
      tip_autoskip: 'Auto-Skip kurze Tracks',
      tip_save_playlist: 'Als Spotify-Playlist speichern',
      tip_logout: 'Abmelden',
      // ── Meldungen (v1.6.1) ──
      msg_no_embed: 'Music Shuffle kann nicht eingebettet werden.',
      msg_login_failed: 'Login fehlgeschlagen: {error}',
      msg_client_id_missing: 'Bitte erst eine Spotify Client ID eintragen',
      msg_new_list: 'Neue Liste',
      msg_my_list: 'Meine Liste',
      msg_list_created: 'Liste „{name}" erstellt',
      msg_merged: '{n} Artists aus „{name}" hinzugefügt',
      msg_artists: 'Künstler',
      msg_albums: 'Alben',
      msg_remove: 'Entfernen',
      msg_favorite: 'Favorit',
      msg_play: 'Abspielen',
      msg_add_blacklist: 'Zur Blacklist hinzufügen',
      msg_favorite_on: '⭐ {name} als Favorit markiert',
      msg_favorite_off: '{name} nicht mehr Favorit',
      msg_loading_tracks: 'Lade Tracks…',
      msg_loading_tracks_progress: 'Lade Tracks… {done}/{total} Alben',
      msg_track_status: '{played} / {total} gespielt — {open} noch offen',
      msg_error: 'Fehler: {error}',
      msg_choose_albums: 'Wähle Alben aus',
      msg_loading_discography: 'Lade Diskografie…',
      msg_add: 'Hinzufügen',
      msg_add_albums: '{n} Album/Alben hinzufügen',
      msg_albums_added: '{n} Album/Alben hinzugefügt',
      msg_add_n: '✚ {n} hinzufügen',
      msg_artists_added: '{n} Artists hinzugefügt',
      msg_notifications_active: 'Benachrichtigungen aktiv',
      msg_blacklisted: '„{name}" zur Blacklist hinzugefügt',
      msg_album_blacklisted: '💿 „{name}" — {n} Tracks zur Blacklist hinzugefügt',
      msg_album_load_failed: 'Fehler beim Laden des Albums: {error}',
      msg_invalid_format: 'Ungültiges Format',
      msg_lists_imported: '{n} Listen importiert',
      msg_import_failed: 'Import fehlgeschlagen: {error}',
      msg_week: 'Woche {n}: {songs} Songs',
      msg_history_empty: 'Verlauf ist leer',
      msg_playlist_created: '✓ „{name}" erstellt ({n} Songs)',
      msg_rate_limit: '⏳ Spotify Rate Limit — versuche in 35s erneut…',
      msg_sync_active: 'Sync aktiv ✓',
      msg_device_error: 'Geräte-Fehler: {error}',
      msg_rr_on: '🔁 Round Robin aktiv — je ein Song pro Artist',
      msg_rr_off: '🔁 Round Robin deaktiviert',
      msg_autoskip: '⏭️ Auto-Skip: {s}s',
      changelog_added: 'Hinzugefügt',
      changelog_changed: 'Geändert',
      changelog_fixed: 'Behoben',
      changelog_removed: 'Entfernt',
      toast_reconnecting: '🔄 Player-Verbindung verloren — verbinde neu…',
      toast_reconnected: '✓ Player wieder verbunden',
      toast_reconnect_failed: 'Player konnte nicht neu verbunden werden — bitte Seite neu laden',
      toast_device_gone: 'Wiedergabegerät nicht mehr erreichbar — bitte neu auswählen',
      toast_playlist_created: 'Playlist erstellt',
      toast_ready: 'Music Shuffle bereit ✓',
      toast_offline: 'Player offline',
      toast_no_lists_merge: 'Keine anderen Listen zum Mischen',
      toast_merged: 'Artists hinzugefügt',
      toast_duplicated: 'Liste erstellt',
      toast_favorite_on: 'als Favorit markiert',
      toast_favorite_off: 'nicht mehr Favorit',

      // Misc
      confirm_stats_reset: 'Statistiken wirklich zurücksetzen?',
      pwa_install: '🎲 Music Shuffle als App installieren',
      pwa_install_btn: 'Installieren',
      pwa_installed: 'App installiert! ✓',
      fullscreen_exit: 'Vollbild beenden',
      device_refresh: 'Geräte aktualisieren',
      logout: 'Abmelden',
    },

    en: {
      // Login
      login_title: 'Your Music.\nYour Shuffle.',
      login_sub: 'Connect your Spotify account and shuffle through your favorite artists and genres — no algorithm, just your picks.',
      login_client_id_label: 'Spotify Client ID',
      login_client_id_placeholder: 'e.g. abc123def456…',
      login_client_id_hint: 'Create an app at',
      login_redirect_hint: 'Add Redirect URI:',
      login_btn: 'Log in with Spotify',
      login_note: '⚠️ Spotify Premium required for web playback.',

      // Nav
      nav_lists: 'Lists',
      nav_queue: 'Queue',
      nav_history: 'History',
      nav_stats: 'Stats',
      nav_log: 'Log',
      nav_blacklist: 'Blacklist',

      // Lists
      list_new_placeholder: 'e.g. Metal Night, Gym Rotation…',
      list_new_title: 'Create new list',
      list_rename_title: 'Rename list',
      list_delete_title: 'Delete list?',
      list_delete_confirm: 'This action cannot be undone.',
      list_empty: 'No artists in this list',
      list_empty_sub: 'Search for artists above to add them',
      list_none: '— No lists —',
      list_rename: '✏️ Rename',
      list_duplicate: '📋 Duplicate',
      list_merge: '🔀 Merge list',
      list_export: '📤 Export',
      list_import: '📥 Import',
      list_delete: '🗑️ Delete list',
      list_merge_title: '🔀 Merge list',
      list_merge_sub: 'Which list should be merged into the active list?',

      // Search
      search_artist_placeholder: 'Search and add artists…',
      search_album_artist_placeholder: 'Search artist for albums…',
      search_genre_placeholder: 'Search and add genres…',
      search_loading: 'Searching…',
      search_empty: 'No artists found',
      search_genre_empty: 'No genres found',
      search_selected: ' selected',
      search_add_btn: '✚ Add all',

      // Filters
      filter_title: 'Filter',
      filter_no_live: '🚫 No live albums',
      filter_no_instrumental: '🎼 No instrumentals',
      filter_no_acoustic: '🎸 No acoustic versions',
      filter_no_orchestral: '🎻 No orchestral versions',
      filter_no_commentary: '🎙️ No commentary tracks',
      tab_albums: '🎵 Albums',
      tab_track_status: '📊 Track Status',
      filter_artist_repeat_limit: '🔁 Repeat artist after',
      filter_no_repeat: '🔒 No track repeats',
      stats_clear_history: '🗑️ History',
      toast_track_history_cleared: 'Track history cleared — all tracks are available again',
      filter_artist_repeat_limit_suffix: 'tracks',
      filter_year_from: '📅 From year',
      filter_year_from_placeholder: '1990',
      filter_year_to: '📅 To year',
      filter_year_to_placeholder: '2025',

      // Player
      player_idle_hint: 'Select a list and press Shuffle',
      player_shuffle: 'SHUFFLE',
      player_no_device: 'No device active',
      player_device_none: 'No device',
      player_device_choose: '— Choose device —',
      player_device_not_found: 'No devices found — open Spotify',

      // Queue
      queue_title: 'Queue',
      queue_empty: 'Queue is empty',
      queue_empty_sub: 'Start shuffling to fill the queue',
      queue_regenerate: '↻ Regenerate',

      // History
      history_title: 'History',
      history_empty: 'Nothing played yet',
      history_clear: 'Clear',
      history_only_new: '🆕 Only new',
      history_playlist: '🎵 Playlist',

      // Stats
      stats_title: 'Statistics',
      stats_plays: '🎵 Songs played',
      stats_time: '⏱️ Listening time',
      stats_shuffles: '🎲 Shuffles',
      stats_top_artists: '🏆 Top Artists',
      stats_top_songs: '🎵 Top Songs',
      stats_sessions: '📅 Sessions (last weeks)',
      stats_reset: 'Reset stats',
      stats_range_7: '7 days',
      stats_range_30: '30 days',
      stats_range_all: 'All time',

      // Shuffle Log
      log_title: 'Shuffle Log',
      log_empty: 'No shuffles yet',
      log_smart: 'Smart',

      // Blacklist
      blacklist_title: 'Blacklist',
      blacklist_empty: 'Blacklist is empty',
      blacklist_empty_sub: 'Press B while playing to block a song',
      blacklist_active: 'Active',

      // Artist stats
      artist_stats_played: '🎵 Songs played',
      artist_stats_time: '⏱️ Listening time',
      artist_stats_last: 'Last played:',
      artist_stats_top: '🏆 Top Songs',
      artist_stats_none: 'Not played yet',
      artist_stats_close: 'Close',

      // Discovery

      // Genres
      genres_label: '🎸 Genres',

      // Buttons / Controls
      btn_cancel: 'Cancel',
      btn_save: 'Save',
      btn_create: 'Create',
      btn_delete: 'Delete',
      btn_merge: 'Merge',
      btn_play: 'Play',
      btn_remove: 'Remove',

      // Toasts
      toast_synced: 'Lists synced ✓',
      toast_sync_fail: 'Sync server unreachable',
      toast_list_created: 'List created',
      toast_list_renamed: 'List renamed',
      toast_artist_added: 'added',
      toast_artist_exists: 'is already in the list',
      toast_genre_added: 'Genre added',
      toast_no_artists: 'No artists in the active list!',
      toast_no_track: 'No matching track found',
      toast_autoskip: '⏭️ Auto-Skip: track too short',
      toast_queue_empty: 'Queue empty',
      toast_premium: 'Spotify Premium required!',
      toast_device_none: 'No playback device active. Please select a device.',
      toast_device_changed: 'Device switched',
      toast_repeat_on: 'Repeat: on',
      toast_repeat_off: 'Repeat: off',
      toast_crossfade_on: '🎵 Crossfade active',
      toast_crossfade_off: 'Crossfade disabled',
      toast_autoskip_on: '⏭️ Auto-Skip active',
      toast_autoskip_off: 'Auto-Skip disabled',
      toast_smart_on: '🧠 Smart Shuffle active',
      toast_smart_off: 'Smart Shuffle disabled',
      toast_only_new_on: '🆕 Only new songs active',
      toast_only_new_off: 'All songs',
      toast_notification_on: '🔔 Notifications enabled',
      toast_notification_blocked: 'Notifications blocked — please allow in browser settings',
      toast_blacklisted: 'added to blacklist',
      toast_exported: 'Lists exported',
      toast_imported: 'Lists imported',
      toast_import_fail: 'Import failed',
      toast_stats_reset: 'Stats reset',
      toast_playlist_creating: 'Creating playlist…',
      toast_playlist_relogin: 'No playlist permission — please log out and back in once',
      // ── Tooltips (v1.6.1) ──
      tip_prev: 'Previous (P)',
      tip_repeat: 'Repeat',
      tip_clear_track_history: 'Clear track history — all tracks become available again',
      tip_sync: 'Sync',
      tip_smart_shuffle: 'Smart Shuffle — artists not played for a while come up more often',
      tip_round_robin: 'Round Robin — one song per artist in turn',
      tip_play_pause: 'Play/Pause (Space)',
      tip_options: 'Options',
      tip_next: 'Next (N)',
      tip_only_new: "Only songs that haven't been played yet",
      tip_new_list: 'New list',
      tip_mute: 'Mute (M)',
      tip_sync_lists: 'Sync lists',
      tip_theme: 'Light/Dark mode',
      tip_refresh_devices: 'Refresh devices',
      tip_blacklist_album: 'Blacklist whole album',
      tip_fullscreen: 'Fullscreen (F)',
      tip_crossfade: 'Crossfade',
      tip_changelog: 'Changelog / version',
      tip_blacklist: 'Blacklist (B)',
      tip_notifications: 'Enable notifications',
      tip_autoskip: 'Auto-skip short tracks',
      tip_save_playlist: 'Save as Spotify playlist',
      tip_logout: 'Log out',
      // ── Meldungen (v1.6.1) ──
      msg_no_embed: 'Music Shuffle cannot be embedded.',
      msg_login_failed: 'Login failed: {error}',
      msg_client_id_missing: 'Please enter a Spotify Client ID first',
      msg_new_list: 'New list',
      msg_my_list: 'My list',
      msg_list_created: 'List "{name}" created',
      msg_merged: '{n} artists added from "{name}"',
      msg_artists: 'Artists',
      msg_albums: 'Albums',
      msg_remove: 'Remove',
      msg_favorite: 'Favorite',
      msg_play: 'Play',
      msg_add_blacklist: 'Add to blacklist',
      msg_favorite_on: '⭐ {name} marked as favorite',
      msg_favorite_off: '{name} is no longer a favorite',
      msg_loading_tracks: 'Loading tracks…',
      msg_loading_tracks_progress: 'Loading tracks… {done}/{total} albums',
      msg_track_status: '{played} / {total} played — {open} left',
      msg_error: 'Error: {error}',
      msg_choose_albums: 'Choose albums',
      msg_loading_discography: 'Loading discography…',
      msg_add: 'Add',
      msg_add_albums: 'Add {n} album(s)',
      msg_albums_added: '{n} album(s) added',
      msg_add_n: '✚ Add {n}',
      msg_artists_added: '{n} artists added',
      msg_notifications_active: 'Notifications active',
      msg_blacklisted: '"{name}" added to blacklist',
      msg_album_blacklisted: '💿 "{name}" — {n} tracks added to blacklist',
      msg_album_load_failed: 'Could not load album: {error}',
      msg_invalid_format: 'Invalid format',
      msg_lists_imported: '{n} lists imported',
      msg_import_failed: 'Import failed: {error}',
      msg_week: 'Week {n}: {songs} songs',
      msg_history_empty: 'History is empty',
      msg_playlist_created: '✓ "{name}" created ({n} songs)',
      msg_rate_limit: '⏳ Spotify rate limit — retrying in 35s…',
      msg_sync_active: 'Sync active ✓',
      msg_device_error: 'Device error: {error}',
      msg_rr_on: '🔁 Round Robin on — one song per artist in turn',
      msg_rr_off: '🔁 Round Robin off',
      msg_autoskip: '⏭️ Auto-skip: {s}s',
      changelog_added: 'Added',
      changelog_changed: 'Changed',
      changelog_fixed: 'Fixed',
      changelog_removed: 'Removed',
      toast_reconnecting: '🔄 Player connection lost — reconnecting…',
      toast_reconnected: '✓ Player reconnected',
      toast_reconnect_failed: 'Could not reconnect the player — please reload the page',
      toast_device_gone: 'Playback device no longer reachable — please select another',
      toast_playlist_created: 'Playlist created',
      toast_ready: 'Music Shuffle ready ✓',
      toast_offline: 'Player offline',
      toast_no_lists_merge: 'No other lists to merge',
      toast_merged: 'artists added',
      toast_duplicated: 'List created',
      toast_favorite_on: 'marked as favorite',
      toast_favorite_off: 'removed from favorites',

      // Misc
      confirm_stats_reset: 'Really reset all stats?',
      pwa_install: '🎲 Install Music Shuffle as app',
      pwa_install_btn: 'Install',
      pwa_installed: 'App installed! ✓',
      fullscreen_exit: 'Exit fullscreen',
      device_refresh: 'Refresh devices',
      logout: 'Log out',
    },
  };

  let _lang = localStorage.getItem('as_lang') || 'de';

  // t('msg_list_created', { name: 'Metal' }) → „Liste „Metal" erstellt"
  function t(key, vars) {
    const str = strings[_lang]?.[key] || strings['de']?.[key] || key;
    if (!vars) return str;
    return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  }

  function setLang(lang) {
    _lang = lang;
    localStorage.setItem('as_lang', lang);
    applyAll();
  }

  function getLang() { return _lang; }

  // Apply all translations to DOM elements with data-i18n attribute
  function applyAll() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const val = t(key);
      if (el.dataset.i18nAttr) {
        // Set specific attribute (e.g. placeholder, title)
        el.setAttribute(el.dataset.i18nAttr, val);
      } else if (el.tagName === 'OPTION') {
        el.textContent = val;
      } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        if (el.placeholder !== undefined) el.placeholder = val;
      } else {
        el.textContent = val;
      }
    });

    // Tooltips: data-i18n-title="key" (unabhängig vom Textinhalt)
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });

    // Update html lang attribute
    document.documentElement.lang = _lang;

    // Dispatch event so app.js can react
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: _lang } }));
  }

  return { t, setLang, getLang, applyAll };

})();
