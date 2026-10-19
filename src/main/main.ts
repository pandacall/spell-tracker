import { app, globalShortcut, net } from "electron";
import path from "node:path";
import { createChatSender } from "../chat-sender/chat-sender";
import { startGameFeed } from "../game-feed/game-feed";
import { loadSettings } from "../settings/settings";
import { createShare } from "../share/share";
import { createTracker } from "../tracker/tracker";
import { createOverlayWindow } from "./overlay-window";
import { createTray } from "./tray";
import { waitForKeyRelease, windowsKeyboard } from "./windows-input";

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
    const overlayWindow = createOverlayWindow();
    const tracker = createTracker();
    void refreshIconVersion();

    // Read once at startup; edit the file and restart to change a setting.
    const settings = loadSettings(path.join(app.getPath("userData"), "settings.json"));
    const share = createShare({
      settings,
      sender: createChatSender({
        keyboard: windowsKeyboard,
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      }),
      isGameRunning: () => tracker.overlay().visible,
      keyReleased: () => waitForKeyRelease(settings.shareKey),
    });

    // The Share key is only claimed while a game is on, so it stays usable
    // everywhere else.
    const claimShareKey = () => {
      try {
        const claimed = globalShortcut.register(settings.shareKey, () => {
          share.press().catch((error) => console.error("Share failed:", error));
        });
        if (!claimed) console.error(`Could not register the Share key "${settings.shareKey}".`);
      } catch (error) {
        // Electron throws on a malformed accelerator; that must not break the overlay.
        console.error(`Invalid Share key "${settings.shareKey}":`, error);
      }
    };

    startGameFeed((snapshot) => {
      const signal = tracker.feed(snapshot);
      if (signal === "game-started") claimShareKey();
      if (signal === "game-ended") globalShortcut.unregister(settings.shareKey);
      overlayWindow.render(tracker.overlay(), iconVersion);
    });

    // Keep the tray icon referenced for the lifetime of the app.
    app.on("before-quit", () => {
      globalShortcut.unregisterAll();
      tray.destroy();
    });
  });

  // The overlay window is hidden between games; only Exit quits the app.
  app.on("window-all-closed", () => {});
}
