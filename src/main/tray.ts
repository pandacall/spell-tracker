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

export function createTray(): Tray {
  const tray = new Tray(trayIcon());
  tray.setToolTip("Spell Tracker");
  tray.setContextMenu(Menu.buildFromTemplate([{ label: "Exit", click: () => app.quit() }]));
  return tray;
}
