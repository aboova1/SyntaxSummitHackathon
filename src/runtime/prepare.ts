import { getConnection } from "../connections/load.js";
import type { ConnectionProfiles } from "../connections/schema.js";
import type { FetchFunction } from "../connections/http.js";
import { error, type Diagnostic } from "../compiler/diagnostic.js";
import type { ExecutionPlan } from "../planner/plan.js";
import type { ExecuteOptions } from "./execute.js";
import { readHttpData } from "./http-data.js";
import {
  OpenApiComparisonAlgorithm,
  OpenApiSimulationAlgorithm,
} from "./remote-algorithms.js";
import { KServeOutcomeModel, resolveModelVersion } from "./remote-model.js";

export interface PrepareResult {
  readonly options?: ExecuteOptions;
  readonly diagnostics: readonly Diagnostic[];
}

export const prepareExecution = async (
  plan: ExecutionPlan,
  catalogDirectory: string,
  profiles: ConnectionProfiles | undefined,
  fetchFunction: FetchFunction = fetch,
): Promise<PrepareResult> => {
  const diagnostics: Diagnostic[] = [];
  let dataReader: ExecuteOptions["dataReader"];
  let modelOption: ExecuteOptions["model"];
  let comparisonOption: ExecuteOptions["comparison"];
  let simulationOption: ExecuteOptions["simulation"];

  try {
    const data = plan.resources.data.resource;
    if (data.connector === "http json") {
      if (!profiles) throw new Error("Remote data needs a connections file.");
      const profile = getConnection(profiles, data.connection);
      dataReader = (currentPlan) =>
        readHttpData(data, profile, currentPlan, fetchFunction);
    } else if (data.connector === "flight sql") {
      diagnostics.push(
        error(
          "runtime",
          "S510",
          "Direct Flight SQL is not available in the Node runtime.",
          {
            hint: "Use an HTTP data gateway or install an ADBC Flight SQL sidecar.",
          },
        ),
      );
    }

    const model = plan.resources.model?.resource;
    if (model && model.serving.connector === "kserve v2") {
      if (!profiles)
        throw new Error("Remote model inference needs a connections file.");
      const registryProfile = model.registry.connection
        ? getConnection(profiles, model.registry.connection)
        : undefined;
      if (!model.serving.connection)
        throw new Error("The KServe model needs a serving connection.");
      const servingProfile = getConnection(profiles, model.serving.connection);
      const frozen = await resolveModelVersion(
        model,
        registryProfile,
        fetchFunction,
      );
      modelOption = new KServeOutcomeModel(
        model,
        servingProfile,
        frozen,
        plan.features.featureColumns,
        fetchFunction,
      );
    } else if (model?.serving.connector === "http json") {
      diagnostics.push(
        error(
          "runtime",
          "S511",
          "The generic HTTP model connector has no contract adapter.",
          {
            hint: "Use KServe V2 or the built-in model.",
          },
        ),
      );
    }

    const comparison = plan.resources.comparison?.resource;
    if (comparison?.connector === "openapi") {
      if (!profiles || !comparison.connection) {
        throw new Error("Remote comparison needs a connection profile.");
      }
      comparisonOption = new OpenApiComparisonAlgorithm(
        comparison,
        getConnection(profiles, comparison.connection),
        fetchFunction,
      );
    }

    const simulation = plan.resources.simulation?.resource;
    if (simulation?.connector === "openapi") {
      if (!profiles || !simulation.connection) {
        throw new Error("Remote simulation needs a connection profile.");
      }
      simulationOption = new OpenApiSimulationAlgorithm(
        simulation,
        getConnection(profiles, simulation.connection),
        fetchFunction,
      );
    }
  } catch (cause) {
    diagnostics.push(
      error("runtime", "S512", "Remote resources could not be prepared.", {
        hint:
          cause instanceof Error
            ? cause.message
            : "Check the connection profiles.",
      }),
    );
  }

  if (diagnostics.some((item) => item.severity === "error"))
    return { diagnostics };
  return {
    options: {
      catalogDirectory,
      ...(dataReader ? { dataReader } : {}),
      ...(modelOption ? { model: modelOption } : {}),
      ...(comparisonOption ? { comparison: comparisonOption } : {}),
      ...(simulationOption ? { simulation: simulationOption } : {}),
    },
    diagnostics,
  };
};
