import { fetchSnapshot } from "./live-client";

const POLL_INTERVAL_MS = 1000;

/**
 * Polls the Live Client Data API about once a second and hands each raw
 * snapshot (or null when no game is running) to `onSnapshot`. The next poll is
 * only scheduled once the previous one has settled, so polls never overlap.
 * Returns a function that stops polling.
 */
export function startGameFeed(onSnapshot: (snapshot: unknown | null) => void): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  const poll = async () => {
    try {
      const snapshot = await fetchSnapshot();
      if (stopped) return;
      onSnapshot(snapshot);
    } catch (error) {
      console.error("Game feed handler failed:", error);
    }
    if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
  };
  void poll();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
