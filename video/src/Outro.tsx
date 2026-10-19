import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import footage from "../footage.json";
import { BRAND } from "./edit";

/** End card: the icon and name land, then the tagline as the voice says it (`taglineAt` frames in). */
export const Outro: React.FC<{ vertical: boolean; taglineAt: number }> = ({ vertical, taglineAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp" });
  const icon = spring({ frame, fps, config: { damping: 11, stiffness: 160 } });
  const name = spring({ frame: frame - 5, fps, config: { damping: 14 } });
  const tagline = spring({ frame: frame - taglineAt, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: fade,
        background: `radial-gradient(circle at 50% 42%, ${BRAND.blue} 0%, ${BRAND.deep} 58%, ${BRAND.ink} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: vertical ? 40 : 28,
        fontFamily: "Poppins",
        color: "#fff",
      }}
    >
      <Img
        src={staticFile("icon.png")}
        style={{
          width: vertical ? 300 : 240,
          height: vertical ? 300 : 240,
          borderRadius: 56,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          transform: `scale(${icon}) rotate(${(1 - icon) * -40}deg)`,
        }}
      />
      <div style={{ fontWeight: 800, fontSize: vertical ? 120 : 130, letterSpacing: -3, lineHeight: 1, opacity: name, transform: `translateY(${(1 - name) * 40}px)` }}>
        Spell Tracker
      </div>
      <div style={{ fontWeight: 600, fontSize: vertical ? 60 : 56, color: BRAND.flash, opacity: tagline, transform: `translateY(${(1 - tagline) * 30}px)` }}>
        Stop guessing.
      </div>
      <div style={{ position: "absolute", bottom: vertical ? 120 : 40, left: 60, right: 60, textAlign: "center", fontSize: 22, opacity: 0.6 * name }}>
        {footage.credit}
        <br />
        Not endorsed by Riot Games. League of Legends is a trademark of Riot Games, Inc.
      </div>
    </div>
  );
};
