import { createHash } from "node:crypto";
import { z } from "zod";
import type { ModelResource } from "../catalog/schema.js";
import { requestJson, type FetchFunction } from "../connections/http.js";
import type { ConnectionProfile } from "../connections/schema.js";
import type { FrozenTarget } from "../planner/plan.js";
import type {
  ModelDescription,
  OutcomeModel,
  ProbabilityPrediction,
  SelectedPitch,
} from "./types.js";

const mlflowAliasSchema = z.object({
  model_version: z.object({
    name: z.string(),
    version: z.string(),
    source: z.string().optional(),
    run_id: z.string().optional(),
    tags: z.array(z.object({ key: z.string(), value: z.string() })).default([]),
  }),
});

const kserveMetadataSchema = z.object({
  name: z.string(),
  versions: z.array(z.string()).optional(),
  platform: z.string().optional(),
  inputs: z.array(
    z.object({
      name: z.string(),
      datatype: z.string(),
      shape: z.array(z.number()),
    }),
  ),
  outputs: z.array(
    z.object({
      name: z.string(),
      datatype: z.string(),
      shape: z.array(z.number()),
    }),
  ),
});

const kserveResponseSchema = z.object({
  outputs: z.array(
    z.object({
      name: z.string(),
      data: z.array(z.number()).optional(),
      contents: z
        .object({ fp64_contents: z.array(z.number()).optional() })
        .optional(),
    }),
  ),
});

interface FrozenModel {
  readonly version: string;
  readonly digest: string;
  readonly trainingCutoff: string;
  readonly status: string;
  readonly calibration: string;
}

const tagsToRecord = (
  tags: readonly { readonly key: string; readonly value: string }[],
): Readonly<Record<string, string>> =>
  Object.fromEntries(tags.map((tag) => [tag.key, tag.value]));

export const resolveModelVersion = async (
  resource: ModelResource,
  registryProfile: ConnectionProfile | undefined,
  fetchFunction: FetchFunction = fetch,
): Promise<FrozenModel> => {
  if (resource.registry.connector === "static") {
    if (!resource.registry.version)
      throw new Error("A static model needs an exact version.");
    const digest =
      resource.registry.digest ??
      createHash("sha256")
        .update(`${resource.registry.name}:${resource.registry.version}`)
        .digest("hex");
    return {
      version: resource.registry.version,
      digest,
      trainingCutoff: resource.training_cutoff ?? "unknown",
      status: "approved",
      calibration: "passed",
    };
  }
  if (!registryProfile)
    throw new Error("The MLflow registry connection is not configured.");
  if (resource.registry.version) {
    return {
      version: resource.registry.version,
      digest:
        resource.registry.digest ??
        createHash("sha256")
          .update(`${resource.registry.name}:${resource.registry.version}`)
          .digest("hex"),
      trainingCutoff: resource.training_cutoff ?? "unknown",
      status: "approved",
      calibration: "passed",
    };
  }
  if (!resource.registry.alias)
    throw new Error("An MLflow model needs an alias or exact version.");
  const query = new URLSearchParams({
    name: resource.registry.name,
    alias: resource.registry.alias,
  });
  const response = await requestJson<unknown>(
    registryProfile,
    `/api/2.0/mlflow/registered-models/alias?${query.toString()}`,
    {
      idempotencyKey: `mlflow-${resource.registry.name}-${resource.registry.alias}`,
    },
    fetchFunction,
  );
  const parsed = mlflowAliasSchema.parse(response);
  const tags = tagsToRecord(parsed.model_version.tags);
  const frozen = {
    version: parsed.model_version.version,
    digest:
      tags["seam.digest"] ??
      createHash("sha256")
        .update(
          `${parsed.model_version.name}:${parsed.model_version.version}:${parsed.model_version.source ?? ""}`,
        )
        .digest("hex"),
    trainingCutoff:
      tags["seam.training_cutoff"] ?? resource.training_cutoff ?? "unknown",
    status: tags["seam.status"] ?? "unknown",
    calibration: tags["seam.calibration"] ?? "unknown",
  };
  if (resource.require?.status === "approved" && frozen.status !== "approved") {
    throw new Error(`Model version ${frozen.version} is not approved.`);
  }
  if (
    resource.require?.calibration === "passed" &&
    frozen.calibration !== "passed"
  ) {
    throw new Error(
      `Model version ${frozen.version} has not passed calibration checks.`,
    );
  }
  return frozen;
};

