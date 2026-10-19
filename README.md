# Spell Tracker

A personal Windows overlay for League of Legends (Summoner's Rift) that tracks the enemy team's summoner spells. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for decisions.

It only reads Riot's official Live Client Data API on `127.0.0.1:2999` (see ADR 0001).

## Settings

Optional file `%APPDATA%\spell-tracker\settings.json` (restart the app after editing; a missing file means the defaults):

```json
{ "shareKey": "`", "autoSend": false }
```

- `shareKey`: the system-wide Share key, a single character or a function key (`F1` to `F24`). It is only watched while a game is running. The key still reaches the game (a Windows hotkey would be swallowed, but League never lets those fire), so pick one League doesn't use.
- `autoSend` (default `false`): pressing the Share key presses Enter to open chat and types the message with simulated keystrokes, then stops so you can send it (press Enter) or copy it yourself. When `true` it also presses Enter at the end to send it. For now the message is a fixed test message.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Build and launch the app (tray icon with Exit; overlay appears when a game loads) |
| `npm run shortcut` | Build and put a "Spell Tracker" shortcut on the desktop (does not start with Windows) |
| `npm test` | Run the tests (Vitest) |
| `npm run typecheck` | Typecheck source and tests |
| `npm run capture -- <name>` | While a game is running, save its game-feed snapshot to `fixtures/<name>.json` with player identities scrubbed |
