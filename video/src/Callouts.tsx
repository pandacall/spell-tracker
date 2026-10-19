// Graphics laid over the footage at moments in the voiceover.
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, SHARE_KEY, SHARE_LINE } from "./edit";

const useEntrance = (delay = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 180 } });
};

/** Fades a callout out over its last few frames. */
const useExit = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

const glass: React.CSSProperties = {
  background: "rgba(10, 14, 22, 0.78)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
  backdropFilter: "blur(10px)",
};

export const LogoBadge: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const enter = useEntrance();
  const exit = useExit();
  return (
    <div style={{ position: "absolute", top: vertical ? 240 : 64, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: exit }}>
      <div
        style={{
          ...glass,
          display: "flex",
          alignItems: "center",
          gap: 22,
          padding: "18px 36px 18px 18px",
          borderRadius: 999,
          transform: `translateY(${(1 - enter) * -80}px) scale(${0.7 + 0.3 * enter})`,
          opacity: enter,
        }}
      >
        <Img src={staticFile("icon.png")} style={{ width: 76, height: 76, borderRadius: 18 }} />
        <span style={{ fontFamily: "Poppins", fontWeight: 800, fontSize: 52, color: "#fff", letterSpacing: -1 }}>Spell Tracker</span>
      </div>
    </div>
  );
};

/** The Share key being pressed, `pressAt` frames in. */
export const KeyCap: React.FC<{ vertical: boolean; pressAt: number }> = ({ vertical, pressAt }) => {
  const frame = useCurrentFrame();
  const enter = useEntrance();
  const exit = useExit();
  const press = interpolate(frame, [pressAt, pressAt + 3, pressAt + 8], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: vertical ? 300 : 110,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        opacity: enter * exit,
        transform: `scale(${0.6 + 0.4 * enter})`,
      }}
    >
      <div
        style={{
          width: 170,
          height: 170,
          borderRadius: 30,
          background: "linear-gradient(#f4f6fa, #c9d0dc)",
          boxShadow: `0 ${14 - 10 * press}px 0 #8a93a3, 0 ${30 - 16 * press}px 40px rgba(0,0,0,0.5)`,
          transform: `translateY(${10 * press}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Consolas, monospace",
          fontWeight: 700,
          fontSize: 76,
          lineHeight: 0.9,
          color: BRAND.ink,
        }}
      >
        <span>{SHARE_KEY.shifted}</span>
        <span>{SHARE_KEY.key}</span>
      </div>
      <span style={{ ...glass, fontFamily: "Poppins", fontWeight: 600, fontSize: 30, color: "#fff", padding: "8px 22px", borderRadius: 999 }}>Share key</span>
    </div>
  );
};

/** The Share Line typing out in team chat, over `typeFrames` frames. */
export const ShareChip: React.FC<{ vertical: boolean; typeFrames: number }> = ({ vertical, typeFrames }) => {
  const frame = useCurrentFrame();
  const enter = useEntrance();
  const exit = useExit();
  const typed = SHARE_LINE.slice(0, Math.ceil(interpolate(frame, [3, typeFrames], [0, SHARE_LINE.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  return (
    <div style={{ position: "absolute", top: vertical ? 330 : 120, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: enter * exit }}>
      <div
        style={{
          ...glass,
          padding: vertical ? "26px 34px" : "22px 34px",
          borderRadius: 22,
          border: `2px solid ${BRAND.blue}`,
          fontFamily: "Poppins",
          fontWeight: 600,
          fontSize: vertical ? 50 : 54,
          color: "#fff",
          transform: `translateY(${(1 - enter) * 40}px)`,
        }}
      >
        <span style={{ color: "#5bc0ff" }}>[Team] You: </span>
        <span style={{ fontFamily: "Consolas, monospace", fontWeight: 700 }}>{typed}</span>
        <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1, color: BRAND.flash }}>▌</span>
      </div>
    </div>
  );
};
