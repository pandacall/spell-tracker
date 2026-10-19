import { app, net } from "electron";
import { startGameFeed } from "../game-feed/game-feed";
import { createTracker } from "../tracker/tracker";
import { createOverlayWindow } from "./overlay-window";
import { createTray } from "./tray";

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

    startGameFeed((snapshot) => {
      tracker.feed(snapshot);
      overlayWindow.render(tracker.overlay(), iconVersion);
    });

    // Keep the tray icon referenced for the lifetime of the app.
    app.on("before-quit", () => tray.destroy());
  });

  // The overlay window is hidden between games; only Exit quits the app.
  app.on("window-all-closed", () => {});
}
