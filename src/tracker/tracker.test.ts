import { describe, expect, it } from "vitest";
import customVsBots from "../../fixtures/custom-vs-bots.json";
import draft from "../../fixtures/draft-summoners-rift.json";
import primalSmite from "../../fixtures/smite-primal-vs-bots.json";
import unleashedSmite from "../../fixtures/smite-unleashed-vs-bots.json";
import unleashedTeleport from "../../fixtures/teleport-unleashed-vs-bots.json";
import { createTracker } from "./tracker";

const NO_GAME = { visible: false, rows: [], roleSetupNeeded: false };

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

/** The draft snapshot with the given Enemies' feed positions replaced, keyed by champion id. */
function withPositions(snapshot: typeof draft, positions: Record<string, string>): typeof draft {
  return {
    ...snapshot,
    allPlayers: snapshot.allPlayers.map((player) => {
      const championId = player.rawChampionName.replace("game_character_displayname_", "");
      return Object.hasOwn(positions, championId) ? { ...player, position: positions[championId] } : player;
    }),
  };
}

/** The game feed failing five polls in a row; returns the signal the last of them gave. */
function loseFeed(tracker: ReturnType<typeof createTracker>) {
  let signal: ReturnType<typeof tracker.feed>;
  for (let miss = 0; miss < 5; miss++) signal = tracker.feed(null);
  return signal;
}

