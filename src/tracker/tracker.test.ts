import { describe, expect, it } from "vitest";
import customVsBots from "../../fixtures/custom-vs-bots.json";
import draft from "../../fixtures/draft-summoners-rift.json";
import { createTracker } from "./tracker";

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
    expect(tracker.feed(null)).toBe("game-ended");

    expect(tracker.overlay()).toEqual({ visible: false, rows: [] });
    expect(tracker.feed(null)).toBeUndefined();
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
    expect(tracker.feed(null)).toBeUndefined();
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

  it("picks up a new game after the last one ended", () => {
    const tracker = createTracker();

    tracker.feed(draft);
    tracker.feed(null);

    expect(tracker.feed(draft)).toBe("game-started");
    expect(tracker.overlay().rows).toHaveLength(5);
  });
});
