import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const DEFAULTS = { shareKey: "`", autoSend: false, overlaySize: 100, overlayOpacity: 50 };

const tempDir = () => mkdtempSync(path.join(tmpdir(), "spell-tracker-"));
import { createSettingsStore, loadSettings, parseSettings, saveSettings } from "./settings";

describe("Settings", () => {
  it("falls back to the defaults when there is no settings file", () => {
    expect(parseSettings(undefined)).toEqual(DEFAULTS);
  });

  it("reads the Share key and auto-send from the settings file", () => {
    const text = JSON.stringify({ shareKey: "F8", autoSend: false });

    expect(parseSettings(text)).toEqual({ ...DEFAULTS, shareKey: "F8" });
  });

  it("falls back to the default for each setting the file leaves out or gets wrong", () => {
    expect(parseSettings(JSON.stringify({ autoSend: true }))).toEqual({ ...DEFAULTS, autoSend: true });
    expect(parseSettings(JSON.stringify({ shareKey: "", autoSend: "yes" }))).toEqual(DEFAULTS);
  });

  it("falls back to the defaults when the file is not valid JSON", () => {
    expect(parseSettings("{ not json")).toEqual(DEFAULTS);
    expect(parseSettings("null")).toEqual(DEFAULTS);
  });

  it("has no overlay position until one has been saved", () => {
    expect(parseSettings(undefined).overlayPosition).toBeUndefined();
  });

  it("reads a saved overlay position, ignoring one that is malformed", () => {
    expect(parseSettings(JSON.stringify({ overlayPosition: { x: 40, y: -12 } })).overlayPosition).toEqual({
      x: 40,
      y: -12,
    });
    expect(parseSettings(JSON.stringify({ overlayPosition: { x: "40", y: 5 } })).overlayPosition).toBeUndefined();
    expect(parseSettings(JSON.stringify({ overlayPosition: [1, 2] })).overlayPosition).toBeUndefined();
  });

  it("saves the overlay position without disturbing the other settings in the file", () => {
    const file = path.join(tempDir(), "settings.json");
    writeFileSync(file, JSON.stringify({ shareKey: "F8", note: "mine" }));

    saveSettings(file, { overlayPosition: { x: 100, y: 200 } });

    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      shareKey: "F8",
      note: "mine",
      overlayPosition: { x: 100, y: 200 },
    });
    expect(loadSettings(file)).toEqual({ ...DEFAULTS, shareKey: "F8", overlayPosition: { x: 100, y: 200 } });
  });

  it("creates the settings file when saving and there is none", () => {
    const file = path.join(tempDir(), "settings.json");

    saveSettings(file, { overlayPosition: { x: 1, y: 2 } });

    expect(loadSettings(file).overlayPosition).toEqual({ x: 1, y: 2 });
  });

  it("reads overlay size and opacity, clamping them into range and falling back when not numbers", () => {
    expect(parseSettings(JSON.stringify({ overlaySize: 120, overlayOpacity: 80 }))).toMatchObject({
      overlaySize: 120,
      overlayOpacity: 80,
    });
    expect(parseSettings(JSON.stringify({ overlaySize: 400, overlayOpacity: 5 }))).toMatchObject({
      overlaySize: 150,
      overlayOpacity: 20,
    });
    expect(parseSettings(JSON.stringify({ overlaySize: 60 }))).toMatchObject({ overlaySize: 75 });
    expect(parseSettings(JSON.stringify({ overlaySize: "big", overlayOpacity: null }))).toMatchObject({
      overlaySize: 100,
      overlayOpacity: 50,
    });
  });

  it("writes only the changed setting, keeping hand edits made on disk since startup", () => {
    const file = path.join(tempDir(), "settings.json");
    writeFileSync(file, JSON.stringify({ shareKey: "F8", note: "mine" }));
    const store = createSettingsStore(file);
    writeFileSync(file, JSON.stringify({ shareKey: "F9", note: "mine" }));

    store.update({ autoSend: true });

    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ shareKey: "F9", note: "mine", autoSend: true });
  });

  it("removes the overlay position when patched with null", () => {
    const file = path.join(tempDir(), "settings.json");
    writeFileSync(file, JSON.stringify({ shareKey: "F8", overlayPosition: { x: 1, y: 2 } }));

    saveSettings(file, { overlayPosition: null });

    expect(loadSettings(file).overlayPosition).toBeUndefined();
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ shareKey: "F8" });
  });

  it.each(["{ not json", "[1, 2]", "42"])(
    "moves an unusable settings file (%s) aside to settings.broken.json before saving",
    (text) => {
      const dir = tempDir();
      const file = path.join(dir, "settings.json");
      writeFileSync(file, text);
      writeFileSync(path.join(dir, "settings.broken.json"), "old");

      saveSettings(file, { overlayPosition: { x: 1, y: 2 } });

      expect(readFileSync(path.join(dir, "settings.broken.json"), "utf8")).toBe(text);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ overlayPosition: { x: 1, y: 2 } });
    },
  );

  it("the store reflects each update without re-reading hand edits into its other settings", () => {
    const file = path.join(tempDir(), "settings.json");
    writeFileSync(file, JSON.stringify({ shareKey: "F8" }));
    const store = createSettingsStore(file);
    writeFileSync(file, JSON.stringify({ shareKey: "F9" }));

    store.update({ overlaySize: 120 });

    expect(store.current()).toMatchObject({ shareKey: "F8", overlaySize: 120 });
  });

  it("the store forgets the overlay position when patched with null", () => {
    const file = path.join(tempDir(), "settings.json");
    writeFileSync(file, JSON.stringify({ overlayPosition: { x: 1, y: 2 } }));
    const store = createSettingsStore(file);

    store.update({ overlayPosition: null });

    expect(store.current().overlayPosition).toBeUndefined();
  });

  it("reads a settings file saved with a byte order mark", () => {
    expect(parseSettings("﻿" + JSON.stringify({ shareKey: "F8" }))).toEqual({ ...DEFAULTS, shareKey: "F8" });
  });

  it("saves into a file with a byte order mark without moving it aside", () => {
    const dir = tempDir();
    const file = path.join(dir, "settings.json");
    writeFileSync(file, "﻿" + JSON.stringify({ shareKey: "F8" }));

    saveSettings(file, { autoSend: true });

    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ shareKey: "F8", autoSend: true });
    expect(existsSync(path.join(dir, "settings.broken.json"))).toBe(false);
  });

  it("logs instead of throwing when the store cannot save, and still applies the change", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(tempDir(), "missing-folder", "settings.json");
    const store = createSettingsStore(file);

    expect(() => store.update({ overlaySize: 120 })).not.toThrow();

    expect(store.current().overlaySize).toBe(120);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("does not overwrite a settings file that exists but cannot be read", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const dir = tempDir();
    // A directory where the file should be: reading it fails with EISDIR, not ENOENT.
    const file = path.join(dir, "settings.json");
    mkdirSync(file);

    expect(() => saveSettings(file, { autoSend: true })).not.toThrow();

    expect(statSync(file).isDirectory()).toBe(true);
    expect(existsSync(path.join(dir, "settings.broken.json"))).toBe(false);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("the store still applies a change when the file cannot be read", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const file = path.join(tempDir(), "settings.json");
    mkdirSync(file);
    const store = createSettingsStore(file);

    store.update({ autoSend: true });

    expect(store.current().autoSend).toBe(true);
    error.mockRestore();
  });
});
