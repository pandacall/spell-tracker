import { describe, expect, it } from "vitest";
import { parseSettings } from "./settings";

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
});
