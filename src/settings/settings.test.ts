import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSettings, parseSettings, saveOverlayPosition } from "./settings";

describe("Settings", () => {
  it("falls back to the defaults when there is no settings file", () => {
    expect(parseSettings(undefined)).toEqual({ shareKey: "`", autoSend: false });
  });

  it("reads the Share key and auto-send from the settings file", () => {
    const text = JSON.stringify({ shareKey: "F8", autoSend: false });

    expect(parseSettings(text)).toEqual({ shareKey: "F8", autoSend: false });
  });

  it("falls back to the default for each setting the file leaves out or gets wrong", () => {
    expect(parseSettings(JSON.stringify({ autoSend: true }))).toEqual({ shareKey: "`", autoSend: true });
    expect(parseSettings(JSON.stringify({ shareKey: "", autoSend: "yes" }))).toEqual({
      shareKey: "`",
      autoSend: false,
    });
  });

  it("falls back to the defaults when the file is not valid JSON", () => {
    expect(parseSettings("{ not json")).toEqual({ shareKey: "`", autoSend: false });
    expect(parseSettings("null")).toEqual({ shareKey: "`", autoSend: false });
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
    const file = path.join(mkdtempSync(path.join(tmpdir(), "spell-tracker-")), "settings.json");
    writeFileSync(file, JSON.stringify({ shareKey: "F8", note: "mine" }));

    saveOverlayPosition(file, { x: 100, y: 200 });

    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      shareKey: "F8",
      note: "mine",
      overlayPosition: { x: 100, y: 200 },
    });
    expect(loadSettings(file)).toEqual({ shareKey: "F8", autoSend: false, overlayPosition: { x: 100, y: 200 } });
  });

  it("creates the settings file when saving a position and there is none", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "spell-tracker-")), "settings.json");

    saveOverlayPosition(file, { x: 1, y: 2 });

    expect(loadSettings(file).overlayPosition).toEqual({ x: 1, y: 2 });
  });

  it("leaves a settings file it cannot parse alone when saving a position", () => {
    const file = path.join(mkdtempSync(path.join(tmpdir(), "spell-tracker-")), "settings.json");
    writeFileSync(file, "{ not json");

    saveOverlayPosition(file, { x: 1, y: 2 });

    expect(readFileSync(file, "utf8")).toBe("{ not json");
  });
});
