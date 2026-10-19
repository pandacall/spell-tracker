# Spell Tracker

A personal Windows overlay for League of Legends (Summoner's Rift) that tracks the enemy team's summoner spells. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for decisions.

It only reads Riot's official Live Client Data API on `127.0.0.1:2999` (see ADR 0001).

## Install (Windows)

1. **[Download Spell-Tracker-Setup.exe](https://github.com/pandacall/spell-tracker/releases/latest/download/Spell-Tracker-Setup.exe)** and open it. If your browser says the file "isn't commonly downloaded", choose **Keep**.
2. Windows may show a blue **"Windows protected your PC"** box, because the app isn't from a big publisher. Click **More info**, then **Run anyway**.
3. It installs by itself in a few seconds and starts. No admin password is needed. You get a **Spell Tracker** shortcut on the desktop and in the Start Menu.

Using it:

- A small blue icon sits in the system tray, by the clock (it may be hidden under the `^` arrow). Right-click it and choose **Exit** to close the app.
- The overlay shows up by itself once a game has loaded.
- **Left-click** an enemy's spell when they use it to start its countdown. **Right-click** it to clear a mistake. Drag the handle to move the overlay.
- Press **`** (the key under Esc) to type the enemies' Flash timers into chat, then press Enter to send. That's the Share key; you can change it in Settings.
- If you can't see the overlay in game, set League's **Window Mode** to **Borderless** (Settings → Video).

Spell Tracker updates itself: it quietly downloads new versions in the background (never during a game) and installs them when you exit. When one is ready, the tray icon's menu also offers **Restart to update**. To uninstall, use Windows **Settings → Apps → Spell Tracker**.

## Settings

Right-click the tray icon → **Settings**, or click the tray icon. The window sets the Share key (click **Change** and press the key you want), whether Share also sends the message, and the overlay's size, opacity and position. Outside a game, **Show sample overlay** shows the overlay with made-up Enemies so you can adjust it and drag it into place. Changes apply right away.

Everything is saved in `%APPDATA%\spell-tracker\settings.json`, which you can also edit by hand (restart the app after editing; a missing file means the defaults):

```json
{ "shareKey": "`", "autoSend": false, "overlaySize": 100, "overlayOpacity": 50 }
```

- `shareKey`: the system-wide Share key, a single character, a function key (`F1` to `F24`), or `scan:` and a keyboard scan code (e.g. `scan:41`, the key under Esc), which is what the Settings window records. It is only watched while a game is running. The key still reaches the game (a Windows hotkey would be swallowed, but League never lets those fire), so pick one League doesn't use.
- `autoSend` (default `false`): what the Share key does with the Share Line (every Enemy whose Flash is down, e.g. `1230 mid 1440 bot`). It presses Enter to open chat and types the Share Line with simulated keystrokes, then stops so you can send it (press Enter) or edit it yourself. When `true` it also presses Enter at the end to send it. With no Flash down the Share key does nothing.
- `overlaySize` (default `100`): the overlay's size as a percent, from `75` to `150`.
- `overlayOpacity` (default `50`): how solid the overlay is drawn as a percent, from `20` to `100`.
- `overlayPosition`: where the overlay was last dragged to. The app writes it; Reset position in Settings removes it.

Unknown keys in the file are left alone. If the file isn't a JSON object (for example after a typo) when the app saves a setting, it is renamed to `settings.broken.json` and a fresh file is written.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Build and launch the app (tray icon with Settings and Exit; overlay appears when a game loads) |
| `npm run shortcut` | Build and put a "Spell Tracker" shortcut on the desktop (does not start with Windows) |
| `npm test` | Run the tests (Vitest) |
| `npm run typecheck` | Typecheck source and tests |
| `npm run capture -- <name>` | While a game is running, save its game-feed snapshot to `fixtures/<name>.json` with player identities scrubbed |
| `npm run dist` | Build the installer to `release/Spell-Tracker-Setup.exe` |

## Making a release

Bump `version` in `package.json` (installed copies only update to a higher version), run `npm run dist`, then attach all three files from `release/` to a new GitHub release. The tag must be `v` plus that version:

```bash
gh release create v0.2.0 release/Spell-Tracker-Setup.exe release/Spell-Tracker-Setup.exe.blockmap release/latest.yml --title "Spell Tracker 0.2.0" --notes "Download Spell-Tracker-Setup.exe below and open it."
```

Installed copies read `latest.yml` from the newest release to find updates, and use the `.blockmap` to download only what changed. The download link in Install always points at the newest release, so friends' links never go stale.
