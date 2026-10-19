import { readFileSync } from "node:fs";

export interface Settings {
  /** An Electron accelerator, e.g. "`" or "F8". */
  shareKey: string;
  autoSend: boolean;
}

export const DEFAULT_SETTINGS: Settings = { shareKey: "`", autoSend: true };

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
  return {
    shareKey:
      typeof file.shareKey === "string" && file.shareKey.trim() !== ""
        ? file.shareKey.trim()
        : DEFAULT_SETTINGS.shareKey,
    autoSend: typeof file.autoSend === "boolean" ? file.autoSend : DEFAULT_SETTINGS.autoSend,
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
