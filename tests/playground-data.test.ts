import { describe, expect, it } from "vitest";
import { loadPlaygroundData } from "../src/playground-data.js";

const dataPath = new URL("../data/sample-pitches.csv", import.meta.url)
  .pathname;

describe("playground data", () => {
  it("builds safe pitcher and batter profiles", async () => {
    const data = await loadPlaygroundData(dataPath);

    expect(data.pitchers).toHaveLength(4);
    expect(data.batters).toHaveLength(6);
    expect(data.pitchers[0]).toMatchObject({
      id: "P100",
      name: "Alex Morgan",
      team: "CHC",
      hand: "right",
    });
    expect(data.pitchers[0]?.sliderVelocity).toBeGreaterThan(80);
    expect(data.pitchers[0]?.sliderWhiffRate).toBeGreaterThan(0);
    expect(data.batters[0]?.woba).toBeGreaterThan(0.2);
    expect(data.batters[0]?.contactRate).toBeGreaterThan(0.5);
  });
});
