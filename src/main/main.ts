import { app, net } from "electron";
import { autoUpdater } from "electron-updater";
import path from "node:path";
import { createChatSender } from "../chat-sender/chat-sender";
import { startGameFeed } from "../game-feed/game-feed";
import { loadSettings, saveOverlayPosition } from "../settings/settings";
import { createShare } from "../share/share";
import { createTracker } from "../tracker/tracker";
import { startUpdates, type Updates } from "../updater/updater";
import { createOverlayWindow } from "./overlay-window";
import { createTray } from "./tray";
import { virtualKeyOf, waitForKeyRelease, watchKey, windowsKeyboard } from "./windows-input";

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
    const tray = createTray();
    const tracker = createTracker();
    void refreshIconVersion();

    // Read once at startup; edit the file and restart to change a setting.
    const settingsPath = path.join(app.getPath("userData"), "settings.json");
    const settings = loadSettings(settingsPath);

    const renderOverlay = () => overlayWindow.render(tracker.overlay(), iconVersion);
    const overlayWindow = createOverlayWindow({
      position: settings.overlayPosition,
      onMark: (championId, spellId) => {
        tracker.mark(championId, spellId);
        renderOverlay();
      },
      onClear: (championId, spellId) => {
        tracker.clear(championId, spellId);
        renderOverlay();
      },
      onMoved: (position) => saveOverlayPosition(settingsPath, position),
    });
    const shareVirtualKey = virtualKeyOf(settings.shareKey);
    if (shareVirtualKey === undefined) {
      console.error(`Unsupported Share key "${settings.shareKey}": use a single character or F1-F24.`);
    }
    const share = createShare({
      settings,
      shareLine: () => tracker.shareLine(),
      sender: createChatSender({
        keyboard: windowsKeyboard,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      }),
      isGameRunning: () => tracker.overlay().visible,
      keyReleased: () => (shareVirtualKey === undefined ? Promise.resolve() : waitForKeyRelease(shareVirtualKey)),
    });

    // The Share key is only watched while a game is on.
    let stopWatching: (() => void) | undefined;
    const startWatchingShareKey = () => {
      if (shareVirtualKey === undefined) return;
      stopWatching = watchKey(shareVirtualKey, () => {
        share.press().catch((error) => console.error("Share failed:", error));
      });
    };

    // Only an installed build can update itself; `npm start` never checks.
    const updates: Updates | undefined = app.isPackaged
      ? startUpdates({
          source: autoUpdater,
          isGameRunning: () => tracker.overlay().visible,
          offerRestart: tray.offerRestart,
          announce: () =>
            tray.notify("Spell Tracker update ready", "It installs when you exit, or right-click the tray icon to restart now."),
        })
      : undefined;

    startGameFeed((snapshot) => {
      const signal = tracker.feed(snapshot);
      if (signal === "game-started") {
        startWatchingShareKey();
        updates?.gameStarted();
      }
      if (signal === "game-ended") {
        stopWatching?.();
        updates?.gameEnded();
      }
      renderOverlay();
    });

    // Countdowns tick between game-feed polls. Rendering an unchanged overlay is a no-op.
    const ticker = setInterval(renderOverlay, 250);

    // Keep the tray icon referenced for the lifetime of the app.
    app.on("before-quit", () => {
      clearInterval(ticker);
      stopWatching?.();
      updates?.stop();
      tray.destroy();
    });
  });

  // The overlay window is hidden between games; only Exit quits the app.
  app.on("window-all-closed", () => {});
}
