# Settings Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A small settings window, opened from the tray, where friends can record a Share key by pressing it, toggle auto-send, size and fade the overlay with a sample overlay to look at, and reset its position. Every change applies at once.

**Architecture:** Pure, tested modules hold the rules: settings parsing and saving, the Share key forms, the Share key watcher, and the sample overlay. `main.ts` wires them to Electron. A settings store holds the live settings, and every consumer reads from it at the moment of use, so nothing needs a restart. The settings window is a second sandboxed BrowserWindow with its own preload. Its page is a plain script, like the overlay's, and it asks main to judge each recorded key.

**Tech Stack:** Electron, TypeScript (CommonJS build, `moduleDetection: legacy`), koffi for Win32, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-settings-window-design.md`

## Global Constraints

- Defaults must look exactly like today: overlay size 100% (28px icons), opacity 50%.
- Size: 75–150% in steps of 5. Opacity: 20–100% in steps of 5.
- Existing `settings.json` values keep working: `shareKey` as a single character or `F1`–`F24`, plus `autoSend` and `overlayPosition`. Unknown keys in the file are preserved on every write.
- Hand edits to `settings.json` still need a restart. There's no file watcher.
- Enter, Tab and Space can never be recorded as the Share key.
- The ADR 0001 constraints on Share are unchanged: one press sends one message, and keystrokes are simulated in software only.
- UI copy uses sentence case and the glossary terms: Share key, Share Line, Countdown, Enemy.
- Commit messages follow the repo's style: one plain sentence, no prefix.
- Run `npm test` and `npm run typecheck` before every commit.

## Review Focus

1. **A Share key hand-edited in the old format** (`` ` ``, `F8`, `ö`) must still resolve exactly as before. A malformed new-format value (`scan:abc`, `scan:0`) must count as unusable and must not crash anything. Covered in Task 2.
2. **Pressing Shift, Ctrl or AltGr while recording, or with the key.** Modifier keys alone are ignored and the window keeps listening. Shift+`` ` `` records the same key as `` ` ``. Covered in Task 2.
3. **A `settings.json` that is broken JSON, an array, or a number when something saves.** It is moved to `settings.broken.json`, replacing any earlier one, and a fresh file is written. This also applies to dragging the overlay. Covered in Task 1.
4. **A hand edit made since startup**, followed by a change in the window. Only the changed key is written, so the hand edit survives on disk. Covered in Task 1.
5. **The Share key is changed during a game, or before one starts.** During a game the watcher switches at once. Outside a game nothing is watched until a game starts, and then the new key is used. Covered in Task 3.

---

### Task 1: Settings gain size and opacity, and one safe save path

**Files:**
- Modify: `src/settings/settings.ts`
- Modify: `src/settings/settings.test.ts`
- Modify: `src/main/main.ts` (switch the `saveOverlayPosition` call to the store)

**Interfaces:**
- Produces:
  - `Settings` gains `overlaySize: number` (a percent, default `100`) and `overlayOpacity: number` (a percent, default `50`).
  - `SettingsPatch = Partial<Omit<Settings, "overlayPosition">> & { overlayPosition?: { x: number; y: number } | null }`. `null` removes the key from the file.
  - `saveSettings(filePath: string, patch: SettingsPatch): void` replaces `saveOverlayPosition`.
  - `createSettingsStore(filePath: string): SettingsStore`, with `interface SettingsStore { current(): Settings; update(patch: SettingsPatch): Settings }`.

- [ ] **Step 1: Write the failing tests** in `settings.test.ts`. Update the existing default-shape expectations to include `overlaySize: 100, overlayOpacity: 50`. Replace the three `saveOverlayPosition` tests with `saveSettings` versions of the same, then add:

