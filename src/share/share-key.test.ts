import { describe, expect, it } from "vitest";
import { parseShareKey, recordShareKey } from "./share-key";

describe("parseShareKey", () => {
  it.each([
    ["`", { kind: "character", character: "`" }],
    ["ö", { kind: "character", character: "ö" }],
    ["F8", { kind: "function", number: 8 }],
    ["f24", { kind: "function", number: 24 }],
    ["scan:41", { kind: "scan", scanCode: 41 }],
  ])("reads the Share key %s", (value, expected) => expect(parseShareKey(value)).toEqual(expected));

  it.each(["F0", "F25", "scan:abc", "scan:0", "scan:256", "scan:", "ab", ""])("refuses the Share key %j", (value) =>
    expect(parseShareKey(value)).toBeUndefined(),
  );
});

describe("recordShareKey", () => {
  it("records the key under Esc by where it is, so dead keys and other layouts work", () => {
    expect(recordShareKey("Backquote")).toEqual({ outcome: "accepted", shareKey: "scan:41", leagueAlsoUses: false });
    expect(recordShareKey("IntlBackslash")).toEqual({ outcome: "accepted", shareKey: "scan:86", leagueAlsoUses: false });
  });

  it("records function keys in the existing F form", () =>
    expect(recordShareKey("F5")).toMatchObject({ outcome: "accepted", shareKey: "F5" }));

  it.each(["ShiftLeft", "ShiftRight", "ControlLeft", "AltRight", "MetaLeft"])("ignores %s pressed on its own", (code) =>
    expect(recordShareKey(code)).toEqual({ outcome: "ignored" }),
  );

  it.each(["Enter", "NumpadEnter", "Tab", "Space"])("refuses %s as reserved", (code) =>
    expect(recordShareKey(code)).toEqual({ outcome: "refused", reason: "reserved" }),
  );

  it.each(["ArrowUp", "Home", "Insert", "Escape", "Numpad5"])("refuses %s as unsupported", (code) =>
    expect(recordShareKey(code)).toEqual({ outcome: "refused", reason: "unsupported" }),
  );

  it.each(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyD", "KeyF", "KeyB", "KeyP", "KeyY", "Digit1", "Digit7"])(
    "warns that League also uses %s",
    (code) => expect(recordShareKey(code)).toMatchObject({ outcome: "accepted", leagueAlsoUses: true }),
  );

  it("does not warn for keys League leaves alone", () =>
    expect(recordShareKey("Digit8")).toMatchObject({ leagueAlsoUses: false }));
});
