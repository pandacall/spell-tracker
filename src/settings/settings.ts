import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface Settings {
  /** A single character such as "`", or a function key "F1" to "F24". */
  shareKey: string;
  /** True: Share also presses Enter to send. False: it types the message and stops, for the user to send. */
  autoSend: boolean;
  /** Where the user last dragged the overlay to (top-left, screen coordinates). Absent until they do. */
  overlayPosition?: { x: number; y: number };
  /** How big the overlay is, as a percent of its normal size. */
  overlaySize: number;
  /** How opaque the overlay is while the pointer is not over it, as a percent. */
  overlayOpacity: number;
}

export const DEFAULT_SETTINGS: Settings = { shareKey: "`", autoSend: false, overlaySize: 100, overlayOpacity: 50 };

const OVERLAY_SIZE_RANGE = { min: 50, max: 150 };
const OVERLAY_OPACITY_RANGE = { min: 20, max: 100 };

/** A finite number clamped into the range and rounded to an integer; anything else is the fallback. */
function percent(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(range.max, Math.max(range.min, value)));
}

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
    overlaySize: percent(file.overlaySize, OVERLAY_SIZE_RANGE, DEFAULT_SETTINGS.overlaySize),
    overlayOpacity: percent(file.overlayOpacity, OVERLAY_OPACITY_RANGE, DEFAULT_SETTINGS.overlayOpacity),
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

/** Settings to change in the file. A `null` overlay position removes it. */
export type SettingsPatch = Partial<Omit<Settings, "overlayPosition">> & {
  overlayPosition?: { x: number; y: number } | null;
};

/**
 * Applies the patch to the settings file, leaving every other key in it as the
 * user wrote it. Creates the file if there is none. A file that isn't a JSON
 * object is first moved aside to settings.broken.json (replacing any earlier
 * one) so nothing the user typed is lost.
 */
export function saveSettings(filePath: string, patch: SettingsPatch): void {
  let file: Record<string, unknown> = {};
  let text: string | undefined;
  try {
    text = readFileSync(filePath, "utf8");
  } catch {
    // No file yet: start a fresh one.
  }
  if (text !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Falls through to the broken-file handling below.
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      file = parsed as Record<string, unknown>;
    } else {
      renameSync(filePath, path.join(path.dirname(filePath), "settings.broken.json"));
    }
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete file[key];
    else if (value !== undefined) file[key] = value;
  }
  writeFileSync(filePath, JSON.stringify(file, null, 2));
}

export interface SettingsStore {
  current(): Settings;
  /** Saves the patch to the file and returns the settings as they now stand. */
  update(patch: SettingsPatch): Settings;
}

/**
 * The settings as read once at startup, kept in memory and changed only
 * through `update`, which writes just the patched keys to the file.
 */
export function createSettingsStore(filePath: string): SettingsStore {
  let settings = loadSettings(filePath);
  return {
    current: () => settings,
    update(patch) {
      saveSettings(filePath, patch);
      const { overlayPosition, ...rest } = patch;
      const merged: Settings = { ...settings, ...rest };
      if (overlayPosition === null) delete merged.overlayPosition;
      else if (overlayPosition !== undefined) merged.overlayPosition = overlayPosition;
      settings = merged;
      return settings;
    },
  };
}
