# Share sends the Share Line to chat with simulated keystrokes

League's in-game chat ignores the Windows clipboard, so the only way to Share without the user typing is for the app to simulate input: press Enter, type the Share Line, press Enter. We do this, knowingly breaking the letter of Riot's Terms of Service (which ban "automation programs" interacting with the game "for any purpose"), because Riot's enforcement targets gameplay automation, staff have said non-malicious AutoHotkey use "should be ok", and the closest precedent (Zeunig/lol_clipboard, which types into chat the same way) had no known bans after more than a year under Vanguard. The user accepts this risk on their own account.

## Constraints

- One Share key press sends exactly one message. No loops, repeats or scheduled sends.
- Software-simulated keystrokes only. Never read game memory, never install a low-level input driver (e.g. Interception, which breaks Vanguard games), and never use a USB HID device such as an Arduino or Pi Pico to type — Vanguard treats that hardware profile as cheat hardware and it risks a hardware ban.
- Auto-send is a setting. When off, Share falls back to showing the Share Line large on the overlay for the user to type.

## Considered Options

- **User types the Share Line from the overlay**: zero risk, kept as the fallback.
- **Clipboard paste**: impossible; verified in game that chat ignores the Windows clipboard.
- **Serial-driven USB HID device**: rejected as the highest-risk option despite producing "real" keystrokes.
- **Built-in scoreboard ping** ("[Champion] used Flash"): carries no Ready Time.
- **3-second lockout between Shares**: rejected by the user; one press = one message is enough of a guard.
