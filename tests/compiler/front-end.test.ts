import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileFrontEnd } from "../../src/compiler/compile.js";

const example = readFileSync(
  new URL("../../examples/fastball-slider.seam", import.meta.url),
  "utf8",
);

const codes = (source: string): readonly string[] =>
  compileFrontEnd(source).diagnostics.map((diagnostic) => diagnostic.code);

describe("SeamScript front end", () => {
  it("compiles the reduced example", () => {
    const result = compileFrontEnd(example);

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.version).toBe("0.2");
    expect(result.document?.analyze.target).toMatchObject({
      pitch: "slider",
      outcome: "swing and miss",
      horizon: "this pitch",
    });
    expect(result.document?.analyze.when?.previous).toMatchObject({
      kind: "sequence",
      pitches: ["fastball"],
      window: 2,
    });
    expect(result.document?.analyze.versus?.previous.kind).toBe("exclude");
    expect(result.document?.analyze.facts?.accountFor).toContain("ballpark");
    expect(result.document?.analyze.report).toContainEqual(
      expect.objectContaining({ kind: "examples", count: 5 }),
    );
  });

  it("accepts a minimal observed study", () => {
    const result = compileFrontEnd(
      `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: swing and miss\n    horizon: this pitch\n  method: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.analyze.report).toEqual([]);
    expect(result.document?.use).toBeUndefined();
  });

  it("parses one inclusive date range", () => {
    const result = compileFrontEnd(
      `data:\n  source: public pitches\n  dates: 2025-04-01 through 2025-04-30\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  method: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.data.dates).toEqual({
      start: "2025-04-01",
      end: "2025-04-30",
    });
  });

  it("rejects an invalid date range", () => {
    expect(
      codes(
        `data:\n  source: public pitches\n  dates: 2025-04-31 through 2025-04-01\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  method: observed\n`,
      ),
    ).toContain("S212");
  });

  it("accepts an ordered multi-pitch history", () => {
    const result = compileFrontEnd(
      `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  when:\n    previous:\n      sequence: changeup, fastball\n      window: 3 pitches\n  method: model\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.analyze.when?.previous.pitches).toEqual([
      "changeup",
      "fastball",
    ]);
  });

  it("rejects old redundant top-level blocks", () => {
    const resultCodes = codes(
      `study: Old form\n\ndata:\n  source: public pitches\n\nsequence:\n  - fastball\n  - slider within 2 pitches\n\nestimate:\n  event: swing and miss\n`,
    );

    expect(resultCodes.filter((code) => code === "S202")).toHaveLength(2);
    expect(resultCodes).toContain("S203");
  });

  it("keeps prediction keys out of facts", () => {
    const result = compileFrontEnd(
      `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: swing and miss\n    horizon: this pitch\n  facts:\n    outcome: contact\n  method: model\n`,
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "S202",
          message: expect.stringContaining("outcome"),
        }),
      ]),
    );
  });

  it("rejects a sequence that cannot fit inside its window", () => {
    expect(
      codes(
        `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  when:\n    previous:\n      sequence: changeup, fastball\n      window: 1 pitch\n  method: observed\n`,
      ),
    ).toContain("S224");
  });

  it("rejects a plate-appearance outcome for one pitch", () => {
    expect(
      codes(
        `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: strikeout\n    horizon: this pitch\n  method: model\n`,
      ),
    ).toContain("S231");
  });

  it("rejects a one-pitch outcome for a plate appearance", () => {
    expect(
      codes(
        `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: called strike\n    horizon: plate appearance\n  method: model\n`,
      ),
    ).toContain("S232");
  });

  it("requires an anchor pitch for a plate-appearance target", () => {
    expect(
      codes(
        `data:\n  source: public pitches\n\nanalyze:\n  target:\n    outcome: strikeout\n    horizon: plate appearance\n  method: model\n`,
      ),
    ).toContain("S230");
  });

  it("reports duplicate keys", () => {
    expect(
      codes(
        `data:\n  source: first\n  source: second\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  method: observed\n`,
      ),
    ).toContain("S201");
  });

  it("reports tabs before parsing", () => {
    expect(codes("data:\n\tsource: public pitches\n")).toContain("S001");
  });

  it("suggests the nearest key", () => {
    const result = compileFrontEnd(
      `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    result: contact\n    horizon: this pitch\n  method: observed\n`,
    );
    const diagnostic = result.diagnostics.find((item) => item.code === "S202");

    expect(diagnostic?.hint).toBe("Use 'outcome'.");
  });

  it("accepts full-line comments and Windows line endings", () => {
    const result = compileFrontEnd(
      "# study\r\ndata:\r\n  source: public pitches\r\n\r\nanalyze:\r\n  target:\r\n    pitch: slider\r\n    outcome: contact\r\n    horizon: this pitch\r\n  method: observed\r\n",
    );

    expect(result.diagnostics).toEqual([]);
  });
});
