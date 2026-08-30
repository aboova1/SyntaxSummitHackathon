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
    expect(result.document?.version).toBe("0.3");
    expect(result.document).not.toHaveProperty("data");
    expect(result.document).not.toHaveProperty("use");
    expect(result.document).not.toHaveProperty("analyze");
    expect(result.document?.target).toMatchObject({
      pitch: "slider",
      event: "swing and miss",
      period: "this pitch",
    });
    expect(result.document?.sequence?.after).toMatchObject({
      kind: "sequence",
      pitches: ["fastball"],
      lookback: 2,
    });
    expect(result.document?.sequence?.versus?.kind).toBe("exclude");
    expect(result.document?.sequence?.versus?.lookback).toBe(2);
    expect(result.document?.facts?.consider).toContain("ballpark");
    expect(result.document?.resources).toMatchObject({
      model: "approved pitch event",
      matching: "matched comparison",
      simulator: "adaptive event simulation",
    });
    expect(result.document?.include).toContainEqual(
      expect.objectContaining({ kind: "examples", count: 5 }),
    );
  });

  it("accepts a minimal observed study", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: swing and miss\n  pitch: slider\n\nevidence: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.include).toEqual([]);
    expect(result.document?.resources).toBeUndefined();
  });

  it("parses one inclusive date range", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\nscope:\n  dates: 2025-04-01 through 2025-04-30\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.scope?.dates).toEqual({
      start: "2025-04-01",
      end: "2025-04-30",
    });
  });

  it("parses game-plan count and batter-side filters", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\nscope:\n  counts: 0-0, 1-2, 2-2\n  batter sides: left, right\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.scope?.counts).toEqual(["0-0", "1-2", "2-2"]);
    expect(result.document?.scope?.batterSides).toEqual(["left", "right"]);
  });

  it("rejects an impossible baseball count", () => {
    expect(
      codes(
        `source: public pitches\n\nscope:\n  counts: 4-2\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
      ),
    ).toContain("S214");
  });

  it("rejects an invalid date range", () => {
    expect(
      codes(
        `source: public pitches\n\nscope:\n  dates: 2025-04-31 through 2025-04-01\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
      ),
    ).toContain("S212");
  });

  it("accepts an ordered multi-pitch history", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nsequence:\n  after: changeup, fastball\n  lookback: 3 pitches\n\nevidence: model\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.sequence?.after.pitches).toEqual([
      "changeup",
      "fastball",
    ]);
  });

  it("uses one lookback for both sequence groups", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nsequence:\n  after: changeup, fastball\n  versus: after curveball\n  lookback: 3 pitches\n\nevidence: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.sequence?.after).toMatchObject({
      kind: "sequence",
      pitches: ["changeup", "fastball"],
      lookback: 3,
    });
    expect(result.document?.sequence?.versus).toMatchObject({
      kind: "sequence",
      pitches: ["curveball"],
      lookback: 3,
    });
  });

  it("infers the target period from an unambiguous event", () => {
    const onePitch = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
    );
    const plateAppearance = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: strikeout\n  pitch: slider\n\nevidence: observed\n`,
    );

    expect(onePitch.document?.target.period).toBe("this pitch");
    expect(plateAppearance.document?.target.period).toBe("plate appearance");
  });

  it("uses an explicit period for the shared ball-in-play event", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: ball in play\n  pitch: slider\n  period: plate appearance\n\nevidence: observed\n`,
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.document?.target.period).toBe("plate appearance");
  });

  it("rejects an unclear versus value", () => {
    expect(
      codes(
        `source: public pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nsequence:\n  after: fastball\n  versus: curveball\n  lookback: 2 pitches\n\nevidence: observed\n`,
      ),
    ).toContain("S222");
  });

  it("gives direct migration hints for the old wrapper blocks", () => {
    const result = compileFrontEnd(
      `data:\n  source: public pitches\n\nanalyze:\n  target:\n    pitch: slider\n    outcome: contact\n    horizon: this pitch\n  method: observed\n`,
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "S202", hint: "Use 'source'." }),
        expect.objectContaining({ code: "S202", hint: "Use 'target'." }),
      ]),
    );
  });

  it("keeps prediction keys out of facts", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  event: swing and miss\n  pitch: slider\n\nfacts:\n  event: contact\n\nevidence: model\n`,
    );

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "S202",
          message: expect.stringContaining("event"),
        }),
      ]),
    );
  });

  it("rejects a sequence that cannot fit inside its window", () => {
    expect(
      codes(
        `source: public pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nsequence:\n  after: changeup, fastball\n  lookback: 1 pitch\n\nevidence: observed\n`,
      ),
    ).toContain("S224");
  });

  it("rejects a plate-appearance outcome for one pitch", () => {
    expect(
      codes(
        `source: public pitches\n\ntarget:\n  event: strikeout\n  pitch: slider\n  period: this pitch\n\nevidence: model\n`,
      ),
    ).toContain("S231");
  });

  it("rejects a one-pitch outcome for a plate appearance", () => {
    expect(
      codes(
        `source: public pitches\n\ntarget:\n  event: called strike\n  pitch: slider\n  period: plate appearance\n\nevidence: model\n`,
      ),
    ).toContain("S232");
  });

  it("requires an anchor pitch for a plate-appearance target", () => {
    expect(
      codes(
        `source: public pitches\n\ntarget:\n  event: strikeout\n\nevidence: model\n`,
      ),
    ).toContain("S230");
  });

  it("reports duplicate keys", () => {
    expect(
      codes(
        `source: first\nsource: second\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
      ),
    ).toContain("S201");
  });

  it("reports tabs before parsing", () => {
    expect(codes("source: public pitches\n\ttarget: invalid\n")).toContain(
      "S001",
    );
  });

  it("suggests the nearest key", () => {
    const result = compileFrontEnd(
      `source: public pitches\n\ntarget:\n  pitch: slider\n  result: contact\n\nevidence: observed\n`,
    );
    const diagnostic = result.diagnostics.find((item) => item.code === "S202");

    expect(diagnostic?.hint).toBe("Use 'event'.");
  });

  it("accepts full-line comments and Windows line endings", () => {
    const result = compileFrontEnd(
      "# study\r\nsource: public pitches\r\n\r\ntarget:\r\n  event: contact\r\n  pitch: slider\r\n\r\nevidence: observed\r\n",
    );

    expect(result.diagnostics).toEqual([]);
  });
});
