// koffi ships ESM-typed declarations but also a CommonJS entry, which is what
// this CommonJS build loads.
import type KoffiModule from "koffi" with { "resolution-mode": "import" };
import type { Keyboard } from "../chat-sender/chat-sender";
import { parseShareKey } from "../share/share-key";

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
const MapVirtualKeyExW = user32.func("uint32 __stdcall MapVirtualKeyExW(uint32 uCode, uint32 uMapType, intptr dwhkl)");
const GetKeyboardLayout = user32.func("intptr __stdcall GetKeyboardLayout(uint32 idThread)");
const GetForegroundWindow = user32.func("intptr __stdcall GetForegroundWindow()");
const GetWindowThreadProcessId = user32.func("uint32 __stdcall GetWindowThreadProcessId(intptr hWnd, uint32 *lpdwProcessId)");

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

const MAPVK_VK_TO_CHAR = 2;
const MAPVK_VSC_TO_VK_EX = 3;
const CHAR_MASK = 0x7fffffff; // clears bit 31, which marks a dead key

// The Share key is watched from game start, when League is the foreground
// window, so its layout is the one the player is typing on.
const foregroundLayout = () => GetKeyboardLayout(GetWindowThreadProcessId(GetForegroundWindow(), null));

/** The virtual-key code of a Share key, or undefined if it can't be resolved. */
export function virtualKeyOf(shareKey: string): number | undefined {
  const key = parseShareKey(shareKey);
  switch (key?.kind) {
    case "function":
      return 0x6f + key.number;
    case "character": {
      const scan = VkKeyScanW(key.character.charCodeAt(0));
      return scan === -1 ? undefined : scan & 0xff;
    }
    case "scan": {
      const virtualKey = MapVirtualKeyExW(key.scanCode, MAPVK_VSC_TO_VK_EX, foregroundLayout());
      return virtualKey === 0 ? undefined : virtualKey;
    }
    default:
      return undefined;
  }
}

/** What the Share key is called on the keyboard in use, or undefined if the key is unusable. */
export function shareKeyLabel(shareKey: string): string | undefined {
  const key = parseShareKey(shareKey);
  const virtualKey = virtualKeyOf(shareKey);
  if (!key || virtualKey === undefined) return undefined;
  switch (key.kind) {
    case "function":
      return `F${key.number}`;
    case "character":
      return key.character.toUpperCase();
    case "scan": {
      // A dead key still reports its character in the low bits.
      const character = MapVirtualKeyExW(virtualKey, MAPVK_VK_TO_CHAR, foregroundLayout()) & CHAR_MASK;
      return character === 0 ? `Key ${key.scanCode}` : String.fromCharCode(character).toUpperCase();
    }
  }
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
