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
}

interface FeedSpell {
  displayName: string;
  rawDisplayName: string;
}

interface FeedPlayer {
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

// Base cooldowns in seconds, by spell id; ability haste is not applied yet. Smite
// is absent on purpose: it is shown but never Marked.
const BASE_COOLDOWN: Record<string, number> = {
  SummonerFlash: 300,
  SummonerDot: 180, // Ignite
  SummonerBarrier: 180,
  SummonerHeal: 240,
  SummonerExhaust: 240,
  SummonerHaste: 240, // Ghost
  SummonerBoost: 240, // Cleanse
  SummonerTeleport: 300,
};

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

/**
 * The Enemies of a Summoner's Rift snapshot, or undefined when the snapshot is
 * for another map, has no roster yet, doesn't include the active player (e.g.
 * spectating), or isn't shaped the way the feed normally is (the game may still
 * be loading). When the feed's positions can't give every Enemy a Role, the rows
 * keep game-feed order and carry none.
 */
function enemiesOf(snapshot: FeedSnapshot): Pick<OverlayState, "rows" | "roleSetupNeeded"> | undefined {
  try {
    if (snapshot.gameData.mapNumber !== SUMMONERS_RIFT_MAP_NUMBER) return undefined;
    const { allPlayers } = snapshot;
    const me = allPlayers.find((player) => player.riotId === snapshot.activePlayer.riotId);
    if (!me) return undefined;
    const enemies = allPlayers.filter((player) => player.team !== me.team);
    if (enemies.length === 0) return undefined;
    const roles = enemies.map((player) => ROLE_OF_POSITION.get(player.position ?? ""));
    if (!isCompleteRoles(roles)) {
      return { rows: enemies.map((player) => rowOf(player)), roleSetupNeeded: true };
    }
    const rows = enemies
      .map((player, index) => ({ player, role: roles[index] }))
      .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role))
      .map(({ player, role }) => rowOf(player, role));
    return { rows, roleSetupNeeded: false };
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

export function createTracker(options: { now?: () => number } = {}): Tracker {
  const now = options.now ?? (() => performance.now());
  let state: OverlayState = NO_GAME;
  const marks = new Map<string, MarkRecord>();
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
      state = { visible: true, ...enemies };
      // A snapshot without a game time leaves the clock as it was.
      const reported = parsed.gameData.gameTime;
      clock = { game: typeof reported === "number" ? reported : gameTime(), seenAt: now() };
      return signal;
    },
    mark(championId, spellId) {
      const cooldown = BASE_COOLDOWN[spellId];
      if (!state.visible || cooldown === undefined) return;
      const key = markKey(championId, spellId);
      const existing = marks.get(key);
      if (existing && remainingOf(existing, gameTime()) > 0) return;
      marks.set(key, { at: gameTime(), cooldown });
    },
    clear(championId, spellId) {
      marks.delete(markKey(championId, spellId));
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
