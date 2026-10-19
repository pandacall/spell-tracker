// Finds the recorded clips (public/clips/A.mp4 ... F.mp4) and an optional music
// track (any file in public/music/), remuxes OBS .mkv recordings to .mp4, and
// writes src/generated/assets.json so the edit uses real footage where it exists
// and placeholders everywhere else.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const clipsDir = join(root, "public", "clips");
const musicDir = join(root, "public", "music");
const CLIP_IDS = ["A", "B", "C", "D", "E", "F"];
const VIDEO = [".mp4", ".mov", ".webm"];
const AUDIO = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];

mkdirSync(clipsDir, { recursive: true });
mkdirSync(musicDir, { recursive: true });

function filesIn(dir) {
  return readdirSync(dir).filter((name) => !name.startsWith("."));
}

function durationOf(path) {
  try {
    const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
    return Number.parseFloat(out.trim()) || null;
  } catch {
    return null;
  }
}

// OBS records .mkv by default, which the renderer can't seek reliably; copy the streams into .mp4.
for (const name of filesIn(clipsDir)) {
  const id = name.slice(0, -extname(name).length).toUpperCase();
  const mp4 = join(clipsDir, `${id}.mp4`);
  if (extname(name).toLowerCase() === ".mkv" && CLIP_IDS.includes(id) && !existsSync(mp4)) {
    console.log(`Remuxing ${name} -> ${id}.mp4`);
    execFileSync("ffmpeg", ["-v", "error", "-i", join(clipsDir, name), "-c", "copy", "-movflags", "+faststart", mp4], { stdio: "inherit" });
  }
}

const clips = {};
for (const id of CLIP_IDS) {
  const name = filesIn(clipsDir).find((file) => file.slice(0, -extname(file).length).toUpperCase() === id && VIDEO.includes(extname(file).toLowerCase()));
  clips[id] = name ? { src: `clips/${name}`, duration: durationOf(join(clipsDir, name)) } : null;
}

const musicName = filesIn(musicDir).find((file) => AUDIO.includes(extname(file).toLowerCase()));
const assets = { clips, music: musicName ? `music/${musicName}` : null };

mkdirSync(join(root, "src", "generated"), { recursive: true });
writeFileSync(join(root, "src", "generated", "assets.json"), JSON.stringify(assets, null, 2) + "\n");

for (const id of CLIP_IDS) {
  const clip = clips[id];
  console.log(`  clip ${id}: ${clip ? `${clip.src}${clip.duration ? ` (${clip.duration.toFixed(1)}s)` : ""}` : "placeholder"}`);
}
console.log(`  music: ${assets.music ?? "none"}`);
