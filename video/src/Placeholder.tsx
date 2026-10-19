// A stand-in "recording" for a clip that hasn't been recorded yet: a mock
// skirmish on a dark map with League's HUD, so camera moves can be judged
// before the footage exists. The overlay and chat are drawn on top as usual.
import { interpolate } from "remotion";
import type { ClipId } from "./edit";

export const Placeholder: React.FC<{ clip: ClipId; t: number }> = ({ clip, t }) => {
  const burst = clip === "A" ? interpolate(t, [0.8, 1.0, 1.5], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background:
          "radial-gradient(ellipse at 30% 40%, #2c4a3a 0%, transparent 55%), radial-gradient(ellipse at 75% 60%, #24394f 0%, transparent 50%), linear-gradient(160deg, #18261f, #101820)",
      }}
    >
      {/* A diagonal river and lanes, for a sense of the map. */}
      <div style={{ position: "absolute", left: -200, top: 500, width: 2400, height: 90, background: "rgba(70,120,150,0.25)", transform: "rotate(-24deg)" }} />
      {/* Champions in a skirmish. */}
      {[
        [880, 470, "#d65a5a"],
        [1010, 540, "#4a90d9"],
        [950, 610, "#3aa17e"],
        [1110, 450, "#8e6bd8"],
      ].map(([x, y, color], index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            left: (x as number) + Math.sin(t * 2 + index) * 30,
            top: (y as number) + Math.cos(t * 1.6 + index) * 20,
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: color as string,
            border: "3px solid rgba(255,255,255,0.7)",
          }}
        />
      ))}
      {burst > 0 && (
        <div
          style={{
            position: "absolute",
            left: 880 - 90 * burst,
            top: 470 - 90 * burst,
            width: 54 + 180 * burst,
            height: 54 + 180 * burst,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(255,240,150,${burst}) 0%, rgba(255,216,74,${burst * 0.6}) 40%, transparent 70%)`,
          }}
        />
      )}
      {/* League's HUD and minimap, for orientation. */}
      <div style={{ position: "absolute", left: 640, top: 960, width: 640, height: 120, background: "linear-gradient(#1d2430, #0b0f15)", border: "2px solid #6b5a2e", borderBottom: "none", borderRadius: "10px 10px 0 0" }} />
      <div style={{ position: "absolute", right: 0, bottom: 0, width: 260, height: 260, background: "#1a2b22", border: "2px solid #6b5a2e" }} />
    </div>
  );
};
