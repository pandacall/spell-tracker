import { BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import type { OverlayState } from "../tracker/tracker";

const WIDTH = 128;
// Tall enough for the five rows and a Share Line of five entries shown large below them.
const HEIGHT = 340;
const DRAG_POLL_MS = 16;

export interface OverlayWindow {
  /** `shareLine`, when given, is shown large below the rows. */
  render(state: OverlayState, iconVersion: string, shareLine?: string): void;
}

export interface OverlayWindowOptions {
  /** Where the user last left the overlay; the default spot is used when absent or off every screen. */
  position?: { x: number; y: number };
  onMark(championId: string, spellId: string): void;
  onClear(championId: string, spellId: string): void;
  /** The user finished dragging the overlay to here. */
  onMoved(position: { x: number; y: number }): void;
}

/** True when the overlay's drag handle would be on a connected display. */
function isOnAScreen(position: { x: number; y: number }): boolean {
  const handle = { x: position.x + WIDTH / 2, y: position.y + 4 };
  return screen.getAllDisplays().some(({ bounds }) => {
    return handle.x >= bounds.x && handle.x < bounds.x + bounds.width && handle.y >= bounds.y && handle.y < bounds.y + bounds.height;
  });
}

/**
 * A transparent, always-on-top window that never takes focus from League. It
 * lets every click through to the game except those on a spell icon or the
 * drag handle. Hidden until the Tracker says a game is on.
 */
export function createOverlayWindow(options: OverlayWindowOptions): OverlayWindow {
  const { workArea } = screen.getPrimaryDisplay();
  // The default sits well inside the screen rather than at its edge, so it lands
  // over a windowed game as well as a borderless one.
  const start =
    options.position && isOnAScreen(options.position)
      ? options.position
      : { x: workArea.x + Math.round(workArea.width * 0.15), y: workArea.y + Math.round(workArea.height * 0.3) };
  const window = new BrowserWindow({
    x: start.x,
    y: start.y,
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
  // Click-through, but still told where the pointer is so the page can ask for
  // clicks back while it is over an icon or the handle.
  const clickThrough = () => window.setIgnoreMouseEvents(true, { forward: true });
  clickThrough();
  void window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  // Only this window's page may drive the overlay.
  const fromOverlay = (event: Electron.IpcMainEvent) => event.sender === window.webContents;

  ipcMain.on("overlay-interactive", (event, interactive: unknown) => {
    if (!fromOverlay(event)) return;
    if (interactive === true) window.setIgnoreMouseEvents(false);
    else clickThrough();
  });
  const onSpell =
    (handler: (championId: string, spellId: string) => void) =>
    (event: Electron.IpcMainEvent, championId: unknown, spellId: unknown) => {
      if (fromOverlay(event) && typeof championId === "string" && typeof spellId === "string") {
        handler(championId, spellId);
      }
    };
  ipcMain.on("overlay-mark", onSpell(options.onMark));
  ipcMain.on("overlay-clear", onSpell(options.onClear));

  // Dragging follows the cursor from here rather than using a draggable CSS
  // region, which would swallow the mouse events the page needs.
  let dragTimer: NodeJS.Timeout | undefined;
  const endDrag = () => {
    if (!dragTimer) return;
    clearInterval(dragTimer);
    dragTimer = undefined;
    const { x, y } = window.getBounds();
    options.onMoved({ x, y });
  };
  ipcMain.on("overlay-drag-start", (event) => {
    if (!fromOverlay(event) || dragTimer) return;
    const origin = window.getBounds();
    const grabbed = screen.getCursorScreenPoint();
    dragTimer = setInterval(() => {
      const cursor = screen.getCursorScreenPoint();
      // Width and height are restated because moving a window between displays
      // of different scale can otherwise nudge its size.
      window.setBounds({
        x: origin.x + cursor.x - grabbed.x,
        y: origin.y + cursor.y - grabbed.y,
        width: WIDTH,
        height: HEIGHT,
      });
    }, DRAG_POLL_MS);
  });
  ipcMain.on("overlay-drag-end", (event) => {
    if (fromOverlay(event)) endDrag();
  });

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
    render(state, iconVersion, shareLine) {
      latest = JSON.stringify({ state, iconVersion, shareLine });
      send();
      if (state.visible && !window.isVisible()) window.showInactive();
      if (!state.visible && window.isVisible()) {
        endDrag();
        window.hide();
        // The page can't report the pointer leaving a hidden window, so tell it.
        clickThrough();
        window.webContents.send("overlay-reset");
      }
    },
  };
}
