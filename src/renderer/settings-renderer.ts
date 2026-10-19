// Plain browser script (no imports), loaded by settings.html. It shares one
// TypeScript program with renderer.ts, so everything but these declarations
// sits inside the block below to keep its names out of the shared scope.
interface SettingsPageView {
  shareKey: { label: string; unusable: boolean };
  autoSend: boolean;
  overlay: { size: number; opacity: number };
  version: string;
  gameRunning: boolean;
  sampleShowing: boolean;
}
type SettingsPageChoice =
  | { outcome: "accepted"; label: string; warning?: string }
  | { outcome: "ignored" }
  | { outcome: "refused"; message: string };

declare const settingsApi: {
  onView(listener: (view: SettingsPageView) => void): void;
  chooseShareKey(code: string): Promise<SettingsPageChoice>;
  setAutoSend(on: boolean): void;
  previewOverlay(appearance: { size: number; opacity: number }): void;
  saveOverlay(appearance: { size: number; opacity: number }): void;
  resetPosition(): void;
  setSampleShowing(showing: boolean): void;
};

{
  const element = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const keycap = element("share-key");
  const change = element<HTMLButtonElement>("change");
  const shareHelp = element("share-help");
  const shareMessage = element("share-message");
  const autoSend = element<HTMLInputElement>("auto-send");
  const autoSendHelp = element("auto-send-help");
  const size = element<HTMLInputElement>("size");
  const sizeValue = element("size-value");
  const opacity = element<HTMLInputElement>("opacity");
  const opacityValue = element("opacity-value");
  const sample = element<HTMLButtonElement>("sample");
  const version = element("version");

  let view: SettingsPageView | undefined;
  let recording = false;
  // A refusal while recording, or a warning about the key just accepted.
  let message: { text: string; kind: "error" | "warning" } | undefined;

  const render = () => {
    if (!view) return;
    keycap.textContent = recording ? "Press a key" : view.shareKey.label;
    keycap.classList.toggle("recording", recording);
    change.textContent = recording ? "Cancel" : "Change";
    shareHelp.textContent = recording
      ? "Press the key you want, or Esc to cancel."
      : "Types the enemies' Flash timers into team chat during a game.";
    const shown =
      message ??
      (!recording && view.shareKey.unusable
        ? { text: "Spell Tracker can't use this key. Pick another one.", kind: "error" as const }
        : undefined);
    shareMessage.hidden = shown === undefined;
    shareMessage.textContent = shown?.text ?? "";
    shareMessage.className = `message ${shown?.kind ?? ""}`;

    autoSend.checked = view.autoSend;
    autoSendHelp.textContent = view.autoSend
      ? "On: the timers are typed and sent straight away."
      : "Off: the timers are typed and you press Enter to send.";

    size.value = String(view.overlay.size);
    opacity.value = String(view.overlay.opacity);
    sizeValue.textContent = `${view.overlay.size}%`;
    opacityValue.textContent = `${view.overlay.opacity}%`;

    sample.hidden = view.gameRunning;
    sample.textContent = view.sampleShowing ? "Hide sample overlay" : "Show sample overlay";
    version.textContent = `Version ${view.version}`;
  };

  settingsApi.onView((next) => {
    view = next;
    render();
  });

  // Keys are judged by main one at a time, in the order they were pressed, so
  // a key pressed while an earlier one is being judged is neither lost nor
  // recorded after recording has ended.
  let judging = Promise.resolve();
  const whileRecording = (task: () => void | Promise<void>) => {
    judging = judging.then(() => (recording ? task() : undefined)).catch((error) => console.error(error));
  };

  const stopRecording = () => {
    recording = false;
    message = undefined;
    render();
  };

  const choose = async (code: string) => {
    const choice = await settingsApi.chooseShareKey(code);
    if (choice.outcome === "ignored" || !view) return;
    if (choice.outcome === "refused") {
      message = { text: choice.message, kind: "error" };
    } else {
      view.shareKey = { label: choice.label, unusable: false };
      recording = false;
      message = choice.warning === undefined ? undefined : { text: choice.warning, kind: "warning" };
    }
    render();
  };

  change.addEventListener("click", () => {
    if (recording) {
      whileRecording(stopRecording);
      return;
    }
    recording = true;
    message = undefined;
    render();
  });

  // While recording, every key is taken for the Share key and does nothing else
  // here, so Enter, Space and Tab don't press buttons or move focus.
  window.addEventListener("keydown", (event) => {
    if (!recording) return;
    event.preventDefault();
    const { code } = event;
    whileRecording(code === "Escape" ? stopRecording : () => choose(code));
  });

  autoSend.addEventListener("change", () => {
    if (!view) return;
    view.autoSend = autoSend.checked;
    settingsApi.setAutoSend(autoSend.checked);
    render();
  });

  // The overlay follows a slider while it is dragged, and it is saved once released.
  const appearance = () => ({ size: Number(size.value), opacity: Number(opacity.value) });
  for (const slider of [size, opacity]) {
    slider.addEventListener("input", () => {
      if (!view) return;
      view.overlay = appearance();
      settingsApi.previewOverlay(view.overlay);
      render();
    });
    slider.addEventListener("change", () => settingsApi.saveOverlay(appearance()));
  }

  element("reset-position").addEventListener("click", () => settingsApi.resetPosition());
  sample.addEventListener("click", () => {
    if (view) settingsApi.setSampleShowing(!view.sampleShowing);
  });
}
