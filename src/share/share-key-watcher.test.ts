import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createShareKeyWatcher } from "./share-key-watcher";

const VK = { F8: 0x77, F9: 0x78 } as const;

function setup() {
  const watches: Array<{ key: number; stopped: boolean }> = [];
  const pressed: string[] = [];
  const watcher = createShareKeyWatcher({
    resolve: (shareKey) => (shareKey in VK ? VK[shareKey as keyof typeof VK] : undefined),
    watch: (key) => {
      const entry = { key, stopped: false };
      watches.push(entry);
      return () => {
        entry.stopped = true;
      };
    },
    onPress: () => void pressed.push("press"),
  });
  return { watcher, watches, pressed };
}

describe("Share key watcher", () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => errorLog.mockRestore());

  it("watches the Share key when a game starts", () => {
    const { watcher, watches } = setup();

    watcher.start("F8");

    expect(watches).toEqual([{ key: VK.F8, stopped: false }]);
    expect(watcher.virtualKey()).toBe(VK.F8);
  });

  it("switches to a changed Share key at once while a game is on", () => {
    const { watcher, watches } = setup();

    watcher.start("F8");
    watcher.change("F9");

    expect(watches).toEqual([
      { key: VK.F8, stopped: true },
      { key: VK.F9, stopped: false },
    ]);
    expect(watcher.virtualKey()).toBe(VK.F9);
  });

  it("does not watch a changed key before a game starts, then watches it when one does", () => {
    const { watcher, watches } = setup();

    watcher.change("F9");
    expect(watches).toEqual([]);

    watcher.start("F9");
    expect(watches).toEqual([{ key: VK.F9, stopped: false }]);
  });

  it("does not watch a changed key after the game ends", () => {
    const { watcher, watches } = setup();

    watcher.start("F8");
    watcher.stop();
    watcher.change("F9");

    expect(watches).toEqual([{ key: VK.F8, stopped: true }]);
  });

  it("watches nothing for an unusable key, reports no virtual key and says so", () => {
    const { watcher, watches } = setup();

    watcher.start("nope");

    expect(watches).toEqual([]);
    expect(watcher.virtualKey()).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith('Unsupported Share key "nope": use a single character or F1-F24.');
  });

  it("recovers when a changed key is usable again while a game is on", () => {
    const { watcher, watches } = setup();

    watcher.start("nope");
    watcher.change("F9");

    expect(watches).toEqual([{ key: VK.F9, stopped: false }]);
  });

  it("stops watching an old key when the changed one is unusable", () => {
    const { watcher, watches } = setup();

    watcher.start("F8");
    watcher.change("nope");

    expect(watches).toEqual([{ key: VK.F8, stopped: true }]);
    expect(watcher.virtualKey()).toBeUndefined();
  });

  it("stops watching when the game ends", () => {
    const { watcher, watches } = setup();

    watcher.start("F8");
    watcher.stop();

    expect(watches[0].stopped).toBe(true);
    expect(watcher.virtualKey()).toBeUndefined();
  });

  it("reports each press of the watched key", () => {
    const pressedKeys: number[] = [];
    let trigger = () => {};
    const watcher = createShareKeyWatcher({
      resolve: () => VK.F8,
      watch: (key, onPress) => {
        pressedKeys.push(key);
        trigger = onPress;
        return () => {};
      },
      onPress: () => pressedKeys.push(-1),
    });

    watcher.start("F8");
    trigger();

    expect(pressedKeys).toEqual([VK.F8, -1]);
  });
});
