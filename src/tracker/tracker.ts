export interface Champion {
  id: string;
  name: string;
}

export interface Spell {
  id: string;
  name: string;
}

export interface OverlaySpell extends Spell {
  /** Whole seconds until a Marked spell is ready again; absent when it is ready. */
  countdown?: number;
}

// Role order, top of the overlay first.
const ROLES = ["top", "jg", "mid", "bot", "sup"] as const;

/** An Enemy's Role; `bot` is always the ADC, never the support. */
export type Role = (typeof ROLES)[number];

export interface EnemyRow {
  /** Absent when the feed's positions couldn't give every Enemy a Role (see `roleSetupNeeded`). */
  role?: Role;
  champion: Champion;
  spells: [OverlaySpell, OverlaySpell];
}

export interface OverlayState {
  visible: boolean;
  /** In Role order, or in game-feed order when `roleSetupNeeded`. */
  rows: EnemyRow[];
  /** True when the feed's positions couldn't order the rows, so they have no Roles yet. */
  roleSetupNeeded: boolean;
}

export type TrackerSignal = "game-started" | "game-ended";

export interface Tracker {
  /** Feed one raw game-feed snapshot, or null when there is no game to read. */
  feed(snapshot: unknown): TrackerSignal | undefined;
  /** Mark an Enemy's spell as just used, starting its Countdown. */
  mark(championId: string, spellId: string): void;
  /** Clear an Enemy's spell Countdown, leaving it ready. */
  clear(championId: string, spellId: string): void;
  overlay(): OverlayState;
  /** The Share Line for the Flashes that are down now; empty when none is. */
  shareLine(): string;
}

interface FeedSpell {
  displayName: string;
  rawDisplayName: string;
}

interface FeedPlayer {
  items?: Array<{ itemID: number }>;
  level?: number;
  championName: string;
  rawChampionName: string;
  riotId: string;
  team: string;
  position?: string;
  summonerSpells: { summonerSpellOne: FeedSpell; summonerSpellTwo: FeedSpell };
}

const SUMMONERS_RIFT_MAP_NUMBER = 11;

interface FeedSnapshot {
  gameData: { mapNumber: number; gameTime?: number };
  events: { Events: Array<{ EventName: string }> };
  activePlayer: { riotId: string };
  allPlayers: FeedPlayer[];
}

// The feed reports NONE, an empty string or nothing for a player it can't place
// (blind pick), so any other value is simply not a Role.
const ROLE_OF_POSITION = new Map<string, Role>([
  ["TOP", "top"],
  ["JUNGLE", "jg"],
  ["MIDDLE", "mid"],
  ["BOTTOM", "bot"],
  ["UTILITY", "sup"],
]);

// Some spells change their raw name mid-game: Teleport becomes Unleashed Teleport
// at 10:00, and Smite upgrades into several variants (Unleashed, Primal, ...).
// Data Dragon has no icons for the variants, and there may be more than we have
// seen, so any raw id naming Smite or Teleport is that base spell.
function baseSpellId(rawId: string): string {
  if (rawId.includes("Smite")) return "SummonerSmite";
  if (rawId.includes("Teleport")) return "SummonerTeleport";
  return rawId;
}

function spellOf(spell: FeedSpell): Spell {
  const match = /^GeneratedTip_SummonerSpell_(.+)_DisplayName$/.exec(spell.rawDisplayName);
  const rawId = match ? match[1] : spell.rawDisplayName;
  return { id: baseSpellId(rawId), name: spell.displayName };
}

function championOf(player: FeedPlayer): Champion {
  const match = /^game_character_displayname_(.+)$/.exec(player.rawChampionName);
  return { id: match ? match[1] : player.rawChampionName, name: player.championName };
}

const FLASH = "SummonerFlash";

// Base cooldowns in seconds, by spell id, before any Summoner Spell Haste. Smite
// is absent on purpose: it is shown but never Marked. Teleport's is its cooldown
// before it becomes Unleashed Teleport.
const BASE_COOLDOWN: Record<string, number> = {
  [FLASH]: 300,
  SummonerDot: 180, // Ignite
  SummonerBarrier: 180,
  SummonerHeal: 240,
  SummonerExhaust: 240,
  SummonerHaste: 240, // Ghost
  SummonerBoost: 240, // Cleanse
  SummonerTeleport: 300,
};

/** A cooldown in seconds at champion level 1 and at level 18, falling in a straight line between them. */
interface CooldownByLevel {
  level1: number;
  level18: number;
}

