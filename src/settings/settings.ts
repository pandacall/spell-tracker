import { readFileSync, writeFileSync } from "node:fs";

export interface Settings {
  /** A single character such as "`", or a function key "F1" to "F24". */
  shareKey: string;
  /** True: Share also presses Enter to send. False: it types the message and stops, for the user to send. */
  autoSend: boolean;
  /** Where the user last dragged the overlay to (top-left, screen coordinates). Absent until they do. */
  overlayPosition?: { x: number; y: number };
}

export const DEFAULT_SETTINGS: Settings = { shareKey: "`", autoSend: false };

/**
 * The settings in a settings file's text. A missing file (undefined), text
 * that isn't a JSON object, and any setting that is absent or the wrong type
 * all fall back to the defaults.
 */
export function parseSettings(text: string | undefined): Settings {
  let file: Partial<Record<keyof Settings, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(text ?? "null");
    if (typeof parsed === "object" && parsed !== null) file = parsed;
  } catch {
    // Not valid JSON: use the defaults rather than refuse to start.
  }
  const position = file.overlayPosition as { x?: unknown; y?: unknown } | null | undefined;
  const overlayPosition =
    typeof position?.x === "number" && typeof position.y === "number" && Number.isFinite(position.x) && Number.isFinite(position.y)
      ? { x: position.x, y: position.y }
      : undefined;
  return {
    shareKey:
      typeof file.shareKey === "string" && file.shareKey.trim() !== ""
        ? file.shareKey.trim()
        : DEFAULT_SETTINGS.shareKey,
    autoSend: typeof file.autoSend === "boolean" ? file.autoSend : DEFAULT_SETTINGS.autoSend,
    ...(overlayPosition && { overlayPosition }),
  };
}

export function loadSettings(filePath: string): Settings {
  let text: string | undefined;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    // No settings file yet.
  }
  return parseSettings(text);
}

/**
 * Records the overlay position in the settings file, leaving everything else
 * in it as the user wrote it. Creates the file if there is none; a file that
 * isn't a JSON object is left alone.
 */
export function saveOverlayPosition(filePath: string, position: { x: number; y: number }): void {
  let file: Record<string, unknown> = {};
  let text: string | undefined;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    // No file yet: start a fresh one.
  }
  if (text !== undefined) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
      file = parsed as Record<string, unknown>;
    } catch {
      // The user's hand-edited file is broken: leave it for them to fix rather than overwrite it.
      return;
    }
  }
  writeFileSync(filePath, JSON.stringify({ ...file, overlayPosition: position }, null, 2));
}
