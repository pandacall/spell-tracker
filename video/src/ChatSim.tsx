// League's chat box doing a Share inside a 1920x1080 stage: the Share key opens
// chat, the Share Line types in, then Enter sends it to the log.
import { interpolate } from "remotion";

/** Where new chat lines land, below the game's own chat log. */
const CHAT = { left: 64, top: 818, width: 500 };

const text: React.CSSProperties = {
  font: "17px/1.25 Arial, sans-serif",
  color: "#f0e6d2",
  textShadow: "0 0 3px #000, 0 0 2px #000",
};

export interface ChatTimes {
  /** Scene seconds when the Share key opens chat. */
  open: number;
  typeFrom: number;
  typeTo: number;
  /** Scene seconds when Enter sends the line. */
  send: number;
}

export const ChatSim: React.FC<{ line: string; sender: string; times: ChatTimes; t: number }> = ({ line, sender, times, t }) => {
  if (t < times.open) return null;
  if (t >= times.send) {
    return (
      <div style={{ position: "absolute", left: CHAT.left, top: CHAT.top + 4, width: CHAT.width, ...text }}>
        <span style={{ color: "#4fc3ff" }}>[Team] {sender}: </span>
        {line}
      </div>
    );
  }
  const typed = line.slice(0, Math.round(interpolate(t, [times.typeFrom, times.typeTo], [0, line.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
  return (
    <div
      style={{
        position: "absolute",
        left: CHAT.left - 6,
        top: CHAT.top,
        width: CHAT.width,
        padding: "4px 6px",
        background: "rgba(1, 10, 19, 0.82)",
        border: "1px solid #785a28",
        ...text,
      }}
    >
      <span style={{ color: "#4fc3ff" }}>[Team] </span>
      {typed}
      <span style={{ opacity: Math.floor(t * 2.5) % 2 ? 0 : 1 }}>|</span>
    </div>
  );
};
