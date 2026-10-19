// Cuts the clips listed in footage.json out of the downloaded source video into
// public/clips/<letter>.mp4. Existing clips are kept unless --force is passed.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const footage = JSON.parse(readFileSync(join(root, "footage.json"), "utf8"));
const source = join(root, footage.source);
const force = process.argv.includes("--force");

if (!existsSync(source)) {
  console.error(`No source video at ${footage.source}. Download it first (see README).`);
  process.exit(1);
}

mkdirSync(join(root, "public", "clips"), { recursive: true });
for (const [id, { start, length }] of Object.entries(footage.clips)) {
  const out = join(root, "public", "clips", `${id}.mp4`);
  if (existsSync(out) && !force) {
    console.log(`  clip ${id}: kept`);
    continue;
  }
  execFileSync(
    "ffmpeg",
    ["-v", "error", "-y", "-ss", String(start), "-i", source, "-t", String(length), "-c:v", "libx264", "-crf", "16", "-preset", "fast", "-c:a", "aac", "-movflags", "+faststart", out],
    { stdio: "inherit" },
  );
  console.log(`  clip ${id}: ${start}s +${length}s`);
}
