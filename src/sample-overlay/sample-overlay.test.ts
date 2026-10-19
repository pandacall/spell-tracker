import { describe, expect, it } from "vitest";
import { sampleOverlay } from "./sample-overlay";

describe("sampleOverlay", () => {
  it("shows five sample Enemies in Role order, each with Flash", () => {
    const state = sampleOverlay(0);
    expect(state).toMatchObject({ visible: true, roleSetupNeeded: false });
    expect(state.rows.map((r) => r.role)).toEqual(["top", "jg", "mid", "bot", "sup"]);
    expect(state.rows.every((r) => r.spells[0].id === "SummonerFlash")).toBe(true);
  });

  it("runs exactly one Countdown, on mid's Flash, looping from 5:00", () => {
    const countdowns = (t: number) =>
      sampleOverlay(t).rows.flatMap((r) =>
        r.spells.filter((s) => s.countdown !== undefined).map((s) => [r.role, s.id, s.countdown]),
      );
    expect(countdowns(0)).toEqual([["mid", "SummonerFlash", 300]]);
    expect(countdowns(299.5)).toEqual([["mid", "SummonerFlash", 1]]);
    expect(countdowns(300)).toEqual([["mid", "SummonerFlash", 300]]);
  });

  it("omits the countdown property entirely on spells that are not counting down", () => {
    const spells = sampleOverlay(0).rows.flatMap((r) => r.spells);
    const withoutCountdown = spells.filter((s) => !("countdown" in s));
    expect(withoutCountdown).toHaveLength(9);
  });
});
