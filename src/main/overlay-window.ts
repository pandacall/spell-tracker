import { BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import type { OverlayState } from "../tracker/tracker";

const WIDTH = 128;
const HEIGHT = 200;
const DRAG_POLL_MS = 16;

/** Both are percents: size scales the whole overlay, opacity is how solid it is drawn. */
export interface OverlayAppearance {
  size: number;
  opacity: number;
}

export interface OverlayWindow {
  render(state: OverlayState, iconVersion: string): void;
  setAppearance(appearance: OverlayAppearance): void;
  /** Moves the overlay back to its default spot. The caller clears any saved position. */
  resetPosition(): void;
}

export interface OverlayWindowOptions {
  /** Where the user last left the overlay; the default spot is used when absent or off every screen. */
  position?: { x: number; y: number };
  appearance: OverlayAppearance;
  onMark(championId: string, spellId: string): void;
  onClear(championId: string, spellId: string): void;
  /** The user finished dragging the overlay to here. */
  onMoved(position: { x: number; y: number }): void;
}

/** The overlay's window size at a size percent. */
function sizeAt(size: number): { width: number; height: number } {
  const scale = size / 100;
  return { width: Math.ceil(WIDTH * scale), height: Math.ceil(HEIGHT * scale) };
}

/**
 * The default sits well inside the screen rather than at its edge, so it lands
 * over a windowed game as well as a borderless one.
 */
function defaultPosition(): { x: number; y: number } {
  const { workArea } = screen.getPrimaryDisplay();
  return { x: workArea.x + Math.round(workArea.width * 0.15), y: workArea.y + Math.round(workArea.height * 0.3) };
}

/** True when the overlay's drag handle would be on a connected display. */
function isOnAScreen(position: { x: number; y: number }, width: number): boolean {
  const handle = { x: position.x + width / 2, y: position.y + 4 };
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
  let appearance = options.appearance;
  let { width, height } = sizeAt(appearance.size);
  const start = options.position && isOnAScreen(options.position, width) ? options.position : defaultPosition();
  const window = new BrowserWindow({
    x: start.x,
    y: start.y,
    width,
    height,
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
        width,
        height,
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
  // Appearance follows the same rule: the latest is re-sent once the page has loaded.
  const sendAppearance = () => {
    if (loaded) window.webContents.send("overlay-appearance", appearance);
  };
  window.webContents.on("did-finish-load", () => {
    loaded = true;
    send();
    sendAppearance();
  });

  return {
    render(state, iconVersion) {
      latest = JSON.stringify({ state, iconVersion });
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
    setAppearance(next) {
      appearance = next;
      ({ width, height } = sizeAt(next.size));
      const { x, y } = window.getBounds();
      window.setBounds({ x, y, width, height });
      sendAppearance();
    },
    resetPosition() {
      const { x, y } = defaultPosition();
      window.setBounds({ x, y, width, height });
    },
  };
}
