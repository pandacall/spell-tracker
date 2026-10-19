import { app, net } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { createChatSender } from "../chat-sender/chat-sender";
import { startGameFeed } from "../game-feed/game-feed";
import { sampleOverlay } from "../sample-overlay/sample-overlay";
import { createSettingsStore } from "../settings/settings";
import { createShare } from "../share/share";
import { recordShareKey } from "../share/share-key";
import { createShareKeyWatcher } from "../share/share-key-watcher";
import { createTracker } from "../tracker/tracker";
import { startUpdates, type Updates } from "../updater/updater";
import { createOverlayWindow } from "./overlay-window";
import { createSettingsWindow, type ShareKeyChoice } from "./settings-window";
import { createTray } from "./tray";
import { shareKeyLabel, virtualKeyOf, waitForKeyRelease, watchKey, windowsKeyboard } from "./windows-input";

const SHARE_KEY_REFUSALS = {
  reserved: "Enter, Tab and Space can't be the Share key.",
  unsupported: "Pick a letter, number or symbol key, or F1 to F24.",
};

// Used until Data Dragon's current version can be fetched.
let iconVersion = "15.1.1";

async function refreshIconVersion(): Promise<void> {
  try {
    const response = await net.fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const versions = (await response.json()) as string[];
    if (versions[0]) iconVersion = versions[0];
  } catch {
    // Offline or blocked: keep the fallback version; icons may just not load.
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    const tray = createTray({ openSettings: () => settingsWindow.open() });
    const tracker = createTracker();
    void refreshIconVersion();

    // Every setting is read from the store when it is used, so changes need no restart.
    const settingsPath = path.join(app.getPath("userData"), "settings.json");
    const store = createSettingsStore(settingsPath);

    // When the sample overlay was switched on from Settings; undefined while it is off.
    // A game's own overlay always replaces it.
    let sampleStartedAt: number | undefined;
    const gameRunning = () => tracker.overlay().visible;
    const sampleOnly = () => sampleStartedAt !== undefined && !gameRunning();
    const renderOverlay = () => {
      const state = tracker.overlay();
      const shown =
        !state.visible && sampleStartedAt !== undefined ? sampleOverlay((Date.now() - sampleStartedAt) / 1000) : state;
      overlayWindow.render(shown, iconVersion);
    };
    const overlayWindow = createOverlayWindow({
      position: store.current().overlayPosition,
      appearance: { size: store.current().overlaySize, opacity: store.current().overlayOpacity },
      // The sample overlay's spells can't be marked.
      onMark: (championId, spellId) => {
        if (sampleOnly()) return;
        tracker.mark(championId, spellId);
        renderOverlay();
      },
      onClear: (championId, spellId) => {
        if (sampleOnly()) return;
        tracker.clear(championId, spellId);
        renderOverlay();
      },
      onMoved: (position) => store.update({ overlayPosition: position }),
    });
    const share = createShare({
      autoSend: () => store.current().autoSend,
      shareLine: () => tracker.shareLine(),
      sender: createChatSender({
        keyboard: windowsKeyboard,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      }),
      isGameRunning: gameRunning,
      keyReleased: () => {
        const virtualKey = shareKeyWatcher.virtualKey();
        return virtualKey === undefined ? Promise.resolve() : waitForKeyRelease(virtualKey);
      },
    });

    // The Share key is only watched while a game is on.
    const shareKeyWatcher = createShareKeyWatcher({
      resolve: virtualKeyOf,
      watch: watchKey,
      onPress: () => {
        share.press().catch((error) => console.error("Share failed:", error));
      },
    });

    const chooseShareKey = (code: string): ShareKeyChoice => {
      const recorded = recordShareKey(code);
      if (recorded.outcome !== "accepted") {
        return recorded.outcome === "ignored" ? recorded : { outcome: "refused", message: SHARE_KEY_REFUSALS[recorded.reason] };
      }
      // A key that has no virtual key on the current layout could never be watched.
      const label = shareKeyLabel(recorded.shareKey);
      if (label === undefined) return { outcome: "refused", message: SHARE_KEY_REFUSALS.unsupported };
      if (recorded.shareKey !== store.current().shareKey) {
        store.update({ shareKey: recorded.shareKey });
        shareKeyWatcher.change(recorded.shareKey);
      }
      return recorded.leagueAlsoUses
        ? { outcome: "accepted", label, warning: "League also uses this key, so pressing it will also do that in game." }
        : { outcome: "accepted", label };
    };

    const setSampleShowing = (showing: boolean) => {
      // During a game the real overlay is showing, so there is no sample to switch on.
      const next = showing && !gameRunning() ? (sampleStartedAt ?? Date.now()) : undefined;
      if (next === sampleStartedAt) return;
      sampleStartedAt = next;
      renderOverlay();
      settingsWindow.refresh();
    };

    const settingsWindow = createSettingsWindow({
      view: () => {
        const current = store.current();
        const label = shareKeyLabel(current.shareKey);
        return {
          shareKey: { label: label ?? current.shareKey, unusable: label === undefined },
          autoSend: current.autoSend,
          overlay: { size: current.overlaySize, opacity: current.overlayOpacity },
          version: app.getVersion(),
          gameRunning: gameRunning(),
          sampleShowing: sampleStartedAt !== undefined,
        };
      },
      chooseShareKey,
      setAutoSend: (on) => store.update({ autoSend: on }),
      previewOverlay: (appearance) => overlayWindow.setAppearance(appearance),
      saveOverlay: (appearance) => {
        overlayWindow.setAppearance(appearance);
        store.update({ overlaySize: appearance.size, overlayOpacity: appearance.opacity });
      },
      resetPosition: () => {
        overlayWindow.resetPosition();
        store.update({ overlayPosition: null });
      },
      setSampleShowing,
      onClosed: () => setSampleShowing(false),
    });

    // Only an installed build can update itself; `npm start` never checks.
    const updates: Updates | undefined = app.isPackaged
      ? startUpdates({
          source: autoUpdater,
          isGameRunning: gameRunning,
          offerRestart: tray.offerRestart,
          announce: () =>
            tray.notify("Spell Tracker update ready", "It installs when you exit, or right-click the tray icon to restart now."),
        })
      : undefined;

    startGameFeed((snapshot) => {
      const signal = tracker.feed(snapshot);
      if (signal === "game-started") {
        // The game's overlay replaces the sample overlay, which stays off afterwards.
        sampleStartedAt = undefined;
        shareKeyWatcher.start(store.current().shareKey);
        updates?.gameStarted();
      }
      if (signal === "game-ended") {
        shareKeyWatcher.stop();
        updates?.gameEnded();
      }
      renderOverlay();
      if (signal) settingsWindow.refresh();
    });

    // Countdowns tick between game-feed polls. Rendering an unchanged overlay is a no-op.
    const ticker = setInterval(renderOverlay, 250);

    // Keep the tray icon referenced for the lifetime of the app.
    app.on("before-quit", () => {
      clearInterval(ticker);
      shareKeyWatcher.stop();
      updates?.stop();
      tray.destroy();
    });
  });

  // The overlay window is hidden between games; only Exit quits the app.
  app.on("window-all-closed", () => {});
}
