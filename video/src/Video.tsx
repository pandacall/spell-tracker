import { loadFont } from "@remotion/google-fonts/Poppins";
import { AbsoluteFill, Audio, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import footage from "../footage.json";
import assets from "./generated/assets.json";
import { Camera } from "./Camera";
import { ChatSim, type ChatTimes } from "./ChatSim";
import { Captions } from "./Captions";
import { KeyCap, LogoBadge, ShareChip } from "./Callouts";
import { CLICKS, CLIP_LABELS, ENEMIES, MARKS, OUTRO_PHRASE, SCENES, SHARE_LINE, SHARE_SENDER, type Scene } from "./edit";
import { GameOverlay } from "./GameOverlay";
import { Outro } from "./Outro";
import { Placeholder } from "./Placeholder";
import { findPhrase, FPS, timeOf, toFrames, VOICE_END, WORDS } from "./timeline";

loadFont("normal", { weights: ["600", "800"], subsets: ["latin"] });

interface Clip {
  src: string;
  duration: number | null;
}
const CLIPS = assets.clips as Record<string, Clip | null>;

/** Seconds the end card holds after the voice finishes. */
const END_HOLD = 1.8;
export const DURATION = toFrames(VOICE_END + END_HOLD);

// Scene cuts land just before the first word of each scene's phrase.
const CUT_LEAD = 0.06;
let searchFrom = 0;
const cuts = SCENES.map((scene) => {
  const word = findPhrase(scene.phrase, searchFrom);
  searchFrom = word + 1;
  return Math.max(0, toFrames(WORDS[word].start - CUT_LEAD));
});
const outroWord = findPhrase(OUTRO_PHRASE, searchFrom);
const OUTRO_START = toFrames(WORDS[outroWord].start - CUT_LEAD);
/** First frame of the scene showing `clip`. */
const cutOf = (clip: Scene["clip"]) => cuts[SCENES.findIndex((scene) => scene.clip === clip)];
/** First frame after the scene showing `clip`. */
const cutAfter = (clip: Scene["clip"]) => cuts[SCENES.findIndex((scene) => scene.clip === clip) + 1] ?? OUTRO_START;

/** Where each clip starts in the source video, to put the overlay on the game clock. */
const CLIP_STARTS = footage.clips as Record<string, { start: number }>;

const SceneShot: React.FC<{ scene: Scene; vertical: boolean; first: boolean; chat?: ChatTimes }> = ({ scene, vertical, first, chat }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / FPS;
  const clip = CLIPS[scene.clip];
  const gameTime = CLIP_STARTS[scene.clip].start + footage.gameClockOffset + scene.trim + t;
  // A quick punch-in and white flash on every cut after the first.
  const punch = first ? 0 : interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });

  let shot: React.ReactNode = <Placeholder clip={scene.clip} t={t} />;
  if (clip) {
    const video = <OffthreadVideo src={staticFile(clip.src)} startFrom={toFrames(scene.trim)} volume={0.3} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
    // Hold the last frame if the recording is shorter than the scene.
    const lastFrame = clip.duration ? toFrames(clip.duration - scene.trim) - 2 : Infinity;
    shot = frame > lastFrame ? <Freeze frame={lastFrame}>{video}</Freeze> : video;
  }

  return (
    <AbsoluteFill style={{ transform: `scale(${1 + 0.06 * punch})` }}>
      <Camera keys={scene.camera} t={t} width={width} height={height}>
        {shot}
        <GameOverlay enemies={ENEMIES} marks={MARKS} clicks={CLICKS} gameTime={gameTime} />
        {chat && <ChatSim line={SHARE_LINE} sender={SHARE_SENDER} times={chat} t={t} />}
      </Camera>
      <AbsoluteFill style={{ background: "#fff", opacity: 0.35 * punch }} />
      {!clip && (
        <div
          style={{
            position: "absolute",
            top: vertical ? 120 : 24,
            left: 24,
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(255, 216, 74, 0.92)",
            color: "#111",
            font: "600 24px sans-serif",
          }}
        >
          Placeholder · Clip {scene.clip}: {CLIP_LABELS[scene.clip]}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const SpellTrackerVideo: React.FC<{ vertical: boolean }> = ({ vertical }) => {
  const keyWord = findPhrase("one key");
  const shareStart = toFrames(timeOf("twelve-thirty"));
  const shareEnd = toFrames(timeOf("fourteen-forty"));
  const badgeStart = toFrames(timeOf("spell tracker"));
  // The Share in the game's chat follows the voice: the key opens chat, the line
  // types in as it's mentioned, and Enter sends it while the timers are read out.
  const shareScene = cutOf("E") / FPS;
  const chat: ChatTimes = {
    open: WORDS[keyWord + 1].start - shareScene,
    typeFrom: timeOf("types") - shareScene,
    typeTo: timeOf("types") - shareScene + 0.5,
    send: timeOf("fourteen-forty") - shareScene,
  };

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SCENES.map((scene, index) => {
        const from = cuts[index];
        const to = cuts[index + 1] ?? OUTRO_START;
        return (
          <Sequence key={scene.clip} from={from} durationInFrames={to - from}>
            <SceneShot scene={scene} vertical={vertical} first={index === 0} chat={scene.clip === "E" ? chat : undefined} />
          </Sequence>
        );
      })}

      <Sequence from={badgeStart} durationInFrames={cutAfter("B") - badgeStart}>
        <LogoBadge vertical={vertical} />
      </Sequence>
      <Sequence from={toFrames(WORDS[keyWord].start) - 4} durationInFrames={toFrames(timeOf("types")) - toFrames(WORDS[keyWord].start) + 8}>
        <KeyCap vertical={vertical} pressAt={toFrames(WORDS[keyWord + 1].start - WORDS[keyWord].start) + 4} />
      </Sequence>
      <Sequence from={shareStart} durationInFrames={cutAfter("E") - shareStart}>
        <ShareChip vertical={vertical} typeFrames={shareEnd - shareStart} />
      </Sequence>

      <Sequence durationInFrames={OUTRO_START}>
        <Captions words={WORDS.slice(0, outroWord)} vertical={vertical} />
      </Sequence>

      <Sequence from={OUTRO_START}>
        <Outro vertical={vertical} taglineAt={toFrames(timeOf("stop", outroWord)) - OUTRO_START} />
      </Sequence>

      <Audio src={staticFile("voice/voiceover.mp3")} />
      {assets.music && (
        <Audio
          src={staticFile(assets.music)}
          volume={(frame) => interpolate(frame, [0, 10, DURATION - FPS, DURATION], [0, 0.14, 0.14, 0], { extrapolateRight: "clamp" })}
        />
      )}
    </AbsoluteFill>
  );
};
