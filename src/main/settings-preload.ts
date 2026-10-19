import { contextBridge, ipcRenderer } from "electron";
import type { OverlayAppearance } from "./overlay-window";
import type { SettingsView, ShareKeyChoice } from "./settings-window";

contextBridge.exposeInMainWorld("settingsApi", {
  /** The settings to show; sent on load and whenever a game or the sample overlay starts or stops. */
  onView(listener: (view: SettingsView) => void) {
    ipcRenderer.on("settings-view", (_event, view) => listener(view));
  },
  /** A key pressed while recording, as `KeyboardEvent.code`; main decides whether it becomes the Share key. */
  chooseShareKey(code: string): Promise<ShareKeyChoice> {
    return ipcRenderer.invoke("settings-choose-share-key", code);
  },
  setAutoSend(on: boolean) {
    ipcRenderer.send("settings-auto-send", on);
  },
  previewOverlay(appearance: OverlayAppearance) {
    ipcRenderer.send("settings-preview-overlay", appearance);
  },
  saveOverlay(appearance: OverlayAppearance) {
    ipcRenderer.send("settings-save-overlay", appearance);
  },
  resetPosition() {
    ipcRenderer.send("settings-reset-position");
  },
  setSampleShowing(showing: boolean) {
    ipcRenderer.send("settings-sample", showing);
  },
});
