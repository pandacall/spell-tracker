// Runs scripts/voice.py with the project's virtualenv Python, passing any arguments through.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const python = process.platform === "win32" ? ".venv/Scripts/python.exe" : ".venv/bin/python";

if (!existsSync(new URL(`../${python}`, import.meta.url))) {
  console.error("No virtualenv yet. Run: python -m venv .venv, then .venv's pip install edge-tts");
  process.exit(1);
}

const result = spawnSync(python, ["scripts/voice.py", ...process.argv.slice(2)], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
