import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlayApi", {
  onState(listener: (payload: unknown) => void) {
    ipcRenderer.on("overlay-state", (_event, payload) => listener(payload));
  },
  /** The overlay was hidden: any hover or drag the page was tracking is over. */
  onReset(listener: () => void) {
    ipcRenderer.on("overlay-reset", () => listener());
  },
  /** True while the pointer is over something clickable; false lets clicks through to the game. */
  setInteractive(interactive: boolean) {
    ipcRenderer.send("overlay-interactive", interactive);
  },
  mark(championId: string, spellId: string) {
    ipcRenderer.send("overlay-mark", championId, spellId);
  },
  clear(championId: string, spellId: string) {
    ipcRenderer.send("overlay-clear", championId, spellId);
  },
  dragStart() {
    ipcRenderer.send("overlay-drag-start");
  },
  dragEnd() {
    ipcRenderer.send("overlay-drag-end");
  },
});
