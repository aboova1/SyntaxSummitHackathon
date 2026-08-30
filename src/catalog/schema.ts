import { z } from "zod";
import { FEATURE_GROUPS, MATCH_FIELDS } from "../compiler/ast.js";

const name = z.string().trim().min(1);

const dataResourceSchema = z.object({
  connector: z.enum(["csv", "http json", "flight sql"]),
  connection: name,
  object: name,
  contract: name,
  access: z.literal("read only"),
});

const registrySchema = z.object({
  connector: z.enum(["mlflow", "static"]),
  connection: name.optional(),
  name,
  alias: name.optional(),
  version: name.optional(),
  digest: name.optional(),
});

const servingSchema = z.object({
  connector: z.enum(["kserve v2", "builtin logistic", "http json"]),
  connection: name.optional(),
  name,
});

const modelResourceSchema = z.object({
  registry: registrySchema,
  serving: servingSchema,
  input: name,
  output: name,
  training_cutoff: name.optional(),
  require: z
    .object({
      status: z.literal("approved"),
      calibration: z.literal("passed"),
    })
    .optional(),
});

const algorithmResourceSchema = z.object({
  connector: z.enum(["openapi", "builtin"]),
  connection: name.optional(),
  operation: name,
  release: name,
  input: name,
  output: name,
});

const policySchema = z
  .object({
    minimum_group_size: z.number().int().positive().default(100),
    initial_trials: z.number().int().positive().default(10_000),
    maximum_trials: z.number().int().positive().default(100_000),
    maximum_half_width: z.number().positive().lt(1).default(0.005),
    default_match: z
      .array(z.enum(MATCH_FIELDS))
      .default(["pitcher", "count", "batter side", "season"]),
    default_feature_groups: z
      .array(z.enum(FEATURE_GROUPS))
      .default([
        "batter history",
        "pitcher form",
        "pitch shape",
        "sequence history",
        "game situation",
        "ballpark",
        "defense",
      ]),
    pitch_groups: z.record(name, z.array(name).min(1)).default({
      fastball: ["four-seam fastball", "sinker", "cutter"],
      "breaking ball": ["slider", "sweeper", "curveball", "knuckle curve"],
      "off-speed pitch": ["changeup", "splitter"],
    }),
  })
  .superRefine((policy, context) => {
    if (policy.maximum_trials < policy.initial_trials) {
      context.addIssue({
        code: "custom",
        path: ["maximum_trials"],
        message: "maximum_trials must be at least initial_trials",
      });
    }
  })
  .default({
    minimum_group_size: 100,
    initial_trials: 10_000,
    maximum_trials: 100_000,
    maximum_half_width: 0.005,
    default_match: ["pitcher", "count", "batter side", "season"],
    default_feature_groups: [
      "batter history",
      "pitcher form",
      "pitch shape",
      "sequence history",
      "game situation",
      "ballpark",
      "defense",
    ],
    pitch_groups: {
      fastball: ["four-seam fastball", "sinker", "cutter"],
      "breaking ball": ["slider", "sweeper", "curveball", "knuckle curve"],
      "off-speed pitch": ["changeup", "splitter"],
    },
  });

export const catalogSchema = z.object({
  catalog: name,
  version: z.number().int().positive(),
  defaults: z
    .object({
      model: name.optional(),
      comparison: name.optional(),
      simulation: name.optional(),
    })
    .default({}),
  data: z.record(name, dataResourceSchema),
  models: z.record(name, modelResourceSchema).default({}),
  algorithms: z.record(name, algorithmResourceSchema).default({}),
  policy: policySchema,
});

export type SeamCatalog = z.infer<typeof catalogSchema>;
export type DataResource = z.infer<typeof dataResourceSchema>;
export type ModelResource = z.infer<typeof modelResourceSchema>;
export type AlgorithmResource = z.infer<typeof algorithmResourceSchema>;
