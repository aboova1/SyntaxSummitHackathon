import { describe, expect, it } from "vitest";
import {
  parseDecisionSource,
  runPitchDecision,
  type PitchDecisionRequest,
} from "../src/decision.js";
import { loadPlaygroundData } from "../src/playground-data.js";

const dataPath = new URL("../data/sample-pitches.csv", import.meta.url)
  .pathname;

const situation = {
  pitcher: "P100",
  batter: "B100",
  count: "1-2",
  previousPitch: "four-seam fastball",
  previousLocation: "high and inside" as const,
  previousResult: "foul",
  outs: 1,
  runners: "first",
  score: "tied",
};

describe("next-pitch decisions", () => {
  it("returns one complete outcome distribution", async () => {
    const data = await loadPlaygroundData(dataPath);
    const request: PitchDecisionRequest = {
      study: "Test slider",
      situation,
      question: { kind: "predict", pitch: "slider", location: "low and away" },
    };
    const result = runPitchDecision(request, data);
    const total = result.selected.outcomes.reduce(
      (sum, item) => sum + item.chance,
      0,
    );

    expect(result.selected.outcomes).toHaveLength(6);
    expect(total).toBeCloseTo(1, 10);
    expect(result.trials).toBe(40_000);
    expect(JSON.stringify(result)).not.toContain("seed");
  });

  it("ranks unique pitches from the selected arsenal", async () => {
    const data = await loadPlaygroundData(dataPath);
    const request: PitchDecisionRequest = {
      study: "Recommend a call",
      situation,
      question: { kind: "recommend", goal: "swing and miss" },
    };
    const result = runPitchDecision(request, data);
    const recommendations = result.recommendations ?? [];

    expect(recommendations).toHaveLength(3);
    expect(new Set(recommendations.map((item) => item.pitch)).size).toBe(3);
    expect(recommendations[0]!.goalChance).toBeGreaterThanOrEqual(
      recommendations[1]!.goalChance ?? 0,
    );
  });

  it("parses facts separately from the question", async () => {
    const data = await loadPlaygroundData(dataPath);
    const source = `study: Next pitch\n\nsource: synthetic demo pitches\n\nsituation:\n  pitcher: Alex Morgan\n  batter: Taylor Kim\n  count: 1-2\n  previous pitch: four-seam fastball\n  previous location: high and inside\n  previous result: foul\n  outs: 1\n  runners: first\n  score: tied\n\nquestion:\n  best pitch for: any strike\n`;
    const parsed = parseDecisionSource(source, data);

    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.request?.situation.count).toBe("1-2");
    expect(parsed.request?.question).toEqual({
      kind: "recommend",
      goal: "any strike",
    });
  });
});
