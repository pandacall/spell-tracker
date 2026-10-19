import { describe, expect, it } from "vitest";
import customVsBots from "../../fixtures/custom-vs-bots.json";
import draft from "../../fixtures/draft-summoners-rift.json";
import primalSmite from "../../fixtures/smite-primal-vs-bots.json";
import unleashedSmite from "../../fixtures/smite-unleashed-vs-bots.json";
import unleashedTeleport from "../../fixtures/teleport-unleashed-vs-bots.json";
import { createTracker } from "./tracker";

/** The draft snapshot with one Enemy's two spells swapped for the given spell ids. */
function withSpells(snapshot: typeof draft, championId: string, one: string, two: string): typeof draft {
  const spell = (id: string) => ({
    displayName: id,
    rawDescription: `GeneratedTip_SummonerSpell_${id}_Description`,
    rawDisplayName: `GeneratedTip_SummonerSpell_${id}_DisplayName`,
  });
  return {
    ...snapshot,
    allPlayers: snapshot.allPlayers.map((player) =>
      player.rawChampionName === `game_character_displayname_${championId}`
        ? { ...player, summonerSpells: { summonerSpellOne: spell(one), summonerSpellTwo: spell(two) } }
        : player,
    ),
  };
}

/** The game feed failing five polls in a row; returns the signal the last of them gave. */
function loseFeed(tracker: ReturnType<typeof createTracker>) {
  let signal: ReturnType<typeof tracker.feed>;
  for (let miss = 0; miss < 5; miss++) signal = tracker.feed(null);
  return signal;
}

