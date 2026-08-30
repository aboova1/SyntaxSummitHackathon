import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileProject } from "../../src/compiler/project.js";

const study = readFileSync(
  new URL("../../examples/fastball-slider.seam", import.meta.url),
  "utf8",
);
const catalog = readFileSync(
  new URL("../../examples/seam.catalog.yml", import.meta.url),
  "utf8",
);

describe("execution planning", () => {
  it("builds a stable bounded graph", () => {
    const first = compileProject(study, catalog);
    const second = compileProject(study, catalog);

    expect(first.diagnostics).toEqual([]);
    expect(first.plan?.fingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(first.plan?.fingerprint).toBe(second.plan?.fingerprint);
    expect(first.plan?.nodes.map((node) => node.id)).toEqual([
      "read",
      "filter",
      "history",
      "primary",
      "baseline",
      "match",
      "predict",
      "simulate",
      "summary",
      "report",
    ]);
  });

  it("expands pitch groups and granular feature groups", () => {
    const result = compileProject(study, catalog);

    expect(result.plan?.primary?.pitchNames).toEqual([
      ["four-seam fastball", "sinker", "cutter"],
    ]);
    expect(result.plan?.target.pitchNames).toEqual(["slider"]);
    expect(result.plan?.features.featureColumns.length).toBeGreaterThan(40);
    expect(result.plan?.features.featureColumns).not.toContain("description");
    expect(result.plan?.features.matchColumns).toEqual([
      "pitcher_id",
      "balls",
      "strikes",
      "batter_side",
      "season",
    ]);
  });

  it("uses safe catalog facts when the study omits facts", () => {
    const simple = `data:\n  source: team pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  versus:\n    previous:\n      exclude: fastball\n      window: 2 pitches\n  method: model\n`;
    const result = compileProject(simple, catalog);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.features.source).toBe("catalog policy");
    expect(result.plan?.features.featureGroups).toContain("game situation");
  });

  it("generates parameterized SQL for both groups", () => {
    const result = compileProject(study, catalog);

    expect(result.sql?.text).toContain(
      'FROM "baseball"."analytics"."statcast_pitches"',
    );
    expect(result.sql?.text).toContain("'primary' AS analysis_group");
    expect(result.sql?.text).toContain("'baseline' AS analysis_group");
    expect(result.sql?.text).toContain("LAG(pitch_name, 2)");
    expect(result.sql?.text).not.toContain("2023");
    expect(result.sql?.parameters.slice(0, 4)).toEqual([
      2023,
      2024,
      2025,
      "regular season",
    ]);
    expect(result.sql?.parameters).toHaveLength(18);
  });

  it("compiles date and team filters into bounded SQL", () => {
    const filtered = study
      .replace(
        "games: regular season",
        "games: regular season\n  dates: 2025-04-01 through 2025-04-30\n  teams: CHC, MIL",
      )
      .replace("seasons: 2023 through 2025", "seasons: 2025");
    const result = compileProject(filtered, catalog);

    expect(result.diagnostics).toEqual([]);
    expect(result.sql?.text).toContain("game_date >= ? AND game_date <= ?");
    expect(result.sql?.text).toContain("pitching_team IN (?, ?)");
    expect(result.sql?.parameters).toEqual(
      expect.arrayContaining(["2025-04-01", "2025-04-30", "CHC", "MIL"]),
    );
  });

  it("changes the fingerprint when the question changes", () => {
    const changed = study.replace(
      "outcome: swing and miss",
      "outcome: contact",
    );

    expect(compileProject(study, catalog).plan?.fingerprint).not.toBe(
      compileProject(changed, catalog).plan?.fingerprint,
    );
  });
});
