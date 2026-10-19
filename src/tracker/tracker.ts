export interface Champion {
  id: string;
  name: string;
}

export interface Spell {
  id: string;
  name: string;
}

export interface EnemyRow {
  champion: Champion;
  spells: [Spell, Spell];
}

export interface OverlayState {
  visible: boolean;
  rows: EnemyRow[];
}

export type TrackerSignal = "game-started" | "game-ended";

export interface Tracker {
  /** Feed one raw game-feed snapshot, or null when there is no game to read. */
  feed(snapshot: unknown): TrackerSignal | undefined;
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
  summonerSpells: { summonerSpellOne: FeedSpell; summonerSpellTwo: FeedSpell };
}

const SUMMONERS_RIFT_MAP_NUMBER = 11;

interface FeedSnapshot {
  gameData: { mapNumber: number };
  events: { Events: Array<{ EventName: string }> };
  activePlayer: { riotId: string };
  allPlayers: FeedPlayer[];
}

// Spells whose raw name changes mid-game (Teleport becomes Unleashed Teleport at
// 10:00), mapped to the base spell they are, so they keep one id and one icon.
const BASE_SPELL_ID: Record<string, string> = {
  S12_SummonerTeleportUpgrade: "SummonerTeleport",
};

function spellOf(spell: FeedSpell): Spell {
  const match = /^GeneratedTip_SummonerSpell_(.+)_DisplayName$/.exec(spell.rawDisplayName);
  const rawId = match ? match[1] : spell.rawDisplayName;
  return { id: BASE_SPELL_ID[rawId] ?? rawId, name: spell.displayName };
}

function championOf(player: FeedPlayer): Champion {
  const match = /^game_character_displayname_(.+)$/.exec(player.rawChampionName);
  return { id: match ? match[1] : player.rawChampionName, name: player.championName };
}

const NO_GAME: OverlayState = { visible: false, rows: [] };

function hasGameEnded(snapshot: FeedSnapshot): boolean {
  return snapshot.events?.Events?.some((event) => event.EventName === "GameEnd") === true;
}

/**
 * The Enemies of a Summoner's Rift snapshot, or undefined when the snapshot is
 * for another map, has no roster yet, doesn't include the active player (e.g.
 * spectating), or isn't shaped the way the feed normally is (the game may still
 * be loading).
 */
function enemiesOf(snapshot: FeedSnapshot): EnemyRow[] | undefined {
  try {
    if (snapshot.gameData.mapNumber !== SUMMONERS_RIFT_MAP_NUMBER) return undefined;
    const { allPlayers } = snapshot;
    const me = allPlayers.find((player) => player.riotId === snapshot.activePlayer.riotId);
    if (!me) return undefined;
    const rows = allPlayers
      .filter((player) => player.team !== me.team)
      .map((player): EnemyRow => ({
        champion: championOf(player),
        spells: [
          spellOf(player.summonerSpells.summonerSpellOne),
          spellOf(player.summonerSpells.summonerSpellTwo),
        ],
      }));
    return rows.length > 0 ? rows : undefined;
  } catch {
    return undefined;
  }
}

export function createTracker(): Tracker {
  let state: OverlayState = NO_GAME;

  return {
    feed(snapshot) {
      const parsed = snapshot as FeedSnapshot | null;
      if (parsed === null || hasGameEnded(parsed)) {
        if (!state.visible) return undefined;
        state = NO_GAME;
        return "game-ended";
      }

      const rows = enemiesOf(parsed);
      if (!rows) return undefined;
      const signal = state.visible ? undefined : "game-started";
      state = { visible: true, rows };
      return signal;
    },
    overlay() {
      return state;
    },
  };
}
