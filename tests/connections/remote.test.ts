import { afterEach, describe, expect, it } from "vitest";
import { parseConnections } from "../../src/connections/load.js";
import { requestJson, type FetchFunction } from "../../src/connections/http.js";
import { compileProject } from "../../src/compiler/project.js";
import { readHttpData } from "../../src/runtime/http-data.js";
import {
  OpenApiComparisonAlgorithm,
  OpenApiSimulationAlgorithm,
} from "../../src/runtime/remote-algorithms.js";
import {
  KServeOutcomeModel,
  resolveModelVersion,
} from "../../src/runtime/remote-model.js";
import type { SelectedPitch } from "../../src/runtime/types.js";

const profile = parseConnections(
  `connections:\n  service:\n    base_url: https://service.test\n    timeout_ms: 1000\n    retries: 1\n    operations:\n      query:\n        path: /query\n        method: POST\n      compare:\n        path: /compare\n        method: POST\n      simulate:\n        path: /simulate\n        method: POST\n`,
).profiles?.connections.service;

if (!profile) throw new Error("connection fixture did not parse");

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  delete process.env.SEAM_TEST_TOKEN;
});

describe("remote connectors", () => {
  it("retries a transient read with one idempotency key", async () => {
    const keys: string[] = [];
    let calls = 0;
    const mockFetch: FetchFunction = async (_input, init) => {
      calls += 1;
      keys.push(new Headers(init?.headers).get("idempotency-key") ?? "");
      return calls === 1 ? json({ error: "busy" }, 503) : json({ ok: true });
    };

    await expect(
      requestJson<{ ok: boolean }>(profile, "/status", {}, mockFetch),
    ).resolves.toEqual({
      ok: true,
    });
    expect(calls).toBe(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not retry a permanent client error", async () => {
    let calls = 0;
    const mockFetch: FetchFunction = async () => {
      calls += 1;
      return json({ error: "bad" }, 400);
    };

    await expect(
      requestJson(profile, "/status", {}, mockFetch),
    ).rejects.toThrow("HTTP 400");
    expect(calls).toBe(1);
  });

  it("reads credentials only from the named environment variable", async () => {
    const secure = { ...profile, token_env: "SEAM_TEST_TOKEN" };

    await expect(
      requestJson(secure, "/status", {}, async () => json({})),
    ).rejects.toThrow("SEAM_TEST_TOKEN");
    process.env.SEAM_TEST_TOKEN = "private-token";
    const mockFetch: FetchFunction = async (_input, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer private-token",
      );
      return json({ ok: true });
    };
    await expect(
      requestJson(secure, "/status", {}, mockFetch),
    ).resolves.toEqual({ ok: true });
  });

  it("sends a bounded remote data request", async () => {
    const study = `source: remote pitches\n\nscope:\n  counts: 1-2\n\ntarget:\n  event: contact\n  pitch: slider\n\nevidence: observed\n`;
    const catalog = `catalog: remote test\nversion: 1\ndata:\n  remote pitches:\n    connector: http json\n    connection: service\n    object: baseball.pitches\n    contract: seam.pitch.v1\n    access: read only\npolicy:\n  default_match: []\n  default_feature_groups: []\n`;
    const plan = compileProject(study, catalog).plan;
    if (!plan) throw new Error("remote fixture did not compile");
    const mockFetch: FetchFunction = async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        dataset: string;
        columns: readonly string[];
        filters: { readonly counts?: readonly string[] };
        target_filters: { readonly counts: readonly string[] };
        plan_fingerprint: string;
      };
      expect(body.dataset).toBe("baseball.pitches");
      expect(body.columns).toContain("pitch_name");
      expect(body.filters.counts).toBeUndefined();
      expect(body.target_filters.counts).toEqual(["1-2"]);
      expect(body.plan_fingerprint).toBe(plan.fingerprint);
      return json({
        snapshot: "warehouse-snapshot-7",
        records: [
          {
            game_id: "G1",
            plate_appearance_id: "PA1",
            pitch_number: 1,
            season: 2024,
            game_type: "regular season",
            pitcher_id: "P1",
            batter_id: "B1",
            pitch_name: "slider",
            description: "foul",
            plate_appearance_result: "field out",
            balls: 1,
            strikes: 2,
          },
        ],
      });
    };

    const result = await readHttpData(
      plan.resources.data.resource,
      profile,
      plan,
      mockFetch,
    );

    expect(result.snapshot).toBe("warehouse-snapshot-7");
    expect(result.records).toHaveLength(1);
  });

  it("resolves an MLflow alias and freezes its approval tags", async () => {
    const resource = {
      registry: {
        connector: "mlflow" as const,
        connection: "registry",
        name: "pitch-outcome",
        alias: "champion",
      },
      serving: {
        connector: "kserve v2" as const,
        connection: "serving",
        name: "pitch-outcome",
      },
      input: "seam.pitch.features.v1",
      output: "seam.pitch.outcomes.v1",
      require: { status: "approved" as const, calibration: "passed" as const },
    };
    const mockFetch: FetchFunction = async (input) => {
      expect(String(input)).toContain("alias=champion");
      return json({
        model_version: {
          name: "pitch-outcome",
          version: "17",
          source: "runs:/abc/model",
          tags: [
            { key: "seam.status", value: "approved" },
            { key: "seam.calibration", value: "passed" },
            { key: "seam.training_cutoff", value: "2025-03-01" },
            { key: "seam.digest", value: "digest-17" },
          ],
        },
      });
    };

    await expect(
      resolveModelVersion(resource, profile, mockFetch),
    ).resolves.toEqual({
      version: "17",
      digest: "digest-17",
      trainingCutoff: "2025-03-01",
      status: "approved",
      calibration: "passed",
    });
  });

  it("calls an exact KServe version with contract-bound features", async () => {
    const resource = {
      registry: {
        connector: "static" as const,
        name: "pitch-outcome",
        version: "17",
      },
      serving: {
        connector: "kserve v2" as const,
        connection: "serving",
        name: "pitch-outcome",
      },
      input: "seam.pitch.features.v1",
      output: "seam.pitch.outcomes.v1",
      training_cutoff: "2024-12-31",
    };
    const frozen = await resolveModelVersion(resource, undefined);
    const calls: string[] = [];
    const mockFetch: FetchFunction = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith("/infer")) {
        const body = JSON.parse(String(init?.body)) as {
          inputs: readonly { readonly data: readonly string[] }[];
        };
        expect(body.inputs[0]?.data[0]).toContain('"balls":1');
        return json({ outputs: [{ name: "probability", data: [0.37] }] });
      }
      return json({
        name: "pitch-outcome",
        versions: ["17"],
        platform: "test",
        inputs: [{ name: "features", datatype: "BYTES", shape: [-1] }],
        outputs: [{ name: "probability", datatype: "FP64", shape: [-1] }],
      });
    };
    const model = new KServeOutcomeModel(
      resource,
      profile,
      frozen,
      ["balls"],
      mockFetch,
    );
    const row: SelectedPitch = {
      group: "primary",
      record: { balls: 1 },
      history: [],
      outcome: 0,
      weight: 1,
    };

    await expect(model.describe()).resolves.toMatchObject({ version: "17" });
    await expect(
      model.predict(
        [row],
        {
          pitchNames: ["slider"],
          sourcePitch: "slider",
          event: "swing and miss",
          period: "this pitch",
        },
        ["balls"],
      ),
    ).resolves.toEqual([{ probability: 0.37 }]);
    expect(calls.every((url) => url.includes("/versions/17"))).toBe(true);
  });

  it("applies remote comparison weights", async () => {
    const resource = {
      connector: "openapi" as const,
      connection: "service",
      operation: "compare",
      release: "1.2.3",
      input: "input.v1",
      output: "output.v1",
    };
    const rows: SelectedPitch[] = [
      {
        group: "primary",
        record: { pitcher_id: "P1" },
        history: [],
        outcome: 1,
        weight: 1,
      },
      {
        group: "baseline",
        record: { pitcher_id: "P1" },
        history: [],
        outcome: 0,
        weight: 1,
      },
    ];
    const algorithm = new OpenApiComparisonAlgorithm(
      resource,
      profile,
      async () =>
        json({
          weights: [
            { index: 0, weight: 0.5 },
            { index: 1, weight: 0.5 },
          ],
          raw_primary: 1,
          raw_baseline: 1,
          matched_primary: 0.5,
          matched_baseline: 0.5,
          strata: 1,
        }),
    );

    const result = await algorithm.run(rows, ["pitcher_id"]);

    expect(result.rows.map((row) => row.weight)).toEqual([0.5, 0.5]);
  });

  it("rejects inconsistent remote comparison counts", async () => {
    const algorithm = new OpenApiComparisonAlgorithm(
      {
        connector: "openapi",
        connection: "service",
        operation: "compare",
        release: "1.2.3",
        input: "input.v1",
        output: "output.v1",
      },
      profile,
      async () =>
        json({
          weights: [{ index: 0, weight: 1 }],
          raw_primary: 99,
          raw_baseline: 0,
          matched_primary: 1,
          matched_baseline: 0,
          strata: 0,
        }),
    );
    const row: SelectedPitch = {
      group: "primary",
      record: {},
      history: [],
      outcome: 1,
      weight: 1,
    };

    await expect(algorithm.run([row], [])).rejects.toThrow(
      "invalid raw counts",
    );
  });

  it("keeps a remote simulation seed protected", async () => {
    const resource = {
      connector: "openapi" as const,
      connection: "service",
      operation: "simulate",
      release: "2.0.0",
      input: "input.v1",
      output: "output.v1",
    };
    let sentSeed = "";
    const algorithm = new OpenApiSimulationAlgorithm(
      resource,
      profile,
      async (_input, init) => {
        sentSeed = (JSON.parse(String(init?.body)) as { seed: string }).seed;
        return json({
          trials: 40_000,
          chance: 0.31,
          half_width: 0.0045,
          stopped_because: "error limit passed",
        });
      },
    );

    const result = await algorithm.run(
      [0.3],
      [1],
      {
        initialTrials: 10_000,
        maximumTrials: 100_000,
        maximumHalfWidth: 0.005,
      },
      ["frozen"],
    );

    expect(result.evidence.trials).toBe(40_000);
    expect(result.protectedSeed).toBe(sentSeed);
    expect(JSON.stringify(result.evidence)).not.toContain(sentSeed);
  });

  it("checks the remote simulation stopping claim", async () => {
    const algorithm = new OpenApiSimulationAlgorithm(
      {
        connector: "openapi",
        connection: "service",
        operation: "simulate",
        release: "2.0.0",
        input: "input.v1",
        output: "output.v1",
      },
      profile,
      async () =>
        json({
          trials: 10_000,
          chance: 0.5,
          half_width: 0.02,
          stopped_because: "error limit passed",
        }),
    );

    await expect(
      algorithm.run(
        [0.5],
        [1],
        {
          initialTrials: 10_000,
          maximumTrials: 100_000,
          maximumHalfWidth: 0.005,
        },
        ["frozen"],
      ),
    ).rejects.toThrow("invalid stopping result");
  });
});
