import type { ChatSender } from "../chat-sender/chat-sender";
import type { Settings } from "../settings/settings";

/** Stands in for the Share Line until it exists, to prove the Chat Sender works in game. */
export const TEST_MESSAGE = "spell tracker test";

export interface Share {
  /** Handle one press of the Share key. */
  press(): Promise<void>;
}

export function createShare(deps: {
  settings: Settings;
  sender: ChatSender;
  isGameRunning(): boolean;
  /** Resolves once the Share key is physically up. */
  keyReleased(): Promise<void>;
}): Share {
  // Holding the key makes the OS repeat it. Presses that arrive while a message
  // is still on its way are the same press, not new ones; once it is done the
  // next press sends again, with no lockout (ADR 0001).
  let busy = false;

  return {
    async press() {
      if (busy || !deps.isGameRunning() || !deps.settings.autoSend) return;
      busy = true;
      try {
        // The still-held key would otherwise reach the game or its chat box.
        await deps.keyReleased();
        await deps.sender.send(TEST_MESSAGE);
      } finally {
        busy = false;
      }
    },
  };
}
