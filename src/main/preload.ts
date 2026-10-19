import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlayApi", {
  onState(listener: (payload: unknown) => void) {
    ipcRenderer.on("overlay-state", (_event, payload) => listener(payload));
  },
});
