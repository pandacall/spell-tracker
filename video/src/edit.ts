// The edit decision list: which clip plays under which part of the voiceover,
// and where the camera looks. Tune this after recording real footage.

import type { Click, Enemy, Mark } from "./GameOverlay";

export type ClipId = "A" | "B" | "C" | "D" | "E" | "F";

/**
 * Where the camera looks in the recorded frame, `at` seconds into the scene.
 * x and y are 0..1 across the recording; zoom 1 fills the output frame.
 * The vertical cut crops in around the same point, or at `vx` and `vzoom` if given.
 */
export interface CameraKey {
  at: number;
  x: number;
  y: number;
  zoom: number;
  vzoom?: number;
  vx?: number;
}

export interface Scene {
  clip: ClipId;
  /** The scene cuts in as the voice starts this phrase. */
  phrase: string;
  /** Seconds into the clip at which the scene begins (skip a lead-in). */
  trim: number;
  camera: CameraKey[];
}

// Where the overlay and chat sit in a 16:9 recording (centres, as screen fractions).
// The overlay is dragged to the right edge above the teammate portraits (OVERLAY_BOX
// in GameOverlay.tsx); chat is League's left-side log.
const OVERLAY = { x: (1780 + 64) / 1920, y: (335 + 100) / 1080 };
const CHAT = { x: 0.165, y: 0.69 };

/** The enemy team in the footage (read from its chat pings), in overlay Role order. */
export const ENEMIES: Enemy[] = [
  { role: "top", champion: "Garen", spells: ["SummonerFlash", "SummonerDot"] },
  { role: "jg", champion: "Kayn", spells: ["SummonerFlash", "SummonerSmite"] },
  { role: "mid", champion: "Ekko", spells: ["SummonerFlash", "SummonerTeleport"] },
  { role: "bot", champion: "Jhin", spells: ["SummonerFlash", "SummonerHeal"] },
  { role: "sup", champion: "Senna", spells: ["SummonerFlash", "SummonerExhaust"] },
];

/** Game clock m:ss as seconds. */
const clock = (time: string) => {
  const [minutes, seconds] = time.split(":").map(Number);
  return minutes * 60 + seconds;
};

/**
 * What's down across the game, on the game clock, so every scene's overlay agrees
 * with the clock on screen and the Share at ~10:00 reads "1230 mid 1440 bot".
 */
export const MARKS: Mark[] = [
  { role: "mid", spell: "SummonerFlash", markedAt: clock("7:30"), readyAt: clock("12:30") },
  { role: "mid", spell: "SummonerTeleport", markedAt: clock("7:10"), readyAt: clock("13:00") },
  { role: "bot", spell: "SummonerFlash", markedAt: clock("9:40"), readyAt: clock("14:40") },
];

/** The on-screen click that Marks bot's Flash (scene C). */
export const CLICKS: Click[] = [{ role: "bot", spell: "SummonerFlash", at: clock("9:40") }];

export const CLIP_LABELS: Record<ClipId, string> = {
  A: "An enemy Flashes in a fight or gank",
  B: "Game loads, overlay appears with 5 Enemy rows",
  C: "Click to Mark Flash, Countdown starts",
  D: "Several Countdowns running (Lucidity Boots, Teleport)",
  E: "Press the Share key, the Share Line types into chat",
  F: "Win a fight on someone without Flash",
};

export const SCENES: Scene[] = [
  {
    clip: "A",
    phrase: "ever lose track",
    trim: 0,
    camera: [
      { at: 0, x: 0.5, y: 0.5, zoom: 1.1 },
      { at: 2.4, x: 0.5, y: 0.48, zoom: 1.35 },
    ],
  },
  {
    clip: "B",
    phrase: "meet spell tracker",
    trim: 0,
    camera: [
      { at: 0, x: 0.5, y: 0.5, zoom: 1 },
      { at: 1.2, x: 0.5, y: 0.5, zoom: 1 },
      { at: 2.6, ...OVERLAY, zoom: 2.4 },
      { at: 5.3, ...OVERLAY, zoom: 2.6 },
    ],
  },
  {
    clip: "C",
    phrase: "saw them flash",
    trim: 0,
    camera: [
      { at: 0, ...OVERLAY, zoom: 2.6 },
      { at: 1.2, ...OVERLAY, zoom: 3.4 },
      { at: 3.5, ...OVERLAY, zoom: 3.6 },
    ],
  },
  {
    clip: "D",
    phrase: "it even handles",
    trim: 0,
    camera: [
      { at: 0, x: OVERLAY.x, y: OVERLAY.y - 0.02, zoom: 3.2 },
      { at: 3.4, x: OVERLAY.x, y: OVERLAY.y + 0.02, zoom: 3 },
    ],
  },
  {
    clip: "E",
    phrase: "then hit one key",
    trim: 0,
    camera: [
      { at: 0, x: 0.5, y: 0.6, zoom: 1.2 },
      // Vertical punches in on the start of the chat line so it clears the captions.
      { at: 1.4, ...CHAT, zoom: 2.4, vzoom: 2, vx: 0.105 },
      { at: 6, ...CHAT, zoom: 2.7, vzoom: 2.1, vx: 0.105 },
    ],
  },
  {
    clip: "F",
    phrase: "your whole team",
    trim: 0,
    camera: [
      { at: 0, x: 0.5, y: 0.5, zoom: 1.1 },
      { at: 2.5, x: 0.5, y: 0.5, zoom: 1.3 },
    ],
  },
];

/** The end card takes over as the voice says this. */
export const OUTRO_PHRASE = "spell tracker stop";

/** Caption text for words that read better as numbers on screen. */
export const CAPTION_TEXT: Record<string, string> = {
  "twelve-thirty": "12:30",
  "fourteen-forty": "14:40",
};

export const SHARE_LINE = "1230 mid 1440 bot";
/** Who the Share appears from in the footage's chat (champion only, no player name). */
export const SHARE_SENDER = "Shaco";
/** The Share key as printed on the keycap: shifted symbol above, the key itself below. */
export const SHARE_KEY = { shifted: "~", key: "`" };

export const BRAND = {
  blue: "#2f8be0",
  deep: "#0f3f7a",
  ink: "#0a0e16",
  flash: "#ffd84a",
};