```ts
it("reads overlay size and opacity, clamping them into range and falling back when not numbers", () => {
  expect(parseSettings(JSON.stringify({ overlaySize: 120, overlayOpacity: 80 }))).toMatchObject({ overlaySize: 120, overlayOpacity: 80 });
  expect(parseSettings(JSON.stringify({ overlaySize: 400, overlayOpacity: 5 }))).toMatchObject({ overlaySize: 150, overlayOpacity: 20 });
  expect(parseSettings(JSON.stringify({ overlaySize: "big", overlayOpacity: null }))).toMatchObject({ overlaySize: 100, overlayOpacity: 50 });
});

it("writes only the changed setting, keeping hand edits made on disk since startup", () => {
  // file has { shareKey: "F8", note: "mine" }; store created; then file rewritten by hand to { shareKey: "F9", note: "mine" }
  store.update({ autoSend: true });
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ shareKey: "F9", note: "mine", autoSend: true });
});

it("removes the overlay position when patched with null", () => {
  // file has overlayPosition; saveSettings(file, { overlayPosition: null })
  expect(loadSettings(file).overlayPosition).toBeUndefined();
});

it.each(["{ not json", "[1, 2]", "42"])("moves an unusable settings file (%s) aside to settings.broken.json before saving", (text) => {
  // writeFileSync(file, text); also an older settings.broken.json with "old"
  saveSettings(file, { overlayPosition: { x: 1, y: 2 } });
  expect(readFileSync(path.join(dir, "settings.broken.json"), "utf8")).toBe(text);
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ overlayPosition: { x: 1, y: 2 } });
});

it("the store reflects each update without re-reading hand edits into its other settings", () => {
  // store over { shareKey: "F8" }; hand edit file to { shareKey: "F9" }; store.update({ overlaySize: 120 })
  expect(store.current()).toMatchObject({ shareKey: "F8", overlaySize: 120 });
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/settings/settings.test.ts`. Expected: FAIL, because `saveSettings` and `createSettingsStore` are not exported.

- [ ] **Step 3: Implement it in `settings.ts`.**
  - `parseSettings` reads the two percents. It clamps finite numbers to their range and rounds them to an integer, and anything else falls back to the default.
  - `saveSettings` reads the file. A missing file means `{}`. Text that isn't a JSON object is first renamed to `settings.broken.json` in the same folder (`renameSync`, which replaces any earlier one), then treated as `{}`. It merges the patch, deletes keys whose patch value is `null`, and writes with 2-space JSON.
  - The store keeps an in-memory `Settings`, which starts from `loadSettings`. `update` calls `saveSettings` and then merges the patch into memory. A `null` position becomes absent.
  - Delete `saveOverlayPosition`.

- [ ] **Step 4: Switch `main.ts`** to `const store = createSettingsStore(settingsPath)`, and change `onMoved` to `store.update({ overlayPosition: position })`. Other reads of `settings` become `store.current()` where they are read. Task 3 finishes the Share side.

- [ ] **Step 5: Run the tests and see them pass.** Run `npm test` and `npm run typecheck`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/settings src/main/main.ts
git commit -m "Settings gain overlay size and opacity and save one key at a time without losing a broken file"
```

---

### Task 2: Share key forms, recording, and resolving to a key

**Files:**
- Create: `src/share/share-key.ts`
- Create: `src/share/share-key.test.ts`
- Modify: `src/main/windows-input.ts` (`virtualKeyOf` uses `parseShareKey`, and add `shareKeyLabel`)

**Interfaces:**
- Produces, from `share-key.ts`:
  - `type ShareKey = { kind: "character"; character: string } | { kind: "function"; number: number } | { kind: "scan"; scanCode: number }`
  - `parseShareKey(value: string): ShareKey | undefined`. Accepts a single character, `F1`–`F24` (any case), or `scan:<decimal 1–255>`, for example `scan:41`. Anything else gives `undefined`.
  - `recordShareKey(code: string): RecordedShareKey`. `code` is `KeyboardEvent.code`.
    - `type RecordedShareKey = { outcome: "accepted"; shareKey: string; leagueAlsoUses: boolean } | { outcome: "ignored" } | { outcome: "refused"; reason: "reserved" | "unsupported" }`
- Produces, from `windows-input.ts`:
  - `virtualKeyOf(shareKey: string): number | undefined`. The signature is unchanged, and it now also resolves `scan:` keys.
  - `shareKeyLabel(shareKey: string): string | undefined`. This is the label shown in the keycap. It is `undefined` when the key is unusable.

- [ ] **Step 1: Write the failing tests** in `share-key.test.ts`:

```ts
it.each([["`", { kind: "character", character: "`" }], ["ö", { kind: "character", character: "ö" }], ["F8", { kind: "function", number: 8 }], ["f24", { kind: "function", number: 24 }], ["scan:41", { kind: "scan", scanCode: 41 }]])(
  "reads the Share key %s", (value, expected) => expect(parseShareKey(value)).toEqual(expected));
