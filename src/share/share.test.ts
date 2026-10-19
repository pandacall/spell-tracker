import { describe, expect, it } from "vitest";
import { createShare } from "./share";

function setup(options: { gameRunning?: boolean; autoSend?: boolean; shareLine?: string } = {}) {
  const sent: Array<{ message: string; submit: boolean }> = [];
  const state = { gameRunning: options.gameRunning ?? true, shareLine: options.shareLine ?? "1230 mid 1440 bot" };
  const share = createShare({
    settings: { shareKey: "`", autoSend: options.autoSend ?? true },
    sender: { send: async (message, { submit }) => void sent.push({ message, submit }) },
    shareLine: () => state.shareLine,
    isGameRunning: () => state.gameRunning,
    keyReleased: async () => {},
  });
  return { share, sent, state };
}

describe("Share", () => {
  it("types the Share Line into chat and presses Enter to send it when auto-send is on", async () => {
    const { share, sent } = setup({ autoSend: true });

    await share.press();

    expect(sent).toEqual([{ message: "1230 mid 1440 bot", submit: true }]);
  });

  it("types the Share Line into chat but leaves it unsent when auto-send is off", async () => {
    const { share, sent } = setup({ autoSend: false });

    await share.press();

    expect(sent).toEqual([{ message: "1230 mid 1440 bot", submit: false }]);
  });

  it.each([true, false])("does nothing when no Flash is down (auto-send %s)", async (autoSend) => {
    const { share, sent } = setup({ autoSend, shareLine: "" });

    await share.press();

    expect(sent).toEqual([]);
  });

  it.each([true, false])("does nothing when no game is running (auto-send %s)", async (autoSend) => {
    const { share, sent } = setup({ autoSend, gameRunning: false });

    await share.press();

    expect(sent).toEqual([]);
  });

  it("sends the Share Line as it is at the moment of the press", async () => {
    const { share, sent, state } = setup();

    state.shareLine = "1230 mid";
    await share.press();
    state.shareLine = "1440 bot";
    await share.press();

    expect(sent.map(({ message }) => message)).toEqual(["1230 mid", "1440 bot"]);
  });

  it("sends one message per press even if the key repeats while it is being typed", async () => {
    const sent: string[] = [];
    let finishTyping = () => {};
    const share = createShare({
      settings: { shareKey: "`", autoSend: true },
      sender: {
        send: (message) => {
          sent.push(message);
          return new Promise<void>((resolve) => (finishTyping = resolve));
        },
      },
      shareLine: () => "1230 mid",
      isGameRunning: () => true,
      keyReleased: async () => {},
    });

    const first = share.press();
    await share.press();
    await share.press();
    finishTyping();
    await first;

    expect(sent).toEqual(["1230 mid"]);
  });

  it("sends again on the next press once the previous message is done", async () => {
    const { share, sent } = setup();

    await share.press();
    await share.press();

    expect(sent).toHaveLength(2);
  });

  it("waits for the Share key to be released before typing", async () => {
    const sent: string[] = [];
    let release = () => {};
    const share = createShare({
      settings: { shareKey: "`", autoSend: true },
      sender: { send: async (message) => void sent.push(message) },
      shareLine: () => "1230 mid",
      isGameRunning: () => true,
      keyReleased: () => new Promise<void>((resolve) => (release = resolve)),
    });

    const pressed = share.press();
    await Promise.resolve();
    expect(sent).toEqual([]);

    release();
    await pressed;
    expect(sent).toEqual(["1230 mid"]);
  });
});
