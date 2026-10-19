# Spell Tracker

A personal overlay for League of Legends (Summoner's Rift) that tracks the enemy team's summoner spell cooldowns and helps relay enemy Flash timings to teammates through in-game chat.

## Language

### Players and roles

**Enemy**:
One of the five champions on the opposing team, identified by their Role.
_Avoid_: Opponent, target, player

**Role**:
An enemy's lane position, always written as one of `top`, `jg`, `mid`, `bot`, `sup`. `bot` always means the enemy ADC, never the support.
_Avoid_: adc, jungle, support, lane, position

### Timing

**Mark**:
The user's act of recording that an Enemy just used a summoner spell, which starts that spell's Countdown.
_Avoid_: Log, track, tag

**Countdown**:
The time remaining until a marked summoner spell is available again, as shown on the overlay.
_Avoid_: Timer, cooldown remaining

**Ready Time**:
The game clock time at which a marked summoner spell becomes available again, written as digits with no colon (`1230` = 12:30 on the game clock). It is never a duration.
_Avoid_: Flash timer, "up in"

### Sharing

**Share Line**:
The single chat message that lists, for every Enemy whose Flash is currently down, the Ready Time followed by the Role, soonest first (e.g. `1230 mid 1440 bot`). Only Flash ever appears in a Share Line.
_Avoid_: Callout, chat message, timer message

**Share**:
The user's deliberate act of sending the current Share Line to team chat, separate from Marking.
_Avoid_: Broadcast, post

**Share key**:
The system-wide key that performs a Share while a game is running. It is a setting, backtick by default.
_Avoid_: Hotkey, trigger

### Overlay

**Sample overlay**:
The overlay filled with made-up Enemies, shown from Settings outside a game so its size, opacity and position can be adjusted.
_Avoid_: Preview, demo