it.each(["F0", "F25", "scan:abc", "scan:0", "scan:256", "scan:", "ab", ""])("refuses the Share key %j", (value) =>
  expect(parseShareKey(value)).toBeUndefined());

it("records the key under Esc by where it is, so dead keys and other layouts work", () => {
  expect(recordShareKey("Backquote")).toEqual({ outcome: "accepted", shareKey: "scan:41", leagueAlsoUses: false });
  expect(recordShareKey("IntlBackslash")).toEqual({ outcome: "accepted", shareKey: "scan:86", leagueAlsoUses: false });
});
it("records function keys in the existing F form", () => expect(recordShareKey("F5")).toMatchObject({ outcome: "accepted", shareKey: "F5" }));
it.each(["ShiftLeft", "ShiftRight", "ControlLeft", "AltRight", "MetaLeft"])("ignores %s pressed on its own", (code) =>
  expect(recordShareKey(code)).toEqual({ outcome: "ignored" }));
it.each(["Enter", "NumpadEnter", "Tab", "Space"])("refuses %s as reserved", (code) =>
  expect(recordShareKey(code)).toEqual({ outcome: "refused", reason: "reserved" }));
it.each(["ArrowUp", "Home", "Insert", "Escape", "Numpad5"])("refuses %s as unsupported", (code) =>
  expect(recordShareKey(code)).toEqual({ outcome: "refused", reason: "unsupported" }));
it.each(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyD", "KeyF", "KeyB", "KeyP", "KeyY", "Digit1", "Digit7"])("warns that League also uses %s", (code) =>
  expect(recordShareKey(code)).toMatchObject({ outcome: "accepted", leagueAlsoUses: true }));
it("does not warn for keys League leaves alone", () => expect(recordShareKey("Digit8")).toMatchObject({ leagueAlsoUses: false }));
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/share/share-key.test.ts`. Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement `share-key.ts`.** It uses a table from `KeyboardEvent.code` to PC set-1 scan codes, covering only the keys that produce characters:
  - `Backquote` 0x29, `Digit1`–`Digit0` 0x02–0x0B, `Minus` 0x0C, `Equal` 0x0D
  - `KeyQ`–`KeyP` 0x10–0x19, `BracketLeft` 0x1A, `BracketRight` 0x1B
  - `KeyA`–`KeyL` 0x1E–0x26, `Semicolon` 0x27, `Quote` 0x28, `Backslash` 0x2B
  - `KeyZ`–`KeyM` 0x2C–0x32, `Comma` 0x33, `Period` 0x34, `Slash` 0x35
  - `IntlBackslash` 0x56, `IntlRo` 0x73, `IntlYen` 0x7D

  `F1`–`F24` stay as `"F<n>"`. Modifier codes are `ShiftLeft/Right`, `ControlLeft/Right`, `AltLeft/Right` and `MetaLeft/Right`. The League set is Q W E R D F B P Y and 1–7, by code.

- [ ] **Step 4: Update `windows-input.ts`.** Bind these from `user32`:
  - `MapVirtualKeyExW(uint32 uCode, uint32 uMapType, intptr dwhkl)`
  - `GetKeyboardLayout(uint32 idThread)`
  - `GetForegroundWindow()`
  - `GetWindowThreadProcessId(intptr hWnd, uint32 *lpdwProcessId)`. Pass null for the second argument.

  The layout is the foreground window's thread's layout. Use the following, in `virtualKeyOf` and `shareKeyLabel`:
  - A `scan` key maps to its virtual key with `MapVirtualKeyExW(scan, MAPVK_VSC_TO_VK_EX = 3, layout)`.
  - A `character` key keeps using `VkKeyScanW`. A `function` key keeps using `0x6f + n`.
  - The label for a `scan` key is `MapVirtualKeyExW(vk, MAPVK_VK_TO_CHAR = 2, layout)`. Mask off bit 31, which marks a dead key, take the character, and uppercase it. If that gives 0, fall back to `` `Key ${scanCode}` ``.
  - The label for a `character` key is the character uppercased. For a `function` key it is `"F<n>"`.

- [ ] **Step 5: Run the tests and see them pass.** Run `npm test` and `npm run typecheck`. Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/share/share-key.ts src/share/share-key.test.ts src/main/windows-input.ts
git commit -m "Share keys can be recorded by physical key so dead keys and layout switches work"
```