export class KServeOutcomeModel implements OutcomeModel {
  readonly #resource: ModelResource;
  readonly #profile: ConnectionProfile;
  readonly #frozen: FrozenModel;
  readonly #fetch: FetchFunction;
  readonly #featureColumns: readonly string[];
  #description?: ModelDescription;

  constructor(
    resource: ModelResource,
    profile: ConnectionProfile,
    frozen: FrozenModel,
    featureColumns: readonly string[],
    fetchFunction: FetchFunction = fetch,
  ) {
    this.#resource = resource;
    this.#profile = profile;
    this.#frozen = frozen;
    this.#featureColumns = featureColumns;
    this.#fetch = fetchFunction;
  }

  async describe(): Promise<ModelDescription> {
    if (this.#description) return this.#description;
    const model = encodeURIComponent(this.#resource.serving.name);
    const version = encodeURIComponent(this.#frozen.version);
    const metadata = kserveMetadataSchema.parse(
      await requestJson<unknown>(
        this.#profile,
        `/v2/models/${model}/versions/${version}`,
        { idempotencyKey: `metadata-${model}-${version}` },
        this.#fetch,
      ),
    );
    if (!metadata.versions?.includes(this.#frozen.version)) {
      throw new Error(
        `KServe does not report exact model version ${this.#frozen.version}.`,
      );
    }
    const featureInput = metadata.inputs.find(
      (input) => input.name === "features",
    );
    const probabilityOutput = metadata.outputs.find(
      (output) => output.name === "probability",
    );
    if (!featureInput || featureInput.datatype !== "BYTES") {
      throw new Error(
        "KServe metadata does not provide the required BYTES feature input.",
      );
    }
    if (
      !probabilityOutput ||
      !["FP32", "FP64"].includes(probabilityOutput.datatype)
    ) {
      throw new Error(
        "KServe metadata does not provide a numeric probability output.",
      );
    }
    this.#description = {
      name: metadata.name,
      version: this.#frozen.version,
      digest: this.#frozen.digest,
      trainingCutoff: this.#frozen.trainingCutoff,
      status: "approved",
      calibration: "passed",
      featureColumns: this.#featureColumns,
    };
    return this.#description;
  }

  async predict(
    rows: readonly SelectedPitch[],
    target: FrozenTarget,
    allowedFeatures: readonly string[],
  ): Promise<readonly ProbabilityPrediction[]> {
    const model = encodeURIComponent(this.#resource.serving.name);
    const version = encodeURIComponent(this.#frozen.version);
    const data = rows.map((row) =>
      JSON.stringify(
        Object.fromEntries(
          allowedFeatures.map((field) => [field, row.record[field] ?? null]),
        ),
      ),
    );
    const response = kserveResponseSchema.parse(
      await requestJson<unknown>(
        this.#profile,
        `/v2/models/${model}/versions/${version}/infer`,
        {
          method: "POST",
          body: {
            id: createHash("sha256")
              .update(`${model}:${version}:${data.length}`)
              .digest("hex"),
            parameters: {
              contract: this.#resource.input,
              target_outcome: target.event,
              target_horizon: target.period,
            },
            inputs: [
              {
                name: "features",
                shape: [data.length],
                datatype: "BYTES",
                data,
              },
            ],
          },
          headers: { "x-seam-contract": this.#resource.input },
        },
        this.#fetch,
      ),
    );
    const output =
      response.outputs.find((item) => item.name === "probability") ??
      response.outputs[0];
    const probabilities = output?.data ?? output?.contents?.fp64_contents;
    if (!probabilities || probabilities.length !== rows.length) {
      throw new Error("KServe returned an invalid probability output.");
    }
    return probabilities.map((probability) => {
      if (probability < 0 || probability > 1)
        throw new Error("KServe returned a probability outside 0 and 1.");
      return { probability };
    });
  }
}
