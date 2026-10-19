# Spell Tracker

A personal Windows overlay for League of Legends (Summoner's Rift) that tracks the enemy team's summoner spells. See `GLOSSARY.md` for the vocabulary and `docs/adr/` for decisions.

It only reads Riot's official Live Client Data API on `127.0.0.1:2999` (see ADR 0001).

## Settings

Optional file `%APPDATA%\spell-tracker\settings.json` (restart the app after editing; a missing file means the defaults):

```json
{ "shareKey": "`", "autoSend": true }
```

- `shareKey`: the system-wide Share key, an [Electron accelerator](https://www.electronjs.org/docs/latest/api/accelerator) such as `F8` or a single character. It is only claimed while a game is running.
- `autoSend`: when true, pressing the Share key types a message into team chat with simulated keystrokes (Enter, the text, Enter). For now the message is a fixed test message.

## Commands

| Command | What it does |
| --- | --- |
| `npm start` | Build and launch the app (tray icon with Exit; overlay appears when a game loads) |
| `npm run shortcut` | Build and put a "Spell Tracker" shortcut on the desktop (does not start with Windows) |
| `npm test` | Run the tests (Vitest) |
| `npm run typecheck` | Typecheck source and tests |
| `npm run capture -- <name>` | While a game is running, save its game-feed snapshot to `fixtures/<name>.json` with player identities scrubbed |
