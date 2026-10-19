import https from "node:https";

const HOST = "127.0.0.1";
// Overridable only so the app can be smoke-tested against a fake feed.
const PORT = Number(process.env.SPELL_TRACKER_FEED_PORT) || 2999;
const ALL_GAME_DATA_PATH = "/liveclientdata/allgamedata";
const REQUEST_TIMEOUT_MS = 2000;

// The Live Client Data API serves a self-signed certificate. Certificate
// checking is disabled for this agent only, and requests can only ever go to
// the loopback address pinned above.
const agent = new https.Agent({ rejectUnauthorized: false });

/**
 * Fetches one raw snapshot from the Live Client Data API, exactly as League
 * returns it. Resolves to null when there is no game to read (connection
 * refused, timeout, or anything else going wrong): no game is not an error.
 */
export function fetchSnapshot(): Promise<unknown | null> {
  return new Promise((resolve) => {
    const request = https.get(
      { host: HOST, port: PORT, path: ALL_GAME_DATA_PATH, agent, timeout: REQUEST_TIMEOUT_MS },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve(null);
          return;
        }
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            resolve(null);
          }
        });
        response.on("error", () => resolve(null));
      },
    );
    request.on("timeout", () => request.destroy());
    request.on("error", () => resolve(null));
  });
}
