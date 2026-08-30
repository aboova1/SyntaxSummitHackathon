import { error, type Diagnostic } from "../compiler/diagnostic.js";
import type { ExecutionPlan } from "../planner/plan.js";
import { readCsvData } from "./csv-data.js";
import type { DataReadResult } from "./csv-data.js";
import {
  BuiltinComparisonAlgorithm,
  BuiltinSimulationAlgorithm,
  type ComparisonAlgorithm,
  type SimulationAlgorithm,
} from "./algorithms.js";
import { BuiltinOutcomeModel } from "./model.js";
import { selectPitches } from "./select.js";
import {
  average,
  differenceInterval,
  effectiveCount,
  effectiveSampleSize,
  weightedRate,
  wilsonInterval,
} from "./statistics.js";
import type {
  GroupEvidence,
  ModelDescription,
  OutcomeModel,
  SelectedPitch,
  StudyResult,
} from "./types.js";
import { buildBreakdown, buildZoneMap } from "./views.js";

export interface ExecuteOptions {
  readonly catalogDirectory: string;
  readonly model?: OutcomeModel;
  readonly dataReader?: (plan: ExecutionPlan) => Promise<DataReadResult>;
  readonly comparison?: ComparisonAlgorithm;
  readonly simulation?: SimulationAlgorithm;
}

export interface ExecuteResult {
  readonly result?: StudyResult;
  readonly diagnostics: readonly Diagnostic[];
}

const groupRows = (
  rows: readonly SelectedPitch[],
  group: "primary" | "baseline",
): readonly SelectedPitch[] => rows.filter((row) => row.group === group);

const evidenceFor = (
  rows: readonly SelectedPitch[],
  rawCount: number,
  predictions?: readonly number[],
  simulated?: { readonly chance: number; readonly halfWidth: number },
): GroupEvidence => {
  const observedRate = weightedRate(rows);
  const count = effectiveCount(rows);
  return {
    rawCount,
    matchedCount: count,
    observedRate,
    observedInterval: wilsonInterval(observedRate, effectiveSampleSize(rows)),
    observedIntervalMethod: "Wilson with Kish effective sample size",
    ...(predictions
      ? {
          modelChance: average(
            predictions,
            rows.map((row) => row.weight),
          ),
          modelUncertainty: {
            status: "unavailable" as const,
            reason: "The selected model returns point predictions only.",
          },
        }
      : {}),
    ...(simulated
      ? {
          simulatedChance: simulated.chance,
          simulatedInterval: {
            low: Math.max(0, simulated.chance - simulated.halfWidth),
            high: Math.min(1, simulated.chance + simulated.halfWidth),
            level: 0.95 as const,
          },
          monteCarloHalfWidth: simulated.halfWidth,
          simulatedUncertainty: "Monte Carlo error only" as const,
        }
      : {}),
  };
};

const safeExamples = (
  rows: readonly SelectedPitch[],
  count: number,
): readonly SelectedPitch["record"][] =>
  rows.slice(0, count).map(({ record }) => ({
    game_id: record.game_id ?? null,
    plate_appearance_id: record.plate_appearance_id ?? null,
    pitch_number: record.pitch_number ?? null,
    pitcher_id: record.pitcher_id ?? null,
    batter_id: record.batter_id ?? null,
    pitch_name: record.pitch_name ?? null,
    description: record.description ?? null,
    balls: record.balls ?? null,
    strikes: record.strikes ?? null,
    plate_x: record.plate_x ?? null,
    plate_z: record.plate_z ?? null,
  }));

