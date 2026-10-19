import type { ChatSender } from "../chat-sender/chat-sender";

export interface Share {
  /** Handle one press of the Share key. */
  press(): Promise<void>;
}

export function createShare(deps: {
  /** Whether to press Enter after typing; read at each press so a change applies at once. */
  autoSend(): boolean;
  sender: ChatSender;
  /** The current Share Line; empty when no Flash is down. */
  shareLine(): string;
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
      if (busy || !deps.isGameRunning()) return;
      const line = deps.shareLine();
      if (line === "") return;
      busy = true;
      try {
        // The still-held key would otherwise reach the game or its chat box.
        await deps.keyReleased();
        await deps.sender.send(line, { submit: deps.autoSend() });
      } finally {
        busy = false;
      }
    },
  };
}
