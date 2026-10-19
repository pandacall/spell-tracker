interface RiotIdentity {
  isBot?: unknown;
  riotId?: unknown;
  riotIdGameName?: unknown;
  riotIdTagLine?: unknown;
  summonerName?: unknown;
}

/**
 * Replaces every real player identity in a raw game-feed snapshot with a
 * placeholder, so captured fixtures can be committed without publishing other
 * people's Riot IDs. Only string values that are exactly a player's Riot ID,
 * game name, tag line or summoner name are replaced; every other field is left
 * exactly as League returned it.
 */
export function scrubSnapshot(snapshot: unknown): unknown {
  const data = snapshot as { allPlayers?: RiotIdentity[] };
  const replacements = new Map<string, string>();
  (data.allPlayers ?? []).forEach((player, index) => {
    // Bots have no identity to hide, and their name is just their champion's.
    if (player.isBot === true) return;
    const label = `Player${index + 1}`;
    const tag = "0000";
    const add = (original: unknown, replacement: string) => {
      if (typeof original === "string" && original.length > 0) replacements.set(original, replacement);
    };
    add(player.riotId, `${label}#${tag}`);
    add(player.summonerName, `${label}#${tag}`);
    add(player.riotIdGameName, label);
    add(player.riotIdTagLine, tag);
  });

  const scrub = (value: unknown): unknown => {
    if (typeof value === "string") return replacements.get(value) ?? value;
    if (Array.isArray(value)) return value.map(scrub);
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, scrub(inner)]));
    }
    return value;
  };
  return scrub(snapshot);
}
