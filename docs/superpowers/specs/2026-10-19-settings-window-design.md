# Settings window

## Why

Spell Tracker now ships as a one-click installer for friends, but every setting still lives in a hand-edited `%APPDATA%\spell-tracker\settings.json` that is only read at startup. The biggest pain is the Share key: the default is backtick ("the key under Esc"), which isn't where it is, or isn't a usable key, on many non-US keyboard layouts. Friends need a way to rebind it, and adjust the overlay, without touching JSON or restarting.

Success: a friend who has never opened `settings.json` can open a small window from the tray, press the key they want for Share, size and fade the overlay to taste while looking at it, and close the window. Everything takes effect immediately.

## Goals

- A small settings window opened from the tray.
- Rebind the Share key by pressing it, on any keyboard layout.
- Toggle auto-send.
- Change the overlay's size and opacity, with a way to see the overlay while doing it outside a game.
- Reset the overlay's position.
- Show the app version.
- Every change applies immediately and is saved to `settings.json`. There is no Save button and no restart.

## Non-goals

- Starting with Windows.
- Update controls such as "check now" or release notes. The tray's existing "Restart to update" stays as is.
- Opening the settings window automatically on first run.
- Any setting beyond those listed here.

## Anti-goals

These would make it a failure even if it technically works:

- Anything that needs a restart to take effect.
- Losing or mangling what is already in someone's `settings.json`. Existing files, including hand-edited ones, keep working.
- Changing anyone's overlay before they touch a slider. The defaults must look exactly like today: 28px icons at 50% opacity.
- Making the overlay harder to use in game. The settings window and sample overlay must never steal focus from League or get in the way during a game.
- A busy window. It should stay small enough to take in at a glance.

## Constraints

- Electron app, Windows only, TypeScript, tests in Vitest. Build on the existing modules: `src/settings`, `src/main/tray.ts`, `src/main/overlay-window.ts`, `src/main/windows-input.ts`, `src/share`.
- Settings stay in the same `settings.json`. New settings are added beside `shareKey`, `autoSend` and `overlayPosition`. A missing or wrong-typed value falls back to its default, the same way `parseSettings` already works. Writes preserve keys the app doesn't know about, as `saveOverlayPosition` does.
- The Share key is still only watched while a game is running. Values already in people's files (a single character or `F1` to `F24`, as accepted by `virtualKeyOf`) must keep working. See "Which key gets stored" below for what the window records.
- Use the glossary's terms in UI copy and code: Share key, Share Line, Countdown, Enemy, Role. If a new domain term is needed (for example "sample overlay"), add it to `GLOSSARY.md`.
- The ADR 0001 constraints on Share are unchanged.

## What was decided

### Opening it

- The tray menu gains a "Settings" item above "Exit". Clicking the tray icon also opens the window (my call).
- Opening it when it's already open brings the existing window to the front. There is only ever one.

### The window

A small window that can't be resized, with a plain, dark style that matches the overlay (my call). Top to bottom:

1. **Share key.** Shows the current key in a keycap-style box with a "Change" button. Clicking Change puts the box into "Press a key" mode. The next key pressed becomes the Share key. Esc cancels and keeps the old key. Modifier keys pressed on their own (Shift, Ctrl, Alt, AltGr, Win) are ignored, and the box keeps listening. Helper text: "Types the enemies' Flash timers into team chat during a game."
   - Enter, Tab and Space are refused with an inline message, and the box keeps listening (my call). Enter would break Share, because Share presses Enter itself and the user presses Enter to send. Tab and Space are core League keys (scoreboard, camera).
   - Any other key that produces a character, including a dead key, is accepted. So is F1–F24. Anything else, such as arrows, Home or Insert, is refused with the same inline message.
   - If the chosen key is one League also uses by default, an inline warning says pressing it will also do that in game. The key is still accepted, because the warning is advice and not a block. The list (my call) is Q W E R D F B P Y and 1–7. The builder may refine it.
   - If `settings.json` holds a Share key the app can't use, the box shows it with an error telling the user to pick another one.
