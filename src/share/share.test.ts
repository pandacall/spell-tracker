import { describe, expect, it } from "vitest";
import { createShare, TEST_MESSAGE } from "./share";

function setup(options: { gameRunning?: boolean; autoSend?: boolean } = {}) {
  const sent: string[] = [];
  const state = { gameRunning: options.gameRunning ?? true };
  const share = createShare({
    settings: { shareKey: "`", autoSend: options.autoSend ?? true },
    sender: { send: async (message) => void sent.push(message) },
    isGameRunning: () => state.gameRunning,
    keyReleased: async () => {},
  });
  return { share, sent, state };
}

describe("Share", () => {
  it("sends the test message to chat when the Share key is pressed in a game", async () => {
    const { share, sent } = setup();

    await share.press();

    expect(sent).toEqual([TEST_MESSAGE]);
  });

  it("does nothing when no game is running", async () => {
    const { share, sent } = setup({ gameRunning: false });

    await share.press();

    expect(sent).toEqual([]);
  });

  it("does not type anything when auto-send is off", async () => {
    const { share, sent } = setup({ autoSend: false });

    await share.press();

    expect(sent).toEqual([]);
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
      isGameRunning: () => true,
      keyReleased: async () => {},
    });

    const first = share.press();
    await share.press();
    await share.press();
    finishTyping();
    await first;

    expect(sent).toEqual([TEST_MESSAGE]);
  });

  it("sends again on the next press once the previous message is done", async () => {
    const { share, sent } = setup();

    await share.press();
    await share.press();

    expect(sent).toEqual([TEST_MESSAGE, TEST_MESSAGE]);
  });

  it("waits for the Share key to be released before typing", async () => {
    const sent: string[] = [];
    let release = () => {};
    const share = createShare({
      settings: { shareKey: "`", autoSend: true },
      sender: { send: async (message) => void sent.push(message) },
      isGameRunning: () => true,
      keyReleased: () => new Promise<void>((resolve) => (release = resolve)),
    });

    const pressed = share.press();
    await Promise.resolve();
    expect(sent).toEqual([]);

    release();
    await pressed;
    expect(sent).toEqual([TEST_MESSAGE]);
  });
});
