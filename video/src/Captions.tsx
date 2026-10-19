import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, CAPTION_TEXT } from "./edit";
import { captionLines, FPS, toFrames, type Word } from "./timeline";

/** Word-by-word captions: each short line pops in, and the word being spoken lights up. */
export const Captions: React.FC<{ words: Word[]; vertical: boolean }> = ({ words, vertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / FPS;
  const lines = captionLines(words);
  const index = lines.findLastIndex((line) => line[0].start <= t);
  if (index === -1) return null;
  const line = lines[index];
  const lineEnd = lines[index + 1]?.[0].start ?? line[line.length - 1].end + 0.5;
  if (t >= lineEnd) return null;

  const pop = spring({ frame: frame - toFrames(line[0].start), fps, config: { damping: 14, stiffness: 220 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        ...(vertical ? { top: 1240 } : { bottom: 96 }),
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 0.42em",
        fontFamily: "Poppins",
        fontWeight: 800,
        fontSize: vertical ? 84 : 68,
        lineHeight: 1.15,
        textTransform: "uppercase",
        transform: `scale(${0.82 + 0.18 * pop})`,
        opacity: Math.min(1, pop * 1.5),
      }}
    >
      {line.map((word) => {
        const spoken = word.start <= t;
        const speaking = spoken && t < word.end + 0.05;
        return (
          <span
            key={word.start}
            style={{
              color: speaking ? BRAND.flash : "#fff",
              opacity: spoken ? 1 : 0.55,
              WebkitTextStroke: `${vertical ? 10 : 8}px ${BRAND.ink}`,
              paintOrder: "stroke fill",
              textShadow: "0 6px 18px rgba(0,0,0,0.45)",
              display: "inline-block",
              transform: speaking ? "scale(1.08)" : undefined,
            }}
          >
            {CAPTION_TEXT[word.text.toLowerCase()] ?? word.text}
          </span>
        );
      })}
    </div>
  );
};
