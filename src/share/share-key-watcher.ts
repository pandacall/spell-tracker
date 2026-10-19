export interface ShareKeyWatcher {
  /** A game started: watch the Share key. Logs and watches nothing if the key is unusable. */
  start(shareKey: string): void;
  /** The Share key setting changed: switch to it now, but only while a game is on. */
  change(shareKey: string): void;
  /** The game ended: stop watching. */
  stop(): void;
  /** The key code being watched, or undefined when nothing is. */
  virtualKey(): number | undefined;
}

export function createShareKeyWatcher(deps: {
  resolve(shareKey: string): number | undefined;
  watch(virtualKey: number, onPress: () => void): () => void;
  onPress(): void;
}): ShareKeyWatcher {
  let started = false;
  let watched: { virtualKey: number; unwatch: () => void } | undefined;

  const unwatch = () => {
    watched?.unwatch();
    watched = undefined;
  };

  const watchKey = (shareKey: string) => {
    unwatch();
    const virtualKey = deps.resolve(shareKey);
    if (virtualKey === undefined) {
      console.error(`Unsupported Share key "${shareKey}": this key cannot be watched, so pick another in Settings.`);
      return;
    }
    watched = { virtualKey, unwatch: deps.watch(virtualKey, deps.onPress) };
  };

  return {
    start(shareKey) {
      started = true;
      watchKey(shareKey);
    },
    change(shareKey) {
      if (started) watchKey(shareKey);
    },
    stop() {
      started = false;
      unwatch();
    },
    virtualKey: () => watched?.virtualKey,
  };
}