2. **Send automatically.** A checkbox for `autoSend`. The helper text changes with its state. Off: "the timers are typed and you press Enter to send". On: "the timers are typed and sent straight away". Below it is an example Share Line: "Teammates see `1230 mid 1440 bot`".
3. **Overlay.**
   - **Size** slider from 75% to 150% in steps of 5%. The default is 100%, which means today's 28px icons. Everything on the overlay scales together, including icons, Countdown text and the drag handle. The overlay window grows or shrinks to fit, so nothing is clipped (ranges are my call).
   - **Opacity** slider from 20% to 100% in steps of 5%. The default is 50%, the same as today's ghosted look. It sets how faded the overlay's rows and drag handle are (ranges are my call).
   - **Reset position** button. It moves the overlay back to its default spot and clears the saved `overlayPosition`.
   - **Show sample overlay** button (see below).
4. **Footer.** The app version (`app.getVersion()`) and the note "Changes apply right away".

### Which key gets stored

My call: the window records the physical key that was pressed, not the character it typed. The motivating case is the key under Esc on non-US layouts, and it has to work.
- On German, French and Spanish layouts that key is a dead key (`^` or `` ` ``), and the browser reports it as `"Dead"` rather than as a character. Recording the physical key makes it work.
- Recording the physical key also keeps the Share key on the same key when a friend switches keyboard layouts, for example between Russian and English.
- Characters that need AltGr no longer quietly turn into a different key.

The stored form is a Windows virtual-key code or scan code, whichever the builder finds reliable from the window's key event. It is saved in a way that can't be confused with the existing forms, so a hand-written single character or `F1`–`F24` in `settings.json` keeps working exactly as today.

The keycap shows the key's label on the user's current layout, for example `^`, `ö` or `F5`.

### Applying changes

- Each change is saved to `settings.json` and takes effect at once. Saving happens as each control changes, and a slider saves when it is released, but the overlay follows it live while dragging (my call).
- A new Share key takes effect immediately. If a game is running, the watcher switches to the new key at once. Share also uses the current `autoSend` at the moment of each press, not the value from startup.
- Hand edits to `settings.json` still need a restart, as today (my call). There's no file watcher. Each save from the window, or from dragging the overlay, changes only the key that changed and leaves the rest of the file as it is on disk. That way a hand edit made since startup isn't undone.
- One write path serves both the window and overlay dragging (my call). If the file exists but isn't a JSON object, meaning broken JSON, an array or a number, that file is first renamed to `settings.broken.json`, replacing any earlier one. Then a fresh file is written. This way a friend's broken hand edit is never lost, and their settings still save. Today a drag leaves a broken file alone; that changes.

### Sample overlay

- "Show sample overlay" toggles the overlay on with sample content outside a game, so sliders can be judged by eye and the overlay can be dragged into place. The button's label changes to "Hide sample overlay" while it's showing.
- Sample content (my call) is five sample Enemies with real Data Dragon champion and spell icons. Each has Flash plus another common summoner spell. One Flash has a Countdown running so the timer text is visible, and it loops when it reaches zero.
- The sample overlay can be dragged, and dragging saves the position just like the real one. Clicking its spells does nothing (my call).
- It hides when the button is clicked again or when the settings window closes.
- During a game the button isn't shown, because the real overlay is already visible and the sliders affect it directly. If a game starts while the sample is showing, the real overlay replaces it and the button disappears. When the game ends, the button comes back in its "Show" state.

### Docs

- The README's Settings section leads with the settings window. It keeps the JSON file description, with its new keys, for anyone who prefers editing it, and still says hand edits need a restart.

## Left to the builder

- How the window talks to the main process (IPC shape, preload API) and how the renderer is structured. Keep it consistent with the overlay's sandboxed, context-isolated setup.
- How size scaling is done, for example a zoom factor or CSS variables, and the exact window sizes. The constraint is that nothing is clipped at 150% and the default is pixel-identical to today.
- How opacity is applied, as long as 50% looks like today.
- The exact stored form of a recorded physical key (see "Which key gets stored"). Modifiers held while pressing are not part of the Share key: pressing Shift+` records the same key as `.
- The names of the new settings keys in `settings.json`.
- Tests, following the existing pattern (`settings.test.ts`, etc.). At minimum, cover parsing and saving the new settings and live switching of the Share key.
