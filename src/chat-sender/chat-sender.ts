/** Software-simulated key presses, one key event at a time (see ADR 0001). */
export interface Keyboard {
  enter(down: boolean): void;
  /** One UTF-16 code unit, typed as a Unicode character rather than a key. */
  character(codeUnit: number, down: boolean): void;
}

export interface ChatSender {
  send(message: string): Promise<void>;
}

// League polls input once per frame, so a key released too quickly is missed.
const HOLD_MS = 30;
const GAP_BETWEEN_CHARACTERS_MS = 10;
const CHAT_BOX_OPEN_MS = 120;

export function createChatSender(deps: {
  keyboard: Keyboard;
  sleep(ms: number): Promise<void>;
}): ChatSender {
  const { keyboard, sleep } = deps;

  async function tap(key: (down: boolean) => void, pauseAfterMs: number): Promise<void> {
    key(true);
    await sleep(HOLD_MS);
    key(false);
    await sleep(pauseAfterMs);
  }

  return {
    async send(message) {
      await tap((down) => keyboard.enter(down), CHAT_BOX_OPEN_MS);
      for (let index = 0; index < message.length; index++) {
        const codeUnit = message.charCodeAt(index);
        await tap((down) => keyboard.character(codeUnit, down), GAP_BETWEEN_CHARACTERS_MS);
      }
      await tap((down) => keyboard.enter(down), 0);
    },
  };
}