---

### Task 3: Share follows setting changes without a restart

**Files:**
- Modify: `src/share/share.ts`, `src/share/share.test.ts`
- Create: `src/share/share-key-watcher.ts`, `src/share/share-key-watcher.test.ts`
- Modify: `src/main/main.ts`

**Interfaces:**
- Consumes: `SettingsStore` (Task 1). `virtualKeyOf` from Task 2 is wired in by main, not imported by the watcher.
- Produces:
  - In `createShare`'s deps, `settings: Settings` is replaced by `autoSend(): boolean`, read at each press.
  - `createShareKeyWatcher(deps: { resolve(shareKey: string): number | undefined; watch(virtualKey: number, onPress: () => void): () => void; onPress(): void }): ShareKeyWatcher`
  - `interface ShareKeyWatcher { start(shareKey: string): void; change(shareKey: string): void; stop(): void; virtualKey(): number | undefined }`
    - `start` resolves the key and watches it. It logs and does nothing if the key is unusable.
    - `change` restarts the watch only if it is currently started.
    - `virtualKey` is what's currently watched, which main uses for `keyReleased`.

- [ ] **Step 1: Write the failing tests.**

```ts
// share.test.ts: setup passes autoSend: () => state.autoSend
it("uses auto-send as it is at the moment of the press", async () => {
  state.autoSend = false; await share.press(); state.autoSend = true; await share.press();
  expect(sent.map((s) => s.submit)).toEqual([false, true]);
});

// share-key-watcher.test.ts, with a fake watch recording [virtualKey, stopped]
it("switches to a changed Share key at once while a game is on", () => {
  watcher.start("F8"); watcher.change("F9");
  expect(watches).toEqual([{ key: 0x77, stopped: true }, { key: 0x78, stopped: false }]);
});
it("does not watch a changed key before a game starts, then watches it when one does", () => {
  watcher.change("F9"); expect(watches).toEqual([]);
  watcher.start("F9"); expect(watches).toEqual([{ key: 0x78, stopped: false }]);
});
it("watches nothing for an unusable key and reports no virtual key", () => {
  watcher.start("nope"); expect(watches).toEqual([]); expect(watcher.virtualKey()).toBeUndefined();
});
it("stops watching when the game ends", () => { watcher.start("F8"); watcher.stop(); expect(watches[0].stopped).toBe(true); });
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/share`. Expected: FAIL.

- [ ] **Step 3: Implement** `share-key-watcher.ts` and the `autoSend()` dependency in `share.ts`.

- [ ] **Step 4: Wire it into `main.ts`.**
  - `createShare({ autoSend: () => store.current().autoSend, keyReleased: () => { const vk = watcher.virtualKey(); return vk === undefined ? Promise.resolve() : waitForKeyRelease(vk); }, ... })`
  - On game start, call `watcher.start(store.current().shareKey)`. On game end, call `watcher.stop()`.
  - Remove the startup-time `virtualKeyOf` call and its console error. The watcher logs instead.

- [ ] **Step 5: Run the tests and see them pass.** Run `npm test` and `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src/share src/main/main.ts
git commit -m "Share reads the Share key and auto-send live so changes need no restart"
```

---

### Task 4: Overlay size, opacity and reset position

**Files:**
- Modify: `src/main/overlay-window.ts`, `src/main/preload.ts`, `src/renderer/renderer.ts`, `src/renderer/overlay.css`, `src/main/main.ts`

