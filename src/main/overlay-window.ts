import { BrowserWindow, screen } from "electron";
import path from "node:path";
import type { OverlayState } from "../tracker/tracker";

const WIDTH = 220;
const HEIGHT = 270;

export interface OverlayWindow {
  render(state: OverlayState, iconVersion: string): void;
}

/**
 * A transparent, always-on-top window that never takes focus from League and
 * lets every click through to the game. Hidden until the Tracker says a game
 * is on.
 */
export function createOverlayWindow(): OverlayWindow {
  const { workArea } = screen.getPrimaryDisplay();
  const window = new BrowserWindow({
    x: workArea.x + 24,
    y: workArea.y + Math.round(workArea.height / 3),
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: true,
      contextIsolation: true,
    },
  });
  window.setAlwaysOnTop(true, "screen-saver");
  window.setIgnoreMouseEvents(true);
  void window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // Messages sent before the page has loaded would be lost, so the latest one
  // is kept and re-sent once it has.
  let loaded = false;
  let latest = "";
  let lastSent = "";
  const send = () => {
    if (loaded && latest !== lastSent) {
      lastSent = latest;
      window.webContents.send("overlay-state", JSON.parse(latest));
    }
  };
  window.webContents.on("did-finish-load", () => {
    loaded = true;
    send();
  });

  return {
    render(state, iconVersion) {
      latest = JSON.stringify({ state, iconVersion });
      send();
      if (state.visible && !window.isVisible()) window.showInactive();
      if (!state.visible && window.isVisible()) window.hide();
    },
  };
}
