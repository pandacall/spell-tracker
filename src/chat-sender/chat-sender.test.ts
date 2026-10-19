import { describe, expect, it } from "vitest";
import { createChatSender } from "./chat-sender";

// A fake keyboard and clock that record, in order, everything the Chat Sender does.
function fakes() {
  const log: string[] = [];
  return {
    log,
    keyboard: {
      enter: (down: boolean) => log.push(`enter ${down ? "down" : "up"}`),
      character: (codeUnit: number, down: boolean) =>
        log.push(`${String.fromCharCode(codeUnit)} ${down ? "down" : "up"}`),
    },
    sleep: async (ms: number) => {
      log.push(`wait ${ms > 0 ? "some" : "none"}`);
    },
  };
}

describe("Chat Sender", () => {
  it("presses Enter, types the message, and presses Enter again", async () => {
    const { log, keyboard, sleep } = fakes();

    await createChatSender({ keyboard, sleep }).send("hi");

    expect(log.filter((entry) => !entry.startsWith("wait"))).toEqual([
      "enter down",
      "enter up",
      "h down",
      "h up",
      "i down",
      "i up",
      "enter down",
      "enter up",
    ]);
  });

  it("holds every key down for a moment so the game registers it", async () => {
    const { log, keyboard, sleep } = fakes();

    await createChatSender({ keyboard, sleep }).send("hi");

    expect(log.slice(0, 4)).toEqual(["enter down", "wait some", "enter up", "wait some"]);
    expect(log.slice(4, 12)).toEqual([
      "h down",
      "wait some",
      "h up",
      "wait some",
      "i down",
      "wait some",
      "i up",
      "wait some",
    ]);
    expect(log.slice(12)).toEqual(["enter down", "wait some", "enter up", "wait none"]);
  });

  it("gives the chat box a moment to open before typing", async () => {
    const { log, keyboard, sleep } = fakes();

    await createChatSender({ keyboard, sleep }).send("hi");

    expect(log.slice(0, 4)).toEqual(["enter down", "wait some", "enter up", "wait some"]);
  });
});
