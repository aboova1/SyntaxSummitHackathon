import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileProject } from "../../src/compiler/project.js";
import { executePlan } from "../../src/runtime/execute.js";
import { matchGroups } from "../../src/runtime/match.js";
import { toPublicResult } from "../../src/runtime/public-result.js";
import { selectPitches } from "../../src/runtime/select.js";
import { runAdaptiveSimulation } from "../../src/runtime/simulation.js";
import type { PitchRecord, SelectedPitch } from "../../src/runtime/types.js";

const study = readFileSync(
  new URL("../../examples/demo.seam", import.meta.url),
  "utf8",
);
const catalog = readFileSync(
  new URL("../../examples/demo.catalog.yml", import.meta.url),
  "utf8",
);

const demoPlan = () => {
  const result = compileProject(study, catalog);
  if (!result.plan) throw new Error(JSON.stringify(result.diagnostics));
  return result.plan;
};

describe("local runtime", () => {
  it("runs the complete demonstration", async () => {
    const executed = await executePlan(demoPlan(), {
      catalogDirectory: "examples",
    });

    expect(executed.diagnostics).toEqual([]);
    expect(executed.result?.primary.matchedCount).toBe(720);
    expect(executed.result?.baseline?.matchedCount).toBe(720);
    expect(executed.result?.primary.observedRate).toBeCloseTo(1 / 3, 8);
    expect(executed.result?.audit.trials).toBe(40_000);
    expect(executed.result?.difference?.simulated).toBeGreaterThan(0.08);
    expect(executed.result?.examples).toHaveLength(5);
    expect(executed.result?.views?.zoneMap?.primary.length).toBeGreaterThan(0);
    expect(
      executed.result?.views?.zoneMap?.primary.every(
        (cell) =>
          cell.column >= 0 && cell.column < 5 && cell.row >= 0 && cell.row < 5,
      ),
    ).toBe(true);
    expect(executed.result?.primary.modelUncertainty?.status).toBe(
      "unavailable",
    );
    expect(executed.result?.difference?.observedInterval.low).toBeLessThan(
      executed.result?.difference?.observed ?? 0,
    );
  });

  it("produces the same result for the same frozen inputs", async () => {
    const plan = demoPlan();
    const first = await executePlan(plan, { catalogDirectory: "examples" });
    const second = await executePlan(plan, { catalogDirectory: "examples" });

    expect(first.result?.primary.simulatedChance).toBe(
      second.result?.primary.simulatedChance,
    );
    expect(first.result?.protectedAudit.seeds).toEqual(
      second.result?.protectedAudit.seeds,
    );
  });

  it("keeps protected seeds out of normal output", async () => {
    const executed = await executePlan(demoPlan(), {
      catalogDirectory: "examples",
    });
    if (!executed.result) throw new Error("demo did not execute");
    const serialized = JSON.stringify(toPublicResult(executed.result));

    expect(serialized).not.toContain("seed");
    expect(serialized).not.toContain(
      executed.result.protectedAudit.seeds.primary ?? "missing",
    );
  });

  it("does not carry sequence history across plate appearances", () => {
    const plan = demoPlan();
    const records: PitchRecord[] = [
      {
        game_id: "G1",
        plate_appearance_id: "PA1",
        pitch_number: 1,
        season: 2024,
        game_type: "regular season",
        pitch_name: "four-seam fastball",
        description: "ball",
      },
      {
        game_id: "G1",
        plate_appearance_id: "PA2",
        pitch_number: 1,
        season: 2024,
        game_type: "regular season",
        pitch_name: "slider",
        description: "swinging strike",
      },
    ];

    expect(
      selectPitches(records, plan).filter((row) => row.group === "primary"),
    ).toHaveLength(0);
  });

  it("balances exact strata with weights", () => {
    const make = (
      group: "primary" | "baseline",
      pitcher: string,
      outcome: 0 | 1,
    ): SelectedPitch => ({
      group,
      record: { pitcher_id: pitcher },
      history: [],
      outcome,
      weight: 1,
    });
    const result = matchGroups(
      [
        make("primary", "P1", 1),
        make("primary", "P1", 0),
        make("baseline", "P1", 0),
        make("primary", "P2", 1),
      ],
      ["pitcher_id"],
    );

    expect(result.rows).toHaveLength(3);
    expect(result.matchedPrimary).toBe(1);
    expect(result.matchedBaseline).toBe(1);
    expect(result.strata).toBe(1);
    expect(
      result.rows
        .filter((row) => row.group === "primary")
        .map((row) => row.weight),
    ).toEqual([0.5, 0.5]);
  });

  it("increases trials until the error rule passes", () => {
    const first = runAdaptiveSimulation(
      [0.5],
      [1],
      {
        initialTrials: 10_000,
        maximumTrials: 100_000,
        maximumHalfWidth: 0.005,
      },
      ["same"],
    );
    const second = runAdaptiveSimulation(
      [0.5],
      [1],
      {
        initialTrials: 10_000,
        maximumTrials: 100_000,
        maximumHalfWidth: 0.005,
      },
      ["same"],
    );

    expect(first.evidence.trials).toBe(40_000);
    expect(first.evidence.halfWidth).toBeLessThanOrEqual(0.005);
    expect(first).toEqual(second);
  });

  it("rejects invalid simulation inputs", () => {
    const policy = {
      initialTrials: 10_000,
      maximumTrials: 100_000,
      maximumHalfWidth: 0.005,
    };

    expect(() => runAdaptiveSimulation([1.1], [1], policy, ["bad"])).toThrow(
      "between zero and one",
    );
    expect(() =>
      runAdaptiveSimulation([0.5, 0.5], [1], policy, ["bad"]),
    ).toThrow("one weight");
  });

  it("stops on the catalog minimum", async () => {
    const plan = demoPlan();
    const strictPlan = {
      ...plan,
      resources: {
        ...plan.resources,
        policy: { ...plan.resources.policy, minimum_group_size: 10_000 },
      },
    };
    const executed = await executePlan(strictPlan, {
      catalogDirectory: "examples",
    });

    expect(executed.result).toBeUndefined();
    expect(executed.diagnostics.map((item) => item.code)).toEqual([
      "S501",
      "S502",
    ]);
  });
});