**Interfaces:**
- Produces, in `OverlayWindow`:
  - `setAppearance(appearance: OverlayAppearance): void`, where `interface OverlayAppearance { size: number; opacity: number }` holds percents and is exported from `overlay-window.ts`.
  - `resetPosition(): void` moves the window to the default spot. It does not call `onMoved`, because the caller clears the saved position.
- `OverlayWindowOptions` gains `appearance: OverlayAppearance`, the starting appearance.

- [ ] **Step 1: Do the CSS and renderer work.**
  - In `overlay.css`, `#handle` and `#rows` use `opacity: var(--overlay-opacity, 0.5)` in place of `0.5`.
  - The renderer listens on a new preload hook, `overlayApi.onAppearance((a: { size: number; opacity: number }) => void)`. It sets `document.body.style.zoom = String(a.size / 100)` and `--overlay-opacity` to `a.opacity / 100` on `document.documentElement`.
  - Use CSS `zoom`, not `webContents.setZoomFactor`. Chromium shares zoom per origin, and both windows load `file://`, so the settings window would zoom too.

- [ ] **Step 2: Do the main-side work in `overlay-window.ts`.**
  - The window size becomes `Math.ceil(WIDTH * scale)` × `Math.ceil(HEIGHT * scale)`, where scale is `size / 100`. Use it everywhere `WIDTH` and `HEIGHT` are used today: creation, `isOnAScreen`, and the drag `setBounds`.
  - `setAppearance` updates the bounds, keeping the top-left, and sends `"overlay-appearance"`.
  - Keep the latest appearance and re-send it on `did-finish-load`, the same way `latest` works for state.
  - `resetPosition` uses the same default spot as creation. Extract a `defaultPosition()` helper.

- [ ] **Step 3: Wire it in `main.ts`.** Pass the starting `appearance` from `store.current()`.

- [ ] **Step 4: Check it by hand.**
  - Run `npm start`, with `settings.json` holding `{"overlaySize":150,"overlayOpacity":100}`.
  - Then run it again with no size or opacity in the file.
  - Expected, which needs a game. A practice tool game is fine.
    - At 150%, nothing is clipped, the bigger overlay can be dragged, and the dragged position is saved.
    - With no keys in the file, it looks pixel-identical to the 0.2.0 overlay.

- [ ] **Step 5: Run `npm test` and `npm run typecheck`, then commit.**

```bash
git add src/main/overlay-window.ts src/main/preload.ts src/renderer src/main/main.ts
git commit -m "Overlay size and opacity follow the settings and the overlay can return to its default spot"
```

---

### Task 5: Sample overlay

**Files:**
- Create: `src/sample-overlay/sample-overlay.ts`, `src/sample-overlay/sample-overlay.test.ts`

**Interfaces:**
- Produces `sampleOverlay(elapsedSeconds: number): OverlayState`. `OverlayState` comes from `src/tracker/tracker.ts`.

- [ ] **Step 1: Write the failing tests.**

```ts
it("shows five sample Enemies in Role order, each with Flash", () => {
  const state = sampleOverlay(0);
  expect(state).toMatchObject({ visible: true, roleSetupNeeded: false });
  expect(state.rows.map((r) => r.role)).toEqual(["top", "jg", "mid", "bot", "sup"]);
  expect(state.rows.every((r) => r.spells.some((s) => s.id === "SummonerFlash"))).toBe(true);
});
it("runs exactly one Countdown, on mid's Flash, looping from 5:00", () => {
  const countdowns = (t: number) => sampleOverlay(t).rows.flatMap((r) => r.spells.filter((s) => s.countdown !== undefined).map((s) => [r.role, s.id, s.countdown]));
  expect(countdowns(0)).toEqual([["mid", "SummonerFlash", 300]]);
  expect(countdowns(299.5)).toEqual([["mid", "SummonerFlash", 1]]);
  expect(countdowns(300)).toEqual([["mid", "SummonerFlash", 300]]);
});
```

- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run src/sample-overlay`.

- [ ] **Step 3: Implement it.** The rows use Data Dragon ids:
  - Garen: `SummonerFlash`, `SummonerTeleport`
  - LeeSin: `SummonerFlash`, `SummonerSmite`
  - Ahri: `SummonerFlash`, `SummonerDot`
  - Jinx: `SummonerFlash`, `SummonerHeal`
  - Thresh: `SummonerFlash`, `SummonerExhaust`

  Display names are the champion and spell names, for example "Lee Sin" and "Ignite". The Countdown is `300 - (Math.floor(elapsedSeconds) % 300)`.

- [ ] **Step 4: Run the tests and see them pass.** Then run `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/sample-overlay
git commit -m "A sample overlay with one running Countdown for adjusting the overlay outside a game"
```

---

### Task 6: The settings window, tray entry and docs

**Files:**
- Create: `src/main/settings-window.ts`, `src/main/settings-preload.ts`, `src/renderer/settings.html`, `src/renderer/settings.css`, `src/renderer/settings-renderer.ts`
- Modify: `src/main/tray.ts`, `src/main/main.ts`, `scripts/copy-assets.mjs` (add `settings.html` and `settings.css`), `README.md`, `GLOSSARY.md`

**Interfaces:**
- Consumes:
  - `SettingsStore` (Task 1)
  - `recordShareKey`, `virtualKeyOf` and `shareKeyLabel` (Task 2)
  - `ShareKeyWatcher.change` (Task 3)
  - `OverlayWindow.setAppearance`, `OverlayWindow.resetPosition` and `OverlayAppearance` (Task 4)
  - `sampleOverlay` (Task 5)
- Produces, in `settings-window.ts`:
  - `interface SettingsView { shareKey: { label: string; unusable: boolean }; autoSend: boolean; overlay: OverlayAppearance; version: string; gameRunning: boolean; sampleShowing: boolean }`
  - `type ShareKeyChoice = { outcome: "accepted"; label: string; warning?: string } | { outcome: "ignored" } | { outcome: "refused"; message: string }`
  - `createSettingsWindow(deps: { view(): SettingsView; chooseShareKey(code: string): ShareKeyChoice; setAutoSend(on: boolean): void; previewOverlay(a: OverlayAppearance): void; saveOverlay(a: OverlayAppearance): void; resetPosition(): void; setSampleShowing(showing: boolean): void; onClosed(): void }): SettingsWindow`
  - `interface SettingsWindow { open(): void; refresh(): void }`. `open` focuses the existing window if there is one. `refresh` pushes `deps.view()` to an open window.
  - `createTray(options: { openSettings(): void }): AppTray`. It adds "Settings" above "Exit" and opens settings on `click`.
- The preload exposes `settingsApi`:
  - `onView(listener)`
  - `chooseShareKey(code): Promise<ShareKeyChoice>`, using `ipcRenderer.invoke`
  - `setAutoSend(on)`, `previewOverlay(a)`, `saveOverlay(a)`, `resetPosition()` and `setSampleShowing(showing)`

  Main accepts IPC only from this window's `webContents`, as the overlay does.

- [ ] **Step 1: Build the window.**
  - It's a BrowserWindow with these options:
    - `width: 380`, height to fit the content, `resizable: false`, `maximizable: false`
    - title "Spell Tracker settings", `icon` from `build/icon.png`, no menu
    - a dark `backgroundColor` matching the page
    - `sandbox`, `contextIsolation`, and `settings-preload.js`
  - `settings.html` has the same CSP as `index.html`, without `img-src`.
  - Show it once it's `ready-to-show`.
  - `closed` calls `deps.onClosed()`.

- [ ] **Step 2: Build the page in `settings-renderer.ts`.** It's a plain script like `renderer.ts`. Wrap the whole body in a block `{ … }`, because both files share one TypeScript program with `moduleDetection: legacy`, so top-level names would collide. Lay it out like the approved mockup, top to bottom:
  1. **Share key.**
     - A keycap shows `view.shareKey.label`, next to a "Change" button. Help text: "Types the enemies' Flash timers into team chat during a game."
     - Clicking Change switches the keycap to "Press a key" and the button to "Cancel". The help text becomes "Press the key you want, or Esc to cancel."
     - Esc or Cancel restores the old key.
     - Any other keydown calls `chooseShareKey(event.code)` with `preventDefault`. What happens next depends on the outcome:
       - `ignored`: keep listening.
       - `refused`: show the message inline and keep listening.
       - `accepted`: show the label, plus the warning if there is one.
     - When `view.shareKey.unusable` is true, show "Spell Tracker can't use this key. Pick another one."
  2. **Send automatically.**
     - A checkbox. Its help text is "Off: the timers are typed and you press Enter to send." when off, and "On: the timers are typed and sent straight away." when on.
     - Below it: "Teammates see `1230 mid 1440 bot`".
  3. **Overlay.**
     - A "Reset position" button.
     - A Size slider (`min 75 max 150 step 5`) and an Opacity slider (`min 20 max 100 step 5`), each with a percent readout.
     - `input` calls `previewOverlay`, and `change` calls `saveOverlay`.
     - A "Show sample overlay" / "Hide sample overlay" toggle, hidden while `view.gameRunning` is true.
  4. **Footer:** "Version {version}" on the left and "Changes apply right away" on the right.

- [ ] **Step 3: Wire it in `main.ts`.**
  - `chooseShareKey`:
    - Calls `recordShareKey`.
    - On `accepted`, it runs `store.update({ shareKey })` and `watcher.change(shareKey)`, then returns the label from `shareKeyLabel`.
    - It adds the warning "League also uses this key, so pressing it will also do that in game." when `leagueAlsoUses` is true.
    - Refusal messages:
      - `reserved`: "Enter, Tab and Space can't be the Share key."
      - `unsupported`: "Pick a letter, number or symbol key, or F1 to F24."
  - `setAutoSend` calls `store.update`.
  - `previewOverlay` calls `overlayWindow.setAppearance` only. `saveOverlay` sets the appearance and also calls `store.update({ overlaySize, overlayOpacity })`.
  - `resetPosition` calls `overlayWindow.resetPosition()` and `store.update({ overlayPosition: null })`.
  - The sample overlay:
    - A `sampleStartedAt: number | undefined` holds its state.
    - `renderOverlay` renders `tracker.overlay()` when it's visible. Otherwise it renders `sampleOverlay((Date.now() - sampleStartedAt) / 1000)` when the sample is on, and otherwise the hidden tracker state.
    - Ignore `onMark`/`onClear` while the sample is showing and no game is on.
    - Clear the sample on `game-started` and in `onClosed`. Call `settingsWindow.refresh()` on game start and end, and whenever the sample toggles.
  - `view()` builds from `store.current()`, `shareKeyLabel` (`unusable` when it's `undefined`), `app.getVersion()` and `tracker.overlay().visible`.

- [ ] **Step 4: Update the docs.**
  - In the README Settings section, lead with "Right-click the tray icon → Settings, or click the tray icon". Keep the JSON description and add the `overlaySize`, `overlayOpacity` and `scan:` forms. It still says hand edits need a restart. In the Commands table, update `npm start`'s description to "tray icon with Settings and Exit".
  - In `GLOSSARY.md`, add **Sample overlay**: "The overlay filled with made-up Enemies, shown from Settings outside a game so its size, opacity and position can be adjusted." _Avoid_: Preview, demo.

- [ ] **Step 5: Check it by hand** with `npm start`, with no game running.
  - Clicking the tray icon opens the window, and clicking again focuses the same window.
  - Recording keys:
    - Recording the key under Esc shows its label.
    - Q shows the warning. Enter shows the refusal, and the window keeps listening.
    - Shift alone does nothing.
    - Esc cancels.
  - The sample overlay:
    - Show sample overlay displays five rows with one ticking Countdown.
    - The sliders change it live, and it can be dragged.
    - Closing the window hides it.
  - Reopen the app and check that every value persisted, and that `settings.json` kept any unknown key.
  - Start a practice tool game:
    - The sample button disappears.
    - The sliders change the real overlay.
    - A newly recorded Share key types the Share Line without a restart.

- [ ] **Step 6: Run `npm test` and `npm run typecheck`, then commit.**

```bash
git add src/main src/renderer scripts/copy-assets.mjs README.md GLOSSARY.md
git commit -m "Settings window opens from the tray to change the Share key, auto-send and the overlay"
```