// Teleport turns into Unleashed Teleport at 10:00 and its cooldown then depends on
// the Enemy's level (patch 26.20 values).
const UNLEASHED_TELEPORT_AT = 600;
const UNLEASHED_TELEPORT_COOLDOWN: CooldownByLevel = { level1: 330, level18: 240 };
// A top-lane Enemy's Teleport is the role quest's, which has a shorter cooldown.
const TOP_QUEST_UNLEASHED_TELEPORT_COOLDOWN: CooldownByLevel = { level1: 300, level18: 210 };

function cooldownAtLevel(cooldown: CooldownByLevel, level: number): number {
  const step = (Math.min(Math.max(level, 1), 18) - 1) / 17;
  return cooldown.level1 + (cooldown.level18 - cooldown.level1) * step;
}

/** The cooldown in seconds of a spell Marked at the given game time, before any haste. */
function cooldownOf(spellId: string, game: number, level: number, role?: Role): number | undefined {
  if (spellId === "SummonerTeleport" && game >= UNLEASHED_TELEPORT_AT) {
    const cooldown = role === "top" ? TOP_QUEST_UNLEASHED_TELEPORT_COOLDOWN : UNLEASHED_TELEPORT_COOLDOWN;
    return cooldownAtLevel(cooldown, level);
  }
  return BASE_COOLDOWN[spellId];
}

// Summoner Spell Haste by item id. Only the two Lucidity boots count; Cosmic
// Insight (a rune, not an item) and everything else is ignored on purpose.
// Both ids are from Data Dragon's item.json (16.20.1).
const SUMMONER_SPELL_HASTE: Record<number, number> = {
  3158: 10, // Ionian Boots of Lucidity
  3171: 20, // Crimson Lucidity
};

/** The Summoner Spell Haste an Enemy's items give. */
function hasteOf(player: FeedPlayer): number {
  return Math.max(0, ...(player.items ?? []).map((item) => SUMMONER_SPELL_HASTE[item.itemID] ?? 0));
}

// The feed is polled about once a second and a poll fails on any lag spike or
// loading hitch, so only this many failures in a row mean the game is over.
// (A GameEnd event in a snapshot ends it at once.)
const MISSED_POLLS_BEFORE_GAME_ENDS = 5;

const NO_GAME: OverlayState = { visible: false, rows: [], roleSetupNeeded: false };

function hasGameEnded(snapshot: FeedSnapshot): boolean {
  return snapshot.events?.Events?.some((event) => event.EventName === "GameEnd") === true;
}

/** True when every Enemy has a Role and no two share one, so the Roles can order the rows. */
function isCompleteRoles(roles: Array<Role | undefined>): roles is Role[] {
  return !roles.includes(undefined) && new Set(roles).size === roles.length;
}

function rowOf(player: FeedPlayer, role?: Role): EnemyRow {
  return {
    ...(role && { role }),
    champion: championOf(player),
    spells: [
      spellOf(player.summonerSpells.summonerSpellOne),
      spellOf(player.summonerSpells.summonerSpellTwo),
    ],
  };
}

interface EnemyGear {
  level: number;
  /** Summoner Spell Haste from the Enemy's boots. */
  haste: number;
}

interface EnemiesOfSnapshot extends Pick<OverlayState, "rows" | "roleSetupNeeded"> {
  /** What each Enemy has right now, by champion id, for the cooldown of a Mark. */
  gear: Map<string, EnemyGear>;
}

/**
 * The Enemies of a Summoner's Rift snapshot, or undefined when the snapshot is
 * for another map, has no roster yet, doesn't include the active player (e.g.
 * spectating), or isn't shaped the way the feed normally is (the game may still
 * be loading). When the feed's positions can't give every Enemy a Role, the rows
 * keep game-feed order and carry none.
 */
function enemiesOf(snapshot: FeedSnapshot): EnemiesOfSnapshot | undefined {
  try {
    if (snapshot.gameData.mapNumber !== SUMMONERS_RIFT_MAP_NUMBER) return undefined;
    const { allPlayers } = snapshot;
    const me = allPlayers.find((player) => player.riotId === snapshot.activePlayer.riotId);
    if (!me) return undefined;
    const enemies = allPlayers.filter((player) => player.team !== me.team);
    if (enemies.length === 0) return undefined;
    const gear = new Map(enemies.map((player) => [championOf(player).id, { level: player.level ?? 1, haste: hasteOf(player) }]));
    const roles = enemies.map((player) => ROLE_OF_POSITION.get(player.position ?? ""));
    if (!isCompleteRoles(roles)) {
      return { rows: enemies.map((player) => rowOf(player)), roleSetupNeeded: true, gear };
    }
    const rows = enemies
      .map((player, index) => ({ player, role: roles[index] }))
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
      .map(({ player, role }) => rowOf(player, role));
    return { rows, roleSetupNeeded: false, gear };
  } catch {
    return undefined;
  }
}

