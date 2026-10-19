// koffi ships ESM-typed declarations but also a CommonJS entry, which is what
// this CommonJS build loads.
import type KoffiModule from "koffi" with { "resolution-mode": "import" };
import type { Keyboard } from "../chat-sender/chat-sender";

const koffi = require("koffi") as typeof KoffiModule;

// Win32 SendInput, the ordinary software route for simulated keys. No driver,
// no game memory, no hardware (ADR 0001).
const KEYBDINPUT = koffi.struct("KEYBDINPUT", {
  wVk: "uint16",
  wScan: "uint16",
  dwFlags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr_t",
});
// Unused, but INPUT's size is that of its largest member, which SendInput checks.
const MOUSEINPUT = koffi.struct("MOUSEINPUT", {
  dx: "int32",
  dy: "int32",
  mouseData: "uint32",
  dwFlags: "uint32",
  time: "uint32",
  dwExtraInfo: "uintptr_t",
});
const INPUT = koffi.struct("INPUT", {
  type: "uint32",
  u: koffi.union("INPUT_UNION", { ki: KEYBDINPUT, mi: MOUSEINPUT }),
});

const user32 = koffi.load("user32.dll");
const SendInput = user32.func("uint32 __stdcall SendInput(uint32 cInputs, INPUT *pInputs, int cbSize)");
const GetAsyncKeyState = user32.func("int16 __stdcall GetAsyncKeyState(int vKey)");
const VkKeyScanW = user32.func("int16 __stdcall VkKeyScanW(uint16 ch)");

const INPUT_KEYBOARD = 1;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_UNICODE = 0x0004;
const KEYEVENTF_SCANCODE = 0x0008;
const ENTER_SCAN_CODE = 0x1c;

function sendKey(wVk: number, wScan: number, flags: number, down: boolean): void {
  const dwFlags = flags | (down ? 0 : KEYEVENTF_KEYUP);
  const input = { type: INPUT_KEYBOARD, u: { ki: { wVk, wScan, dwFlags, time: 0, dwExtraInfo: 0 } } };
  if (SendInput(1, [input], koffi.sizeof(INPUT)) !== 1) throw new Error("SendInput did not send the key");
}

export const windowsKeyboard: Keyboard = {
  // Games read the hardware scan code rather than the virtual-key code.
  enter: (down) => sendKey(0, ENTER_SCAN_CODE, KEYEVENTF_SCANCODE, down),
  character: (codeUnit, down) => sendKey(0, codeUnit, KEYEVENTF_UNICODE, down),
};

/** The virtual-key code of a Share key, or undefined if it isn't a single character or F1-F24. */
export function virtualKeyOf(shareKey: string): number | undefined {
  const functionKey = /^F(\d{1,2})$/i.exec(shareKey);
  if (functionKey) {
    const number = Number(functionKey[1]);
    return number >= 1 && number <= 24 ? 0x6f + number : undefined;
  }
  if (shareKey.length === 1) {
    const scan = VkKeyScanW(shareKey.charCodeAt(0));
    return scan === -1 ? undefined : scan & 0xff;
  }
  return undefined;
}

const isDown = (virtualKey: number) => (GetAsyncKeyState(virtualKey) & 0x8000) !== 0;

const WATCH_POLL_MS = 15;

/**
 * Calls `onPress` once each time the key goes down. A registered Windows
 * hotkey never fires while League has focus, so the key's state is read
 * instead. This only reads; the key still reaches whatever window has focus.
 * Returns a function that stops watching.
 */
export function watchKey(virtualKey: number, onPress: () => void): () => void {
  let wasDown = isDown(virtualKey);
  const timer = setInterval(() => {
    const down = isDown(virtualKey);
    if (down && !wasDown) onPress();
    wasDown = down;
  }, WATCH_POLL_MS);
  return () => clearInterval(timer);
}

const RELEASE_POLL_MS = 10;
const RELEASE_GIVE_UP_MS = 3000;

/**
 * Resolves once the key is physically up (or after a few seconds), so it isn't
 * still held when the message is typed.
 */
export async function waitForKeyRelease(virtualKey: number): Promise<void> {
  const deadline = Date.now() + RELEASE_GIVE_UP_MS;
  while (isDown(virtualKey) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, RELEASE_POLL_MS));
  }
}
