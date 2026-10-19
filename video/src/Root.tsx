import { Composition } from "remotion";
import { FPS } from "./timeline";
import { DURATION, SpellTrackerVideo } from "./Video";

export const Root: React.FC = () => (
  <>
    <Composition id="Landscape" component={SpellTrackerVideo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ vertical: false }} />
    <Composition id="Vertical" component={SpellTrackerVideo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ vertical: true }} />
  </>
);