describe("Tracker", () => {
  it("lists the five Enemies in game-feed order when a game loads", () => {
    const tracker = createTracker();

    tracker.feed(draft);

    const overlay = tracker.overlay();
    expect(overlay.visible).toBe(true);
    expect(overlay.rows.map((row) => row.champion.name)).toEqual([
      "Yone",
      "Evelynn",
      "Malzahar",
      "Kai'Sa",
      "Taric",
    ]);
    expect(overlay.rows[1]).toEqual({
      champion: { id: "Evelynn", name: "Evelynn" },
      spells: [
        { id: "SummonerSmite", name: "Smite" },
        { id: "SummonerFlash", name: "Flash" },
      ],
    });
  });

  it("lists the bot Enemies of a custom game from the other team", () => {
    const tracker = createTracker();

    tracker.feed(customVsBots);

    expect(tracker.overlay().rows.map((row) => row.champion.name)).toEqual([
      "Vex",
      "Leona",
      "Jinx",
      "Karthus",
      "Mordekaiser",
    ]);
  });

  it("identifies Unleashed Teleport as Teleport for its icon, keeping its own name", () => {
    const tracker = createTracker();

    tracker.feed(unleashedTeleport);

    const malzahar = tracker.overlay().rows.find((row) => row.champion.name === "Malzahar");
    expect(malzahar?.spells).toEqual([
      { id: "SummonerFlash", name: "Flash" },
      { id: "SummonerTeleport", name: "Unleashed Teleport" },
    ]);
  });

  it("identifies upgraded Smite as Smite for its icon, keeping its own name", () => {
    const tracker = createTracker();

    tracker.feed(unleashedSmite);

    const zaahen = tracker.overlay().rows.find((row) => row.champion.name === "Zaahen");
    expect(zaahen?.spells).toEqual([
      { id: "SummonerFlash", name: "Flash" },
      { id: "SummonerSmite", name: "Unleashed Smite" },
    ]);
  });

  it("identifies every Smite variant as Smite, including ones it has not seen", () => {
    const tracker = createTracker();
    tracker.feed(primalSmite);
    const gragas = tracker.overlay().rows.find((row) => row.champion.name === "Gragas");
    expect(gragas?.spells[1]).toEqual({ id: "SummonerSmite", name: "Primal Smite" });

    const unseenVariant = structuredClone(primalSmite);
    unseenVariant.allPlayers[1].summonerSpells.summonerSpellTwo.rawDisplayName =
      "GeneratedTip_SummonerSpell_SummonerSmiteAvatarSomethingNew_DisplayName";
    const other = createTracker();
    other.feed(unseenVariant);
    expect(other.overlay().rows.find((row) => row.champion.name === "Gragas")?.spells[1].id).toBe(
      "SummonerSmite",
    );
  });

  it("ignores games that are not on Summoner's Rift", () => {
    const tracker = createTracker();
    const aram = {
      ...draft,
      gameData: { ...draft.gameData, gameMode: "ARAM", mapName: "Map12", mapNumber: 12 },
    };

    tracker.feed(aram);

    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });
  });

  it("signals the game ending and resets the overlay when the game feed goes away", () => {
    const tracker = createTracker();

    expect(tracker.feed(draft)).toBe("game-started");
    expect(tracker.feed(draft)).toBeUndefined();
    expect(loseFeed(tracker)).toBe("game-ended");

    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });
    expect(tracker.feed(null)).toBeUndefined();
  });

  it("rides out a few failed polls in a row, keeping the overlay and every Mark, and counts only consecutive ones", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(draft);
    tracker.mark("Evelynn", "SummonerFlash");
    const flashCountdown = () =>
      tracker.overlay().rows.find((row) => row.champion.id === "Evelynn")?.spells[1].countdown;

    for (let miss = 0; miss < 4; miss++) expect(tracker.feed(null)).toBeUndefined();
    wallMs = 4_000;
    expect(tracker.overlay().visible).toBe(true);
    expect(flashCountdown()).toBe(296);

    // A poll that gets through starts the count again.
    tracker.feed(draft);
    for (let miss = 0; miss < 4; miss++) expect(tracker.feed(null)).toBeUndefined();
    expect(tracker.overlay().visible).toBe(true);

    expect(tracker.feed(null)).toBe("game-ended");
    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });
  });

  it("signals the game ending once on a GameEnd event, even while the feed is still up", () => {
    const tracker = createTracker();
    const ended = {
      ...draft,
      events: { Events: [...draft.events.Events, { EventID: 99, EventName: "GameEnd", EventTime: 1500, Result: "Win" }] },
    };

    tracker.feed(draft);

    expect(tracker.feed(ended)).toBe("game-ended");
    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });
    expect(tracker.feed(ended)).toBeUndefined();
    expect(loseFeed(tracker)).toBeUndefined();
  });

  it("ignores snapshots it cannot make sense of, and keeps tracking afterwards", () => {
    const tracker = createTracker();

    expect(tracker.feed({})).toBeUndefined();
    expect(tracker.feed({ ...draft, allPlayers: [] })).toBeUndefined();
    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });

    expect(tracker.feed(draft)).toBe("game-started");
    expect(tracker.feed({})).toBeUndefined();
    expect(tracker.overlay().rows).toHaveLength(5);
  });

  it("shows no Enemies when the active player is not in the game roster", () => {
    const tracker = createTracker();
    const spectating = { ...draft, activePlayer: { ...draft.activePlayer, riotId: "Nobody#0000" } };

    expect(tracker.feed(spectating)).toBeUndefined();

    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });
  });

  it("starts a Countdown from the base cooldown when a spell is Marked", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(draft);

    tracker.mark("Evelynn", "SummonerFlash");

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells.map((spell) => spell.countdown)).toEqual([undefined, 300]);
  });

  it("counts down between polls and corrects itself to the game feed's clock after a pause", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(draft);
    tracker.mark("Evelynn", "SummonerFlash");
    const flashCountdown = () =>
      tracker.overlay().rows.find((row) => row.champion.id === "Evelynn")?.spells[1].countdown;

    wallMs = 10_000;
    expect(flashCountdown()).toBe(290);

    // The game was paused: 10s passed here but the game clock moved only 4s.
    tracker.feed({ ...draft, gameData: { ...draft.gameData, gameTime: draft.gameData.gameTime + 4 } });
    expect(flashCountdown()).toBe(296);

    wallMs = 11_000;
    expect(flashCountdown()).toBe(295);
  });

  it("never shows more than the base cooldown when a poll pulls the clock back behind a fresh Mark", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(draft);

    // The game is paused, so the interpolated clock runs ahead of the real one.
    wallMs = 10_000;
    tracker.mark("Evelynn", "SummonerFlash");
    tracker.feed(draft);

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells[1].countdown).toBe(300);
  });

  it("keeps the last game clock when a snapshot carries no game time", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(draft);
    tracker.mark("Evelynn", "SummonerFlash");

    wallMs = 5_000;
    const { gameTime: _gameTime, ...gameData } = draft.gameData;
    tracker.feed({ ...draft, gameData } as unknown as typeof draft);

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells[1].countdown).toBe(295);
  });

  it("returns a spell to ready when its Countdown reaches zero, ready to be Marked again", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(draft);
    tracker.mark("Evelynn", "SummonerFlash");
    const flashCountdown = () =>
      tracker.overlay().rows.find((row) => row.champion.id === "Evelynn")?.spells[1].countdown;

    wallMs = 299_000;
    expect(flashCountdown()).toBe(1);

    wallMs = 300_000;
    expect(flashCountdown()).toBeUndefined();

    tracker.mark("Evelynn", "SummonerFlash");
    expect(flashCountdown()).toBe(300);
  });

  it("ignores a Mark on a spell that is already counting down", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(draft);
    tracker.mark("Evelynn", "SummonerFlash");

    wallMs = 20_000;
    tracker.mark("Evelynn", "SummonerFlash");

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells[1].countdown).toBe(280);
  });

  it("clears a Countdown, leaving the spell ready", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(draft);
    tracker.mark("Evelynn", "SummonerFlash");

    tracker.clear("Evelynn", "SummonerFlash");

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells.map((spell) => spell.countdown)).toEqual([undefined, undefined]);
  });

  it.each([
    ["SummonerFlash", 300],
    ["SummonerDot", 180],
    ["SummonerBarrier", 180],
    ["SummonerHeal", 240],
    ["SummonerExhaust", 240],
    ["SummonerHaste", 240],
    ["SummonerBoost", 240],
    ["SummonerTeleport", 300],
  ])("counts down %s from its base cooldown of %i seconds", (spellId, seconds) => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(withSpells(draft, "Evelynn", spellId, "SummonerSmite"));

    tracker.mark("Evelynn", spellId);

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells[0].countdown).toBe(seconds);
  });

  it("shows Smite but never Marks it", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(draft);

    tracker.mark("Evelynn", "SummonerSmite");

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells[0]).toEqual({ id: "SummonerSmite", name: "Smite" });
  });

  it("forgets every Mark when the game ends, whether the feed goes away or reports GameEnd", () => {
    const ended = {
      ...draft,
      events: { Events: [...draft.events.Events, { EventID: 99, EventName: "GameEnd", EventTime: 1500, Result: "Win" }] },
    };
    const flashCountdown = (tracker: ReturnType<typeof createTracker>) =>
      tracker.overlay().rows.find((row) => row.champion.id === "Evelynn")?.spells[1].countdown;

    for (const ending of [null, ended]) {
      const tracker = createTracker({ now: () => 0 });
      tracker.feed(draft);
      tracker.mark("Evelynn", "SummonerFlash");

      if (ending === null) loseFeed(tracker);
      else tracker.feed(ending);
      tracker.feed(draft);

      expect(flashCountdown(tracker)).toBeUndefined();
    }
  });

  it("ignores a Mark when there is no game", () => {
    const tracker = createTracker({ now: () => 0 });

    tracker.mark("Evelynn", "SummonerFlash");
    tracker.feed(draft);

    const evelynn = tracker.overlay().rows.find((row) => row.champion.id === "Evelynn");
    expect(evelynn?.spells[1].countdown).toBeUndefined();
  });

  it("picks up a new game after the last one ended", () => {
    const tracker = createTracker();

    tracker.feed(draft);
    loseFeed(tracker);

    expect(tracker.feed(draft)).toBe("game-started");
    expect(tracker.overlay().rows).toHaveLength(5);
  });
});
