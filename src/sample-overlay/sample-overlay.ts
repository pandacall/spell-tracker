import type { EnemyRow, OverlayState, OverlaySpell } from "../tracker/tracker";

/** Seconds in one loop of the sample Countdown. */
const COUNTDOWN_PERIOD = 300;

function flash(): OverlaySpell {
  return { id: "SummonerFlash", name: "Flash" };
}

/**
 * A sample overlay with five Enemies in Role order, for adjusting the overlay outside a game.
 * Mid's Flash runs a Countdown that loops every five minutes; no other spell counts down.
 */
export function sampleOverlay(elapsedSeconds: number): OverlayState {
  const countdown = COUNTDOWN_PERIOD - (Math.floor(elapsedSeconds) % COUNTDOWN_PERIOD);
  const rows: EnemyRow[] = [
    {
      role: "top",
      champion: { id: "Garen", name: "Garen" },
      spells: [flash(), { id: "SummonerTeleport", name: "Teleport" }],
    },
    {
      role: "jg",
      champion: { id: "LeeSin", name: "Lee Sin" },
      spells: [flash(), { id: "SummonerSmite", name: "Smite" }],
    },
    {
      role: "mid",
      champion: { id: "Ahri", name: "Ahri" },
      spells: [{ ...flash(), countdown }, { id: "SummonerDot", name: "Ignite" }],
    },
    {
      role: "bot",
      champion: { id: "Jinx", name: "Jinx" },
      spells: [flash(), { id: "SummonerHeal", name: "Heal" }],
    },
    {
      role: "sup",
      champion: { id: "Thresh", name: "Thresh" },
      spells: [flash(), { id: "SummonerExhaust", name: "Exhaust" }],
    },
  ];
  return { visible: true, rows, roleSetupNeeded: false };
}
