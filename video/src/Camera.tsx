import type { ReactNode } from "react";
import { Easing, interpolate } from "remotion";
import type { CameraKey } from "./edit";

/** Size of the recorded frame the camera moves over. */
export const STAGE = { width: 1920, height: 1080 };

function keyAt(keys: CameraKey[], t: number): Omit<CameraKey, "at" | "vzoom" | "vx"> {
  if (t <= keys[0].at) return keys[0];
  const next = keys.findIndex((key) => key.at > t);
  if (next === -1) return keys[keys.length - 1];
  const from = keys[next - 1];
  const to = keys[next];
  const progress = interpolate(t, [from.at, to.at], [0, 1], { easing: Easing.inOut(Easing.cubic) });
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    zoom: from.zoom + (to.zoom - from.zoom) * progress,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Vertical crops are already tight, so they zoom less unless a key says otherwise. */
const VERTICAL_ZOOM = 0.75;
/** How far down the output the camera's point lands, leaving room for captions below. */
const ANCHOR_Y = { landscape: 0.44, vertical: 0.36 };

/**
 * Frames a 1920x1080 stage inside a width x height output, following the
 * camera keys: zoom 1 covers the output, and the view never leaves the stage.
 */
export const Camera: React.FC<{ keys: CameraKey[]; t: number; width: number; height: number; children: ReactNode }> = ({
  keys,
  t,
  width,
  height,
  children,
}) => {
  const vertical = height > width;
  const framed = vertical ? keys.map((key) => ({ ...key, x: key.vx ?? key.x, zoom: key.vzoom ?? key.zoom * VERTICAL_ZOOM })) : keys;
  const { x, y, zoom } = keyAt(framed, t);
  const scale = Math.max(width / STAGE.width, height / STAGE.height) * Math.max(1, zoom);
  const anchorY = vertical ? ANCHOR_Y.vertical : ANCHOR_Y.landscape;
  const left = clamp(width / 2 - x * STAGE.width * scale, width - STAGE.width * scale, 0);
  const top = clamp(height * anchorY - y * STAGE.height * scale, height - STAGE.height * scale, 0);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          width: STAGE.width,
          height: STAGE.height,
          transformOrigin: "0 0",
          transform: `translate(${left}px, ${top}px) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};
