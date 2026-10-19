import { app, Menu, nativeImage, Tray } from "electron";

const SIZE = 16;

// A plain colored square, so the app needs no icon asset yet. Bitmap is BGRA.
function trayIcon() {
  const bitmap = Buffer.alloc(SIZE * SIZE * 4);
  for (let pixel = 0; pixel < SIZE * SIZE; pixel++) {
    bitmap.set([0xd8, 0x8a, 0x2c, 0xff], pixel * 4);
  }
  return nativeImage.createFromBitmap(bitmap, { width: SIZE, height: SIZE });
}

export interface AppTray {
  /** Show "Restart to update" running `restart`, or hide it when `undefined`. */
  offerRestart(restart: (() => void) | undefined): void;
  /** A Windows notification from the tray icon. */
  notify(title: string, content: string): void;
  destroy(): void;
}

/** The tray icon; clicking it, or its menu's "Settings", calls `openSettings`. */
export function createTray(options: { openSettings(): void }): AppTray {
  const tray = new Tray(trayIcon());
  tray.setToolTip("Spell Tracker");
  tray.on("click", () => options.openSettings());
  const setMenu = (restart: (() => void) | undefined) =>
    tray.setContextMenu(
      Menu.buildFromTemplate([
        ...(restart ? [{ label: "Restart to update", click: restart }, { type: "separator" as const }] : []),
        { label: "Settings", click: () => options.openSettings() },
        { label: "Exit", click: () => app.quit() },
      ]),
    );
  setMenu(undefined);
  return {
    offerRestart: setMenu,
    notify: (title, content) => tray.displayBalloon({ title, content }),
    destroy: () => tray.destroy(),
  };
}
