import { z } from "zod";
import type { AlgorithmResource } from "../catalog/schema.js";
import { requestJson, type FetchFunction } from "../connections/http.js";
import type { ConnectionProfile } from "../connections/schema.js";
import type { ComparisonAlgorithm, SimulationAlgorithm } from "./algorithms.js";
import type { MatchResult } from "./match.js";
import {
  protectedSeedFor,
  type SimulationPolicy,
  type SimulationResult,
} from "./simulation.js";
import type { SelectedPitch } from "./types.js";

const comparisonResponseSchema = z.object({
  weights: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      weight: z.number().nonnegative(),
    }),
  ),
  raw_primary: z.number().int().nonnegative(),
  raw_baseline: z.number().int().nonnegative(),
  matched_primary: z.number().nonnegative(),
  matched_baseline: z.number().nonnegative(),
  strata: z.number().int().nonnegative(),
});

const simulationResponseSchema = z.object({
  trials: z.number().int().positive(),
  chance: z.number().min(0).max(1),
  half_width: z.number().nonnegative(),
  stopped_because: z.enum(["error limit passed", "maximum trials reached"]),
});

const operationFor = (
  resource: AlgorithmResource,
  profile: ConnectionProfile,
): { readonly path: string; readonly method: "GET" | "POST" } => {
  const configured = profile.operations[resource.operation];
  return (
    configured ?? {
      path: `/operations/${encodeURIComponent(resource.operation)}`,
      method: "POST",
    }
  );
};

export class OpenApiComparisonAlgorithm implements ComparisonAlgorithm {
  readonly #resource: AlgorithmResource;
  readonly #profile: ConnectionProfile;
  readonly #fetch: FetchFunction;

  constructor(
    resource: AlgorithmResource,
    profile: ConnectionProfile,
    fetchFunction: FetchFunction = fetch,
  ) {
    this.#resource = resource;
    this.#profile = profile;
    this.#fetch = fetchFunction;
  }

  async run(
    rows: readonly SelectedPitch[],
    matchColumns: readonly string[],
  ): Promise<MatchResult> {
    const operation = operationFor(this.#resource, this.#profile);
    const response = comparisonResponseSchema.parse(
      await requestJson<unknown>(
        this.#profile,
        operation.path,
        {
          method: operation.method,
          body: {
            release: this.#resource.release,
            input_contract: this.#resource.input,
            output_contract: this.#resource.output,
            match_columns: matchColumns,
            rows: rows.map((row, index) => ({
              index,
              group: row.group,
              outcome: row.outcome,
              facts: Object.fromEntries(
                matchColumns.map((column) => [
                  column,
                  row.record[column] ?? null,
                ]),
              ),
            })),
          },
          headers: {
            "x-seam-input-contract": this.#resource.input,
            "x-seam-output-contract": this.#resource.output,
            "x-seam-release": this.#resource.release,
          },
        },
        this.#fetch,
      ),
    );
    const byIndex = new Map(
      response.weights.map((item) => [item.index, item.weight]),
    );
    if (byIndex.size !== response.weights.length) {
      throw new Error("Comparison service returned a duplicate row index.");
    }
    const inputPrimary = rows.filter((row) => row.group === "primary").length;
    const inputBaseline = rows.filter((row) => row.group === "baseline").length;
    if (
      response.raw_primary !== inputPrimary ||
      response.raw_baseline !== inputBaseline
    ) {
      throw new Error("Comparison service returned invalid raw counts.");
    }
    const matched = rows
      .map((row, index) => {
        const weight = byIndex.get(index);
        return weight === undefined || weight === 0
          ? undefined
          : { ...row, weight };
      })
      .filter((row): row is SelectedPitch => row !== undefined);
    if (response.weights.some((item) => item.index >= rows.length)) {
      throw new Error("Comparison service returned an unknown row index.");
    }
    const weightedPrimary = matched
      .filter((row) => row.group === "primary")
      .reduce((sum, row) => sum + row.weight, 0);
    const weightedBaseline = matched
      .filter((row) => row.group === "baseline")
      .reduce((sum, row) => sum + row.weight, 0);
    if (
      Math.abs(weightedPrimary - response.matched_primary) > 1e-8 ||
      Math.abs(weightedBaseline - response.matched_baseline) > 1e-8
    ) {
      throw new Error(
        "Comparison service returned inconsistent matched counts.",
      );
    }
    return {
      rows: matched,
      rawPrimary: response.raw_primary,
      rawBaseline: response.raw_baseline,
      matchedPrimary: response.matched_primary,
      matchedBaseline: response.matched_baseline,
      strata: response.strata,
    };
  }
}

export class OpenApiSimulationAlgorithm implements SimulationAlgorithm {
  readonly #resource: AlgorithmResource;
  readonly #profile: ConnectionProfile;
  readonly #fetch: FetchFunction;

  constructor(
    resource: AlgorithmResource,
    profile: ConnectionProfile,
    fetchFunction: FetchFunction = fetch,
  ) {
    this.#resource = resource;
    this.#profile = profile;
    this.#fetch = fetchFunction;
  }

  async run(
    probabilities: readonly number[],
    weights: readonly number[],
    policy: SimulationPolicy,
    seedParts: readonly string[],
  ): Promise<SimulationResult> {
    const protectedSeed = protectedSeedFor(seedParts);
    const operation = operationFor(this.#resource, this.#profile);
    const response = simulationResponseSchema.parse(
      await requestJson<unknown>(
        this.#profile,
        operation.path,
        {
          method: operation.method,
          body: {
            release: this.#resource.release,
            input_contract: this.#resource.input,
            output_contract: this.#resource.output,
            probabilities,
            weights,
            policy: {
              initial_trials: policy.initialTrials,
              maximum_trials: policy.maximumTrials,
              maximum_half_width: policy.maximumHalfWidth,
            },
            seed: protectedSeed,
          },
          headers: {
            "x-seam-input-contract": this.#resource.input,
            "x-seam-output-contract": this.#resource.output,
            "x-seam-release": this.#resource.release,
          },
        },
        this.#fetch,
      ),
    );
    if (response.trials > policy.maximumTrials) {
      throw new Error("Simulation service exceeded the maximum trial count.");
    }
    if (
      response.stopped_because === "error limit passed" &&
      response.half_width > policy.maximumHalfWidth
    ) {
      throw new Error(
        "Simulation service reported an invalid stopping result.",
      );
    }
    return {
      evidence: {
        trials: response.trials,
        chance: response.chance,
        halfWidth: response.half_width,
        stoppedBecause: response.stopped_because,
      },
      protectedSeed,
    };
  }
}
