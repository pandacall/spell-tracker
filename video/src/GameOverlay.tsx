// The Spell Tracker overlay as the app draws it (src/renderer/overlay.css),
// at its real size, so it can be composited onto recorded gameplay.
import { Img, interpolate } from "remotion";

/** Data Dragon patch the icons come from. */
const ICON_VERSION = "16.20.1";
const CDN = `https://ddragon.leagueoflegends.com/cdn/${ICON_VERSION}/img`;

/**
 * The overlay window's size and where it sits in the footage: dragged to the
 * right edge, just above the teammate portraits (left and top as screen fractions).
 */
export const OVERLAY_BOX = { width: 128, height: 200, left: 1780 / 1920, top: 335 / 1080 };

export type Role = "top" | "jg" | "mid" | "bot" | "sup";

export interface Enemy {
  role: Role;
  /** Data Dragon champion id, e.g. "MissFortune". */
  champion: string;
  /** Data Dragon spell ids in the order the game lists them, e.g. ["SummonerFlash", "SummonerTeleport"]. */
  spells: [string, string];
}

/** A spell Marked at game-clock second `markedAt` that is ready again at `readyAt`. */
export interface Mark {
  role: Role;
  spell: string;
  markedAt: number;
  readyAt: number;
}

/** The pointer moving onto a spell icon and clicking it (the Mark) at game-clock second `at`. */
export interface Click {
  role: Role;
  spell: string;
  at: number;
}

const ICON = 28;
const GAP = 3;
const ROW_PADDING = 2;
const HANDLE = 8 + 3;

const formatCountdown = (seconds: number) => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** Top-left of a spell icon inside the overlay, for pointing the cursor at it. */
function spellOffset(enemies: Enemy[], role: Role, spell: string) {
  const row = enemies.findIndex((enemy) => enemy.role === role);
  const slot = enemies[row].spells.indexOf(spell);
  return {
    x: GAP + ROW_PADDING + ICON + 3 + GAP + slot * (ICON + GAP),
    y: HANDLE + GAP + row * (ICON + 2 * ROW_PADDING + GAP) + ROW_PADDING,
  };
}

const Cursor: React.FC<{ enemies: Enemy[]; click: Click; t: number }> = ({ enemies, click, t }) => {
  const target = spellOffset(enemies, click.role, click.spell);
  const travel = interpolate(t, [click.at - 0.7, click.at - 0.1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const press = interpolate(t, [click.at - 0.05, click.at, click.at + 0.12], [1, 0.82, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const visible = interpolate(t, [click.at - 0.8, click.at - 0.6, click.at + 0.8, click.at + 1.1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = interpolate(travel, [0, 1], [target.x + 70, target.x + 16]);
  const y = interpolate(travel, [0, 1], [target.y + 60, target.y + 14]);
  const ring = interpolate(t, [click.at, click.at + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      {t >= click.at && ring < 1 && (
        <div
          style={{
            position: "absolute",
            left: target.x + ICON / 2 - 18 * ring,
            top: target.y + ICON / 2 - 18 * ring,
            width: 36 * ring,
            height: 36 * ring,
            borderRadius: "50%",
            border: "2px solid rgba(255, 216, 74, 0.9)",
            opacity: 1 - ring,
          }}
        />
      )}
      <svg
        width={22}
        height={28}
        viewBox="0 0 22 28"
        style={{ position: "absolute", left: x, top: y, opacity: visible, transform: `scale(${press})`, transformOrigin: "0 0", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
      >
        <path d="M1 1 L1 22 L6.5 17 L10.5 26 L14 24.5 L10 15.5 L17.5 15.5 Z" fill="#fff" stroke="#111" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** The overlay inside a 1920x1080 stage at game-clock second `gameTime`. */
export const GameOverlay: React.FC<{ enemies: Enemy[]; marks: Mark[]; clicks: Click[]; gameTime: number }> = ({ enemies, marks, clicks, gameTime }) => {
  const countdownOf = (role: Role, spell: string) => {
    const mark = marks.find((candidate) => candidate.role === role && candidate.spell === spell && gameTime >= candidate.markedAt && gameTime < candidate.readyAt);
    return mark ? mark.readyAt - gameTime : undefined;
  };
  const click = clicks.find((candidate) => Math.abs(gameTime - candidate.at) < 1.5);
  return (
    <div
      style={{
        position: "absolute",
        left: 1920 * OVERLAY_BOX.left,
        top: 1080 * OVERLAY_BOX.top,
        width: OVERLAY_BOX.width,
        height: OVERLAY_BOX.height,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          height: 8,
          margin: "3px 3px 0",
          borderRadius: 4,
          opacity: 0.5,
          background: "rgba(10, 14, 22, 0.45) repeating-linear-gradient(90deg, transparent 0 4px, rgba(255, 255, 255, 0.35) 4px 6px)",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: GAP, padding: GAP, opacity: 0.5 }}>
        {enemies.map((enemy) => (
          <div key={enemy.role} style={{ display: "flex", alignItems: "center", gap: GAP, padding: ROW_PADDING, background: "rgba(10, 14, 22, 0.45)", borderRadius: 5 }}>
            <Img src={`${CDN}/champion/${enemy.champion}.png`} style={{ width: ICON, height: ICON, borderRadius: "50%", marginRight: 3, display: "block" }} />
            {enemy.spells.map((spell) => {
              const countdown = countdownOf(enemy.role, spell);
              return (
                <div key={spell} style={{ position: "relative", width: ICON, height: ICON }}>
                  <Img
                    src={`${CDN}/spell/${spell}.png`}
                    style={{ width: ICON, height: ICON, borderRadius: 3, display: "block", filter: countdown !== undefined ? "brightness(0.3)" : undefined }}
                  />
                  {countdown !== undefined && (
                    <span
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        font: "bold 11px/1 sans-serif",
                        color: "#fff",
                        textShadow: "0 0 2px #000, 0 0 2px #000",
                      }}
                    >
                      {formatCountdown(countdown)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {click && <Cursor enemies={enemies} click={click} t={gameTime} />}
    </div>
  );
};
