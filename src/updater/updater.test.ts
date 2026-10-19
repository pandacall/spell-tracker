import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHECK_INTERVAL_MS, FIRST_CHECK_DELAY_MS, startUpdates, type UpdateSource } from "./updater";

function fakeSource() {
  const listeners: { downloaded?: () => void } = {};
  const source = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checks: 0,
    installs: [] as Array<{ isSilent?: boolean; isForceRunAfter?: boolean }>,
    on(event: "update-downloaded" | "error", listener: (...args: never[]) => void) {
      if (event === "update-downloaded") listeners.downloaded = listener as () => void;
      return source;
    },
    async checkForUpdates() {
      source.checks++;
      return null;
    },
    quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean) {
      source.installs.push({ isSilent, isForceRunAfter });
    },
    finishDownload: () => listeners.downloaded?.(),
  };
  return source satisfies UpdateSource;
}

function setup(options: { gameRunning?: boolean } = {}) {
  const source = fakeSource();
  const state = { gameRunning: options.gameRunning ?? false };
  const offers: Array<(() => void) | undefined> = [];
  const announcements: number[] = [];
  const updates = startUpdates({
    source,
    isGameRunning: () => state.gameRunning,
    offerRestart: (restart) => offers.push(restart),
    announce: () => announcements.push(1),
  });
  return { source, state, offers, announcements, updates };
}

describe("Updates", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("downloads in the background and installs when the app quits", () => {
    const { source } = setup();

    expect(source.autoDownload).toBe(true);
    expect(source.autoInstallOnAppQuit).toBe(true);
  });

  it("checks shortly after startup, then every few hours", () => {
    const { source } = setup();

    expect(source.checks).toBe(0);
    vi.advanceTimersByTime(FIRST_CHECK_DELAY_MS);
    expect(source.checks).toBe(1);
    vi.advanceTimersByTime(CHECK_INTERVAL_MS);
    expect(source.checks).toBe(2);
  });

  it("holds a check that falls during a game until the game ends", () => {
    const { source, state, updates } = setup({ gameRunning: true });

    vi.advanceTimersByTime(FIRST_CHECK_DELAY_MS + CHECK_INTERVAL_MS);
    expect(source.checks).toBe(0);

    state.gameRunning = false;
    updates.gameEnded();
    expect(source.checks).toBe(1);
  });

  it("checks nothing extra when a game ends with no check due", () => {
    const { source, state, updates } = setup();

    vi.advanceTimersByTime(FIRST_CHECK_DELAY_MS);
    state.gameRunning = true;
    updates.gameStarted();
    state.gameRunning = false;
    updates.gameEnded();

    expect(source.checks).toBe(1);
  });

  it("offers Restart to update and announces it once a download finishes outside a game", () => {
    const { source, offers, announcements } = setup();

    source.finishDownload();

    expect(offers).toHaveLength(1);
    expect(offers[0]).toBeTypeOf("function");
    expect(announcements).toHaveLength(1);
  });

  it("waits for the game to end before offering or announcing an update downloaded mid-game", () => {
    const { source, state, offers, announcements, updates } = setup({ gameRunning: true });

    source.finishDownload();
    expect(offers.filter(Boolean)).toEqual([]);
    expect(announcements).toEqual([]);

    state.gameRunning = false;
    updates.gameEnded();
    expect(offers.at(-1)).toBeTypeOf("function");
    expect(announcements).toHaveLength(1);
  });

  it("withdraws Restart to update while a game is on and brings it back after, announcing only once", () => {
    const { source, state, offers, announcements, updates } = setup();
    source.finishDownload();

    state.gameRunning = true;
    updates.gameStarted();
    expect(offers.at(-1)).toBeUndefined();

    state.gameRunning = false;
    updates.gameEnded();
    expect(offers.at(-1)).toBeTypeOf("function");
    expect(announcements).toHaveLength(1);
  });

  it("restarts silently into the new version when Restart to update is chosen", () => {
    const { source, offers } = setup();
    source.finishDownload();

    offers[0]!();

    expect(source.installs).toEqual([{ isSilent: true, isForceRunAfter: true }]);
  });

  it("never restarts during a game, even from a stale Restart to update", () => {
    const { source, state, offers } = setup();
    source.finishDownload();

    state.gameRunning = true;
    offers[0]!();

    expect(source.installs).toEqual([]);
  });

  it("stays quiet when a check fails", async () => {
    const { source } = setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    source.checkForUpdates = async () => {
      throw new Error("offline");
    };

    vi.advanceTimersByTime(FIRST_CHECK_DELAY_MS);
    await vi.runOnlyPendingTimersAsync();

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("stops checking once stopped", () => {
    const { source, updates } = setup();

    updates.stop();
    vi.advanceTimersByTime(FIRST_CHECK_DELAY_MS + CHECK_INTERVAL_MS);

    expect(source.checks).toBe(0);
  });
});