describe("Tracker", () => {
  it("lists the five Enemies, each with its Role, when a game loads", () => {
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
      role: "jg",
      champion: { id: "Evelynn", name: "Evelynn" },
      spells: [
        { id: "SummonerSmite", name: "Smite" },
        { id: "SummonerFlash", name: "Flash" },
      ],
    });
  });

  it("orders the Enemies top, jg, mid, bot, sup whatever order the game feed lists them in", () => {
    const tracker = createTracker();

    tracker.feed(
      withPositions(draft, {
        Yone: "UTILITY",
        Evelynn: "BOTTOM",
        Malzahar: "MIDDLE",
        Kaisa: "JUNGLE",
        Taric: "TOP",
      }),
    );

    const { rows, roleSetupNeeded } = tracker.overlay();
    expect(rows.map((row) => [row.role, row.champion.name])).toEqual([
      ["top", "Taric"],
      ["jg", "Kai'Sa"],
      ["mid", "Malzahar"],
      ["bot", "Evelynn"],
      ["sup", "Yone"],
    ]);
    expect(roleSetupNeeded).toBe(false);
  });

  it("reports that Role setup is needed and keeps game-feed order when positions are missing", () => {
    const tracker = createTracker();

    // The feed reports NONE (or nothing) when it cannot place a player, as in blind pick.
    tracker.feed(withPositions(draft, { Yone: "NONE", Evelynn: "", Malzahar: "NONE", Kaisa: "NONE", Taric: "NONE" }));

    const { rows, roleSetupNeeded } = tracker.overlay();
    expect(roleSetupNeeded).toBe(true);
    expect(rows.map((row) => row.champion.name)).toEqual(["Yone", "Evelynn", "Malzahar", "Kai'Sa", "Taric"]);
    expect(rows.map((row) => row.role)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it("reports that Role setup is needed when the feed gives no position at all", () => {
    const tracker = createTracker();
    const noPositions = structuredClone(draft);
    for (const player of noPositions.allPlayers) delete (player as { position?: string }).position;

    tracker.feed(noPositions);

    expect(tracker.overlay().roleSetupNeeded).toBe(true);
    expect(tracker.overlay().rows.map((row) => row.champion.name)).toEqual(["Yone", "Evelynn", "Malzahar", "Kai'Sa", "Taric"]);
  });

  it("reports that Role setup is needed when only some Enemies have a position", () => {
    const tracker = createTracker();

    tracker.feed(withPositions(draft, { Taric: "NONE" }));

    const { rows, roleSetupNeeded } = tracker.overlay();
    expect(roleSetupNeeded).toBe(true);
    expect(rows.map((row) => row.champion.name)).toEqual(["Yone", "Evelynn", "Malzahar", "Kai'Sa", "Taric"]);
    expect(rows.map((row) => row.role)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it("reports that Role setup is needed when two Enemies share a position", () => {
    const tracker = createTracker();

    tracker.feed(withPositions(draft, { Taric: "JUNGLE" }));

    const { rows, roleSetupNeeded } = tracker.overlay();
    expect(roleSetupNeeded).toBe(true);
    expect(rows.map((row) => row.role)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });

  it("lists the bot Enemies of a custom game from the other team, in Role order", () => {
    const tracker = createTracker();

    tracker.feed(customVsBots);

    expect(tracker.overlay().rows.map((row) => row.champion.name)).toEqual([
      "Mordekaiser",
      "Karthus",
      "Vex",
      "Jinx",
      "Leona",
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

    expect(tracker.overlay()).toEqual(NO_GAME);
  });

  it("signals the game ending and resets the overlay when the game feed goes away", () => {
    const tracker = createTracker();

    expect(tracker.feed(draft)).toBe("game-started");
    expect(tracker.feed(draft)).toBeUndefined();
    expect(loseFeed(tracker)).toBe("game-ended");

    expect(tracker.overlay()).toEqual(NO_GAME);
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
    expect(tracker.overlay()).toEqual(NO_GAME);
  });

  it("signals the game ending once on a GameEnd event, even while the feed is still up", () => {
    const tracker = createTracker();
    const ended = {
      ...draft,
      events: { Events: [...draft.events.Events, { EventID: 99, EventName: "GameEnd", EventTime: 1500, Result: "Win" }] },
    };

    tracker.feed(draft);

    expect(tracker.feed(ended)).toBe("game-ended");
    expect(tracker.overlay()).toEqual(NO_GAME);
    expect(tracker.feed(ended)).toBeUndefined();
    expect(loseFeed(tracker)).toBeUndefined();
  });

  it("ignores snapshots it cannot make sense of, and keeps tracking afterwards", () => {
    const tracker = createTracker();

    expect(tracker.feed({})).toBeUndefined();
    expect(tracker.feed({ ...draft, allPlayers: [] })).toBeUndefined();
    expect(tracker.overlay()).toEqual(NO_GAME);

    expect(tracker.feed(draft)).toBe("game-started");
    expect(tracker.feed({})).toBeUndefined();
    expect(tracker.overlay().rows).toHaveLength(5);
  });

  it("shows no Enemies when the active player is not in the game roster", () => {
    const tracker = createTracker();
    const spectating = { ...draft, activePlayer: { ...draft.activePlayer, riotId: "Nobody#0000" } };

    expect(tracker.feed(spectating)).toBeUndefined();

    expect(tracker.overlay()).toEqual(NO_GAME);
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

describe("Tracker Share Line", () => {
  /** The draft snapshot with the game clock at the given seconds. */
  const at = (gameTime: number) => ({ ...draft, gameData: { ...draft.gameData, gameTime } });

  it("gives the Ready Time as Mark time plus cooldown, rounded down to 10 seconds, as minutes and seconds with no colon", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(at(931.9));

    tracker.mark("Evelynn", "SummonerFlash");

    // Ready at 1231.9s on the game clock, which is 20:31.9, shown as 20:30.
    expect(tracker.shareLine()).toBe("2030 jg");
  });

  it("writes no leading zero under 10:00 and keeps two-digit seconds", () => {
    const tracker = createTracker({ now: () => 0 });
    // Ready at 9:30 (570s), which is one cooldown after a Mark at 4:30 (270s).
    tracker.feed(at(270));
    tracker.mark("Evelynn", "SummonerFlash");
    expect(tracker.shareLine()).toBe("930 jg");

    // Ready at 12:05 (725s), one cooldown after a Mark at 7:05 (425s); rounded down, the seconds are 00.
    const other = createTracker({ now: () => 0 });
    other.feed(at(425));
    other.mark("Evelynn", "SummonerFlash");
    expect(other.shareLine()).toBe("1200 jg");
  });

  it("lists the Flashes soonest Ready Time first, joined with single spaces", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(at(270));
    tracker.mark("Kaisa", "SummonerFlash"); // ready 9:30
    tracker.feed(at(310));
    tracker.mark("Evelynn", "SummonerFlash"); // ready 10:10
    tracker.feed(at(400));
    tracker.mark("Yone", "SummonerFlash"); // ready 11:40
    tracker.mark("Malzahar", "SummonerFlash"); // ready 11:40

    // Not Role order, and 9:30 sorts before 10:10 although "930" is the longer string.
    expect(tracker.shareLine()).toBe("930 bot 1010 jg 1140 top 1140 mid");
  });

  it("drops an Enemy from the Share Line once their Flash is back", () => {
    let wallMs = 0;
    const tracker = createTracker({ now: () => wallMs });
    tracker.feed(at(600));
    tracker.mark("Kaisa", "SummonerFlash"); // ready at 900
    wallMs = 60_000;
    tracker.mark("Evelynn", "SummonerFlash"); // ready at 960

    wallMs = 299_000;
    expect(tracker.shareLine()).toBe("1500 bot 1600 jg");
    wallMs = 300_000;
    expect(tracker.shareLine()).toBe("1600 jg");
    wallMs = 360_000;
    expect(tracker.shareLine()).toBe("");
  });

  it("leaves out every spell but Flash", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(withSpells(at(600), "Malzahar", "SummonerTeleport", "SummonerHeal"));

    tracker.mark("Malzahar", "SummonerTeleport");
    tracker.mark("Malzahar", "SummonerHeal");
    tracker.mark("Yone", "SummonerExhaust");

    expect(tracker.shareLine()).toBe("");
  });

  it("leaves out an Enemy without Flash, however they are Marked", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(withSpells(at(600), "Malzahar", "SummonerTeleport", "SummonerHeal"));

    tracker.mark("Malzahar", "SummonerFlash");
    tracker.mark("Evelynn", "SummonerFlash");

    expect(tracker.shareLine()).toBe("1500 jg");
  });

  it("is empty when nothing is Marked, when a Mark is cleared, and when there is no game", () => {
    const tracker = createTracker({ now: () => 0 });
    expect(tracker.shareLine()).toBe("");

    tracker.feed(at(600));
    expect(tracker.shareLine()).toBe("");

    tracker.mark("Evelynn", "SummonerFlash");
    tracker.clear("Evelynn", "SummonerFlash");
    expect(tracker.shareLine()).toBe("");

    tracker.mark("Evelynn", "SummonerFlash");
    loseFeed(tracker);
    expect(tracker.shareLine()).toBe("");
  });

  it("leaves out Enemies that have no Role, since a Share Line entry needs one", () => {
    const tracker = createTracker({ now: () => 0 });
    tracker.feed(withPositions(at(600), { Evelynn: "", Kaisa: "BOTTOM" }));
    tracker.mark("Kaisa", "SummonerFlash");

    expect(tracker.overlay().roleSetupNeeded).toBe(true);
    expect(tracker.shareLine()).toBe("");
  });
});
