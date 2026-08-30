import { describe, expect, it } from "vitest";
import {
  BASEBALL_FIELDS,
  columnsForMatchFields,
  fieldsForFeatureGroups,
} from "../../src/domain/baseball-fields.js";

describe("baseball field registry", () => {
  it("contains broad pre-pitch context", () => {
    const groups = new Set(BASEBALL_FIELDS.map((field) => field.group));

    expect(groups).toEqual(
      new Set([
        "identity",
        "target label",
        "batter history",
        "pitcher form",
        "pitch shape",
        "sequence history",
        "game situation",
        "ballpark",
        "defense",
      ]),
    );
  });

  it("never selects post-pitch fields as model facts", () => {
    const fields = fieldsForFeatureGroups([
      "batter history",
      "pitcher form",
      "pitch shape",
      "sequence history",
      "game situation",
      "ballpark",
      "defense",
    ]);

    expect(fields.length).toBeGreaterThan(40);
    expect(fields.every((field) => field.availability === "before pitch")).toBe(
      true,
    );
    expect(fields.map((field) => field.name)).not.toContain("description");
    expect(fields.map((field) => field.name)).not.toContain("exit_velocity");
  });

  it("expands exact matching fields without duplicates", () => {
    expect(columnsForMatchFields(["count", "base state", "count"])).toEqual([
      "balls",
      "strikes",
      "runner_on_first",
      "runner_on_second",
      "runner_on_third",
    ]);
  });
});