export const executePlan = async (
  plan: ExecutionPlan,
  options: ExecuteOptions,
): Promise<ExecuteResult> => {
  const diagnostics: Diagnostic[] = [];
  if (plan.resources.data.resource.connector !== "csv" && !options.dataReader) {
    return {
      diagnostics: [
        error(
          "runtime",
          "S500",
          `Data connector '${plan.resources.data.resource.connector}' is not active in this execution path.`,
          {
            hint: "Use the remote runtime or a CSV resource.",
          },
        ),
      ],
    };
  }

  try {
    const data = options.dataReader
      ? await options.dataReader(plan)
      : await readCsvData(
          plan.resources.data.resource.object,
          options.catalogDirectory,
          plan,
        );
    const selected = selectPitches(data.records, plan);
    if (
      plan.resources.comparison?.resource.connector === "openapi" &&
      !options.comparison
    ) {
      return {
        diagnostics: [
          error(
            "runtime",
            "S504",
            "This plan needs a configured remote comparison connector.",
          ),
        ],
      };
    }
    const comparison = options.comparison ?? new BuiltinComparisonAlgorithm();
    const matched = await comparison.run(selected, plan.features.matchColumns);
    const primary = groupRows(matched.rows, "primary");
    const baseline = groupRows(matched.rows, "baseline");
    const minimum = plan.resources.policy.minimum_group_size;
    if (primary.length === 0 || effectiveCount(primary) < minimum) {
      diagnostics.push(
        error(
          "runtime",
          "S501",
          `Primary group has fewer than ${minimum} matched records.`,
          {
            hint: "Use more data or a catalog-approved smaller minimum.",
          },
        ),
      );
    }
    if (
      plan.baseline &&
      (baseline.length === 0 || effectiveCount(baseline) < minimum)
    ) {
      diagnostics.push(
        error(
          "runtime",
          "S502",
          `Baseline group has fewer than ${minimum} matched records.`,
          {
            hint: "Use more data or a catalog-approved smaller minimum.",
          },
        ),
      );
    }
    if (diagnostics.some((item) => item.severity === "error"))
      return { diagnostics };

    const warnings: string[] = data.optionalMissingColumns.map(
      (column) => `Optional field '${column}' was unavailable.`,
    );
    let modelDescription: ModelDescription | undefined;
    let primaryPredictions: readonly number[] | undefined;
    let baselinePredictions: readonly number[] | undefined;
    if (plan.evidence === "model" || plan.evidence === "simulation") {
      if (
        plan.resources.model?.resource.serving.connector !==
          "builtin logistic" &&
        !options.model
      ) {
        return {
          diagnostics: [
            error(
              "runtime",
              "S503",
              "This plan needs a configured remote model connector.",
              {
                hint: "Use the remote runtime or select the approved built-in demonstration model.",
              },
            ),
          ],
        };
      }
      const model =
        options.model ??
        new BuiltinOutcomeModel(
          plan.resources.model?.resource.registry.version,
          plan.resources.model?.resource.training_cutoff,
        );
      modelDescription = await model.describe();
      const allowed = plan.features.featureColumns.filter((field) =>
        modelDescription?.featureColumns.includes(field),
      );
      primaryPredictions = (
        await model.predict(primary, plan.target, allowed)
      ).map((prediction) => prediction.probability);
      baselinePredictions = baseline.length
        ? (await model.predict(baseline, plan.target, allowed)).map(
            (prediction) => prediction.probability,
          )
        : undefined;
      const latestSeason = Math.max(...(plan.dataFilters.seasons ?? []));
      if (
        Number.isFinite(latestSeason) &&
        modelDescription.trainingCutoff > `${latestSeason}-12-31`
      ) {
        warnings.push(
          "The model training cutoff is after the study period. This is a retrospective estimate.",
        );
      }
    }

    const seeds: Record<string, string> = {};
    let primarySimulation:
      | {
          readonly chance: number;
          readonly halfWidth: number;
          readonly trials: number;
        }
      | undefined;
    let baselineSimulation:
      | {
          readonly chance: number;
          readonly halfWidth: number;
          readonly trials: number;
        }
      | undefined;
    if (plan.evidence === "simulation" && primaryPredictions) {
      if (
        plan.resources.simulation?.resource.connector === "openapi" &&
        !options.simulation
      ) {
        return {
          diagnostics: [
            error(
              "runtime",
              "S505",
              "This plan needs a configured remote simulation connector.",
            ),
          ],
        };
      }
      const simulation = options.simulation ?? new BuiltinSimulationAlgorithm();
      const policy = {
        initialTrials: plan.resources.policy.initial_trials,
        maximumTrials: plan.resources.policy.maximum_trials,
        maximumHalfWidth: plan.resources.policy.maximum_half_width,
      };
      const primaryRun = await simulation.run(
        primaryPredictions,
        primary.map((row) => row.weight),
        policy,
        [
          plan.fingerprint,
          data.snapshot,
          modelDescription?.digest ?? "no model",
          "primary",
        ],
      );
      primarySimulation = { ...primaryRun.evidence };
      seeds.primary = primaryRun.protectedSeed;
      if (baselinePredictions) {
        const baselineRun = await simulation.run(
          baselinePredictions,
          baseline.map((row) => row.weight),
          policy,
          [
            plan.fingerprint,
            data.snapshot,
            modelDescription?.digest ?? "no model",
            "baseline",
          ],
        );
        baselineSimulation = { ...baselineRun.evidence };
        seeds.baseline = baselineRun.protectedSeed;
      }
    }

    const primaryEvidence = evidenceFor(
      primary,
      matched.rawPrimary,
      primaryPredictions,
      primarySimulation,
    );
    const baselineEvidence = plan.baseline
      ? evidenceFor(
          baseline,
          matched.rawBaseline,
          baselinePredictions,
          baselineSimulation,
        )
      : undefined;
    const examplesCount =
      plan.include.find((item) => item.kind === "examples")?.kind === "examples"
        ? (
            plan.include.find((item) => item.kind === "examples") as {
              readonly count: number;
            }
          ).count
        : 0;
    const trials = Math.max(
      primarySimulation?.trials ?? 0,
      baselineSimulation?.trials ?? 0,
    );
    const usedFeatureColumns = modelDescription
      ? plan.features.featureColumns.filter((field) =>
          modelDescription?.featureColumns.includes(field),
        )
      : [];
    const reportKinds = new Set(plan.include.map((item) => item.kind));
    const breakdowns = {
      ...(reportKinds.has("pitcher breakdown")
        ? { pitcher: buildBreakdown(primary, "pitcher_id") }
        : {}),
      ...(reportKinds.has("batter breakdown")
        ? { batter: buildBreakdown(primary, "batter_id") }
        : {}),
      ...(reportKinds.has("park breakdown")
        ? { park: buildBreakdown(primary, "park_id") }
        : {}),
    };
    const hasBreakdowns = Object.keys(breakdowns).length > 0;

    return {
      result: {
        status: "complete",
        study: plan.study,
        evidence:
          plan.evidence === "simulation"
            ? "simulated chance"
            : plan.evidence === "model"
              ? "model chance"
              : "observed rate",
        target: plan.target,
        primary: primaryEvidence,
        ...(baselineEvidence ? { baseline: baselineEvidence } : {}),
        ...(baselineEvidence
          ? {
              difference: {
                observed:
                  primaryEvidence.observedRate - baselineEvidence.observedRate,
                observedInterval: differenceInterval(
                  primaryEvidence.observedRate,
                  effectiveSampleSize(primary),
                  baselineEvidence.observedRate,
                  effectiveSampleSize(baseline),
                ),
                observedIntervalMethod:
                  "normal approximation with Kish effective sample sizes",
                ...(primaryEvidence.modelChance !== undefined &&
                baselineEvidence.modelChance !== undefined
                  ? {
                      model:
                        primaryEvidence.modelChance -
                        baselineEvidence.modelChance,
                      modelUncertainty: {
                        status: "unavailable" as const,
                        reason:
                          "The selected model returns point predictions only.",
                      },
                    }
                  : {}),
                ...(primaryEvidence.simulatedChance !== undefined &&
                baselineEvidence.simulatedChance !== undefined
                  ? {
                      simulated:
                        primaryEvidence.simulatedChance -
                        baselineEvidence.simulatedChance,
                      simulatedMonteCarloHalfWidth: Math.sqrt(
                        (primaryEvidence.monteCarloHalfWidth ?? 0) ** 2 +
                          (baselineEvidence.monteCarloHalfWidth ?? 0) ** 2,
                      ),
                    }
                  : {}),
              },
            }
          : {}),
        examples: safeExamples([...primary, ...baseline], examplesCount),
        ...(reportKinds.has("zone map") || hasBreakdowns
          ? {
              views: {
                ...(reportKinds.has("zone map")
                  ? {
                      zoneMap: {
                        primary: buildZoneMap(primary),
                        ...(baseline.length
                          ? { baseline: buildZoneMap(baseline) }
                          : {}),
                      },
                    }
                  : {}),
                ...(hasBreakdowns ? { breakdowns } : {}),
              },
            }
          : {}),
        warnings,
        audit: {
          planFingerprint: plan.fingerprint,
          dataSnapshot: data.snapshot,
          ...(modelDescription
            ? {
                model: {
                  name: modelDescription.name,
                  version: modelDescription.version,
                  digest: modelDescription.digest,
                  trainingCutoff: modelDescription.trainingCutoff,
                },
              }
            : {}),
          featureColumns: usedFeatureColumns,
          matchColumns: plan.features.matchColumns,
          ...(trials > 0
            ? {
                trials,
                stoppingRule: `95 percent Monte Carlo half-width at or below ${plan.resources.policy.maximum_half_width}`,
              }
            : {}),
        },
        protectedAudit: { seeds },
      },
      diagnostics,
    };
  } catch (cause) {
    return {
      diagnostics: [
        error("runtime", "S599", "Execution failed.", {
          hint:
            cause instanceof Error
              ? cause.message
              : "Check the runtime inputs.",
        }),
      ],
    };
  }
};
