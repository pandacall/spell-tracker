/** A Share key as stored in settings: one character, F1-F24, or a physical key by scan code. */
export type ShareKey =
  | { kind: "character"; character: string }
  | { kind: "function"; number: number }
  | { kind: "scan"; scanCode: number };

/** Reads a stored Share key; undefined when it isn't one of the three forms. */
export function parseShareKey(value: string): ShareKey | undefined {
  const functionKey = /^F(\d{1,2})$/i.exec(value);
  if (functionKey) {
    const number = Number(functionKey[1]);
    return number >= 1 && number <= 24 ? { kind: "function", number } : undefined;
  }
  const scan = /^scan:(\d{1,3})$/.exec(value);
  if (scan) {
    const scanCode = Number(scan[1]);
    return scanCode >= 1 && scanCode <= 255 ? { kind: "scan", scanCode } : undefined;
  }
  return value.length === 1 ? { kind: "character", character: value } : undefined;
}

export type RecordedShareKey =
  | { outcome: "accepted"; shareKey: string; leagueAlsoUses: boolean }
  | { outcome: "ignored" }
  | { outcome: "refused"; reason: "reserved" | "unsupported" };

// KeyboardEvent.code -> PC set-1 scan code, for the keys that produce characters.
const SCAN_CODES: Record<string, number> = {
  Backquote: 0x29,
  Minus: 0x0c,
  Equal: 0x0d,
  BracketLeft: 0x1a,
  BracketRight: 0x1b,
  Semicolon: 0x27,
  Quote: 0x28,
  Backslash: 0x2b,
  Comma: 0x33,
  Period: 0x34,
  Slash: 0x35,
  IntlBackslash: 0x56,
  IntlRo: 0x73,
  IntlYen: 0x7d,
};
// Rows of letters and digits run in consecutive scan codes.
for (const [keys, first, prefix] of [
  ["1234567890", 0x02, "Digit"],
  ["QWERTYUIOP", 0x10, "Key"],
  ["ASDFGHJKL", 0x1e, "Key"],
  ["ZXCVBNM", 0x2c, "Key"],
] as const) {
  [...keys].forEach((key, index) => (SCAN_CODES[prefix + key] = first + index));
}

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"].flatMap((name) => [`${name}Left`, `${name}Right`]));
// Enter sends the chat message and Tab opens the scoreboard, so neither can be the Share key.
const RESERVED = new Set(["Enter", "NumpadEnter", "Tab", "Space"]);
// Keys League binds by default (spells, items, ping, and so on), by code.
const LEAGUE_CODES = new Set(["KeyQ", "KeyW", "KeyE", "KeyR", "KeyD", "KeyF", "KeyB", "KeyP", "KeyY", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7"]);

/**
 * Turns a pressed key (`KeyboardEvent.code`) into a Share key. Keys are stored
 * by where they are on the keyboard, so dead keys and layout changes still work.
 */
export function recordShareKey(code: string): RecordedShareKey {
  if (MODIFIERS.has(code)) return { outcome: "ignored" };
  if (RESERVED.has(code)) return { outcome: "refused", reason: "reserved" };
  if (parseShareKey(code)?.kind === "function") return { outcome: "accepted", shareKey: code, leagueAlsoUses: false };
  const scanCode = SCAN_CODES[code];
  if (scanCode === undefined) return { outcome: "refused", reason: "unsupported" };
  return { outcome: "accepted", shareKey: `scan:${scanCode}`, leagueAlsoUses: LEAGUE_CODES.has(code) };
}
