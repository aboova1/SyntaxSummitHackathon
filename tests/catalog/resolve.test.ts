import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCatalog } from "../../src/catalog/load.js";
import { resolveCatalog } from "../../src/catalog/resolve.js";
import { compileFrontEnd } from "../../src/compiler/compile.js";

const studySource = readFileSync(
  new URL("../../examples/fastball-slider.seam", import.meta.url),
  "utf8",
);
const catalogSource = readFileSync(
  new URL("../../examples/seam.catalog.yml", import.meta.url),
  "utf8",
);

describe("catalog resolution", () => {
  it("resolves all required resources", () => {
    const document = compileFrontEnd(studySource).document;
    const catalog = parseCatalog(catalogSource).catalog;
    expect(document).toBeDefined();
    expect(catalog).toBeDefined();
    if (!document || !catalog) return;

    const result = resolveCatalog(document, catalog);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.data.name).toBe("team pitches");
    expect(result.plan?.model?.resource.registry.alias).toBe("champion");
    expect(result.plan?.comparison?.resource.connector).toBe("openapi");
    expect(result.plan?.simulation?.name).toBe("adaptive event simulation");
    expect(result.plan?.policy.initial_trials).toBe(10_000);
  });

  it("uses catalog defaults when the resources block is absent", () => {
    const document = compileFrontEnd(
      `source: team pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: model\n`,
    ).document;
    const catalog = parseCatalog(catalogSource).catalog;
    if (!document || !catalog) throw new Error("fixture did not compile");

    const result = resolveCatalog(document, catalog);

    expect(result.diagnostics).toEqual([]);
    expect(result.plan?.model?.name).toBe("approved pitch event");
  });

  it("does not resolve unused model resources for observed work", () => {
    const document = compileFrontEnd(
      `source: team pitches\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`,
    ).document;
    const catalog = parseCatalog(catalogSource).catalog;
    if (!document || !catalog) throw new Error("fixture did not compile");

    const result = resolveCatalog(document, catalog);

    expect(result.plan?.model).toBeUndefined();
    expect(result.diagnostics).toEqual([]);
  });

  it("reports a missing required resource", () => {
    const document = compileFrontEnd(studySource).document;
    const catalog = parseCatalog(catalogSource).catalog;
    if (!document || !catalog) throw new Error("fixture did not compile");

    const broken = {
      ...catalog,
      algorithms: {},
      defaults: {
        ...catalog.defaults,
        comparison: undefined,
        simulation: undefined,
      },
    };
    const result = resolveCatalog(document, broken);

    expect(result.plan).toBeUndefined();
    expect(
      result.diagnostics.filter((item) => item.code === "S311"),
    ).toHaveLength(2);
  });

  it("reports invalid catalog contracts", () => {
    const result = parseCatalog("catalog: bad\nversion: 1\n");

    expect(result.catalog).toBeUndefined();
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "S301" }),
    );
  });
});
