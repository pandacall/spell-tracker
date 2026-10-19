import fs from "node:fs";
import path from "node:path";
import { fetchSnapshot } from "../game-feed/live-client";
import { scrubSnapshot } from "./scrub";

// Usage: npm run capture -- <fixture-name>
// Saves the current game's raw snapshot to fixtures/<fixture-name>.json with
// player identities scrubbed (fixtures are committed to a public repo).
async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name || !/^[\w-]+$/.test(name)) {
    console.error("Usage: npm run capture -- <fixture-name>");
    process.exitCode = 1;
    return;
  }
  const snapshot = await fetchSnapshot();
  if (snapshot === null) {
    console.error("No game found on 127.0.0.1:2999. Start a game (or Practice Tool) first.");
    process.exitCode = 1;
    return;
  }
  const directory = path.resolve(__dirname, "..", "..", "fixtures");
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(scrubSnapshot(snapshot), null, 2) + "\n");
  console.log(`Saved ${file}`);
}

void main();