interface MarkRecord {
  /** Game clock seconds at the moment of the Mark. */
  at: number;
  cooldown: number;
}

/** Whole seconds left on a Mark at the given game time; zero or less once it has expired. */
function remainingOf(mark: MarkRecord, game: number): number {
  // A poll can pull the interpolated clock back behind a Mark made just before it
  // (the game was paused), so elapsed time never goes negative. Rounded to the
  // millisecond so float noise can't tip a whole second over.
  const elapsed = Math.max(0, game - mark.at);
  return Math.ceil(Math.round((mark.cooldown - elapsed) * 1000) / 1000);
}

/** The game clock second a Mark's spell is ready again, rounded down to 10 seconds as the Share Line shows it. */
function readyTimeOf(mark: MarkRecord): number {
  return Math.floor((mark.at + mark.cooldown) / 10) * 10;
}

/** A Ready Time in game clock seconds as minutes then two-digit seconds, with no colon (`930`, `1230`). */
function formatReadyTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}${String(seconds % 60).padStart(2, "0")}`;
}

export function createTracker(options: { now?: () => number } = {}): Tracker {
  const now = options.now ?? (() => performance.now());
  let state: OverlayState = NO_GAME;
  const marks = new Map<string, MarkRecord>();
  let gear = new Map<string, EnemyGear>();
  let missedPolls = 0;

  // The game clock as of the latest snapshot, and when (on our own clock) we
  // saw it, so the game time can be interpolated between polls.
  let clock = { game: 0, seenAt: 0 };
  const gameTime = () => clock.game + (now() - clock.seenAt) / 1000;
  const markKey = (championId: string, spellId: string) => `${championId}:${spellId}`;

  return {
    feed(snapshot) {
      const parsed = snapshot as FeedSnapshot | null;
      missedPolls = parsed === null ? missedPolls + 1 : 0;
      if (parsed === null && missedPolls < MISSED_POLLS_BEFORE_GAME_ENDS) return undefined;
      if (parsed === null || hasGameEnded(parsed)) {
        if (!state.visible) return undefined;
        state = NO_GAME;
        marks.clear();
        return "game-ended";
      }

      const enemies = enemiesOf(parsed);
      if (!enemies) return undefined;
      const signal = state.visible ? undefined : "game-started";
      state = { visible: true, rows: enemies.rows, roleSetupNeeded: enemies.roleSetupNeeded };
      gear = enemies.gear;
      // A snapshot without a game time leaves the clock as it was.
      const reported = parsed.gameData.gameTime;
      clock = { game: typeof reported === "number" ? reported : gameTime(), seenAt: now() };
      return signal;
    },
    mark(championId, spellId) {
      if (!state.visible) return;
      const game = gameTime();
      const { level, haste } = gear.get(championId) ?? { level: 1, haste: 0 };
      const role = state.rows.find((row) => row.champion.id === championId)?.role;
      const baseCooldown = cooldownOf(spellId, game, level, role);
      if (baseCooldown === undefined) return;
      const key = markKey(championId, spellId);
      const existing = marks.get(key);
      if (existing && remainingOf(existing, game) > 0) return;
      marks.set(key, { at: game, cooldown: (baseCooldown * 100) / (100 + haste) });
    },
    clear(championId, spellId) {
      marks.delete(markKey(championId, spellId));
    },
    shareLine() {
      const game = gameTime();
      const entries: Array<{ role: Role; readyAt: number }> = [];
      for (const row of state.rows) {
        const hasFlash = row.spells.some((spell) => spell.id === FLASH);
        const mark = marks.get(markKey(row.champion.id, FLASH));
        if (hasFlash && mark && row.role && remainingOf(mark, game) > 0) {
          entries.push({ role: row.role, readyAt: readyTimeOf(mark) });
        }
      }
      // Rows are in Role order and the sort is stable, so equal Ready Times stay in Role order.
      return entries
        .sort((a, b) => a.readyAt - b.readyAt)
        .map(({ role, readyAt }) => `${formatReadyTime(readyAt)} ${role}`)
        .join(" ");
    },
    overlay() {
      if (!state.visible) return state;
      const game = gameTime();
      const withCountdown = (championId: string, spell: OverlaySpell): OverlaySpell => {
        const mark = marks.get(markKey(championId, spell.id));
        if (!mark) return spell;
        const remaining = remainingOf(mark, game);
        return remaining > 0 ? { ...spell, countdown: remaining } : spell;
      };
      return {
        ...state,
        rows: state.rows.map((row) => ({
          ...row,
          spells: [
            withCountdown(row.champion.id, row.spells[0]),
            withCountdown(row.champion.id, row.spells[1]),
          ],
        })),
      };
    },
  };
}
