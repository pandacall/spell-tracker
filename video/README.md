# Spell Tracker demo video

A ~27s promo edited in [Remotion](https://www.remotion.dev) over recorded gameplay, rendered as both a 16:9 landscape cut and a 9:16 vertical reel. An AI voiceover (Microsoft Edge neural voice) drives the timing: scene cuts land on spoken words and captions light up word by word.

Any clip not recorded yet shows a placeholder: a mock game screen with the overlay and chat in their real positions, so the camera moves can be checked before footage exists.

## Current footage

The clips come from Kafi's "Shaco & Teemo - Toxic Botlane Duo Ep 62" (https://www.youtube.com/watch?v=ThLFJ7wh0gk), which is published under **CC BY**. You can reuse it as long as you credit it. The end card shows the credit; put it in the post description too.

The Spell Tracker overlay and the team-chat Share are drawn on top of that game. They were not running in it.

- The overlay is a pixel copy of the app's styles, using the real Data Dragon icons. It sits where a player would drag it: the right edge, above the teammate portraits.
- The enemy team (Garen, Kayn, Ekko, Jhin, Senna) is read from the game's chat pings.
- Every Countdown follows that game's clock. The overlay Marks Jhin's Flash at 9:40, and the Share at ~10:00 reads `1230 mid 1440 bot`.

To re-create it:

```bash
.venv/Scripts/python -m pip install yt-dlp
.venv/Scripts/yt-dlp -f 299+140 --merge-output-format mp4 -o source/kafi-ep62.mp4 "https://www.youtube.com/watch?v=ThLFJ7wh0gk"
npm run cut
```

`footage.json` sets where each clip starts in the source video, the credit line, and the gap between video time and game clock (`gameClockOffset`). `MARKS` and `CLICKS` in `src/edit.ts` set what's down on the game clock. Run `npm run cut -- --force` after changing a clip's start.

## Recording the clips

To use your own recordings instead, record with OBS using **Display Capture**. Your recordings replace the cut clips. Set each clip's `start` in `footage.json` to the game-clock second it begins, minus `gameClockOffset`, so the drawn overlay matches the game clock. The real overlay will already be in your footage, so remove the `GameOverlay` and `ChatSim` layers in `src/Video.tsx`. Game Capture only grabs League and would leave the overlay out. Use League in **Borderless** mode at 1920x1080 (or 2560x1440) and 60 fps. Leave the overlay where it opens (15% across and 30% down the screen), or update `OVERLAY` in `src/edit.ts` if you move it.

Save each clip as `public/clips/<letter>.mp4`. `.mkv` recordings are remuxed to `.mp4` automatically. Each clip should be at least as long as its scene plus a little spare. If a clip is shorter, the edit holds its last frame.

| Clip | What to capture | Scene length |
| --- | --- | --- |
| A | An enemy Flashes in a fight or gank | 2.2s |
| B | The game loads and the overlay appears with the 5 Enemy rows | 5.3s |
| C | You click an enemy's Flash to Mark it and the Countdown starts (~1s in) | 3.5s |
| D | Several Countdowns running, ideally one Enemy with Lucidity Boots and a Teleport down | 3.4s |
| E | You press the Share key, chat opens, the Share Line types out, and you send it | 6.1s |
| F | A won fight or kill on someone without Flash | 2.5s |

If the moment you want starts partway into a recording, set that scene's `trim` (seconds) in `src/edit.ts`. Drop an optional music track in `public/music/`; it plays quietly under the voice.

## Commands

Run these from this folder. Do the first-time setup once:

```bash
npm install
python -m venv .venv
.venv/Scripts/python -m pip install edge-tts
```

| Command | What it does |
| --- | --- |
| `npm run studio` | Open Remotion Studio to preview and scrub both cuts |
| `npm run render` | Render `out/spell-tracker-landscape.mp4` and `out/spell-tracker-vertical.mp4` |
| `npm run voice` | Re-speak `voice/script.txt` (after editing the script or changing the voice) |
| `npm run voice -- --voice en-US-BrianMultilingualNeural --rate +10%` | Use a different voice or speed |
| `npm run typecheck` | Typecheck the edit |

`npm run studio` and `npm run render` re-scan `public/clips/` first, so a newly dropped clip is picked up automatically.

## Where things live

- `voice/script.txt` holds the voiceover text. The scene phrases in `src/edit.ts` must still appear in it.
- `src/edit.ts` is the edit decision list. It sets which clip plays from which spoken phrase, the camera keyframes (`x`, `y` and `zoom` over the recording, plus an optional `vzoom` for the vertical cut), the caption number formatting, and the Share Line shown on screen.
- `src/Placeholder.tsx` draws the stand-in footage.
- `src/Callouts.tsx` holds the logo badge, the Share key keycap, and the chat chip.
- `src/Outro.tsx` is the end card.
