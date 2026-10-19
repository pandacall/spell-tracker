import { BrowserWindow, ipcMain, nativeImage } from "electron";
import path from "node:path";
import { OVERLAY_OPACITY_RANGE, OVERLAY_SIZE_RANGE } from "../settings/settings";
import type { OverlayAppearance } from "./overlay-window";

const WIDTH = 380;
// Fits the page with a two-line Share key message showing (see settings.css).
const HEIGHT = 452;
// The page's background, so the window never flashes white while it loads.
const BACKGROUND = "#0a0e16";

/** Everything the settings page shows. */
export interface SettingsView {
  /** `unusable` when settings.json holds a Share key the app can't watch. */
  shareKey: { label: string; unusable: boolean };
  autoSend: boolean;
  overlay: OverlayAppearance;
  version: string;
  gameRunning: boolean;
  sampleShowing: boolean;
}

/** What became of a key pressed while the page records a Share key. */
export type ShareKeyChoice =
  | { outcome: "accepted"; label: string; warning?: string }
  | { outcome: "ignored" }
  | { outcome: "refused"; message: string };

export interface SettingsWindow {
  /** Opens the window, or brings it to the front if it is already open. */
  open(): void;
  /** Sends the latest view to the window if it is open. */
  refresh(): void;
}

export interface SettingsWindowDeps {
  view(): SettingsView;
  chooseShareKey(code: string): ShareKeyChoice;
  setAutoSend(on: boolean): void;
  /** The overlay follows a slider while it is dragged; nothing is saved. */
  previewOverlay(appearance: OverlayAppearance): void;
  /** A slider was released: apply and save. */
  saveOverlay(appearance: OverlayAppearance): void;
  resetPosition(): void;
  setSampleShowing(showing: boolean): void;
  onClosed(): void;
}

/** A finite number clamped into the range and rounded; undefined for anything else. */
function percentFrom(value: unknown, range: { min: number; max: number }): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.round(Math.min(range.max, Math.max(range.min, value)));
}

/** An appearance sent by the page, clamped to the sliders' ranges; undefined if malformed. */
function appearanceFrom(value: unknown): OverlayAppearance | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { size, opacity } = value as Record<string, unknown>;
  const checkedSize = percentFrom(size, OVERLAY_SIZE_RANGE);
  const checkedOpacity = percentFrom(opacity, OVERLAY_OPACITY_RANGE);
  if (checkedSize === undefined || checkedOpacity === undefined) return undefined;
  return { size: checkedSize, opacity: checkedOpacity };
}

/**
 * A small window for the Share key, auto-send and the overlay. There is only
 * ever one; every change it makes is applied and saved by `deps` at once.
 */
export function createSettingsWindow(deps: SettingsWindowDeps): SettingsWindow {
  let window: BrowserWindow | undefined;

  // Only the settings page may change settings.
  const fromSettings = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) =>
    window !== undefined && event.sender === window.webContents;

  ipcMain.handle("settings-choose-share-key", (event, code: unknown): ShareKeyChoice => {
    if (!fromSettings(event) || typeof code !== "string") return { outcome: "ignored" };
    return deps.chooseShareKey(code);
  });
  ipcMain.on("settings-auto-send", (event, on: unknown) => {
    if (fromSettings(event) && typeof on === "boolean") deps.setAutoSend(on);
  });
  const onAppearance =
    (handler: (appearance: OverlayAppearance) => void) => (event: Electron.IpcMainEvent, value: unknown) => {
      const appearance = appearanceFrom(value);
      if (fromSettings(event) && appearance) handler(appearance);
    };
  ipcMain.on("settings-preview-overlay", onAppearance(deps.previewOverlay));
  ipcMain.on("settings-save-overlay", onAppearance(deps.saveOverlay));
  ipcMain.on("settings-reset-position", (event) => {
    if (fromSettings(event)) deps.resetPosition();
  });
  ipcMain.on("settings-sample", (event, showing: unknown) => {
    if (fromSettings(event) && typeof showing === "boolean") deps.setSampleShowing(showing);
  });

  const sendView = () => window?.webContents.send("settings-view", deps.view());

  return {
    open() {
      if (window) {
        if (window.isMinimized()) window.restore();
        window.focus();
        return;
      }
      // An installed copy has no build folder; Windows then uses the exe's own icon.
      const icon = nativeImage.createFromPath(path.join(__dirname, "..", "..", "build", "icon.png"));
      window = new BrowserWindow({
        width: WIDTH,
        height: HEIGHT,
        useContentSize: true,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
        title: "Spell Tracker settings",
        icon: icon.isEmpty() ? undefined : icon,
        backgroundColor: BACKGROUND,
        show: false,
        webPreferences: {
          preload: path.join(__dirname, "settings-preload.js"),
          sandbox: true,
          contextIsolation: true,
        },
      });
      window.removeMenu();
      window.webContents.on("did-finish-load", sendView);
      window.once("ready-to-show", () => window?.show());
      window.on("closed", () => {
        window = undefined;
        deps.onClosed();
      });
      void window.loadFile(path.join(__dirname, "..", "renderer", "settings.html"));
    },
    refresh() {
      // A window still loading gets the view when it finishes.
      if (window && !window.webContents.isLoading()) sendView();
    },
  };
}
