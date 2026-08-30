import type { SeamDocument } from "../compiler/ast.js";
import {
  error,
  hasErrors,
  warning,
  type Diagnostic,
} from "../compiler/diagnostic.js";
import type {
  AlgorithmResource,
  DataResource,
  ModelResource,
  SeamCatalog,
} from "./schema.js";

export interface ResourcePlan {
  readonly catalog: { readonly name: string; readonly version: number };
  readonly data: { readonly name: string; readonly resource: DataResource };
  readonly model?: { readonly name: string; readonly resource: ModelResource };
  readonly comparison?: {
    readonly name: string;
    readonly resource: AlgorithmResource;
  };
  readonly simulation?: {
    readonly name: string;
    readonly resource: AlgorithmResource;
  };
  readonly policy: SeamCatalog["policy"];
}

export interface ResolveResult {
  readonly plan?: ResourcePlan;
  readonly diagnostics: readonly Diagnostic[];
}

const getNamed = <T>(
  kind: string,
  selected: string | undefined,
  resources: Readonly<Record<string, T>>,
  diagnostics: Diagnostic[],
): { readonly name: string; readonly resource: T } | undefined => {
  if (!selected) {
    const key: Readonly<Record<string, string>> = {
      data: "source",
      model: "resources.model",
      comparison: "resources.matching",
      simulation: "resources.simulator",
    };
    diagnostics.push(
      error("resolve", "S310", `No ${kind} resource is selected.`, {
        hint: `Add '${key[kind] ?? kind}' or configure a catalog default.`,
      }),
    );
    return undefined;
  }
  const resource = resources[selected];
  if (!resource) {
    diagnostics.push(
      error("resolve", "S311", `Unknown ${kind} resource '${selected}'.`, {
        hint: `Available names: ${Object.keys(resources).join(", ") || "none"}.`,
      }),
    );
    return undefined;
  }
  return { name: selected, resource };
};

export const resolveCatalog = (
  document: SeamDocument,
  catalog: SeamCatalog,
  priorDiagnostics: readonly Diagnostic[] = [],
): ResolveResult => {
  const diagnostics = [...priorDiagnostics];
  const data = getNamed("data", document.source, catalog.data, diagnostics);
  const selected = document.resources;
  const modelName = selected?.model ?? catalog.defaults.model;
  const comparisonName = selected?.matching ?? catalog.defaults.comparison;
  const simulationName = selected?.simulator ?? catalog.defaults.simulation;

  const needsModel =
    document.evidence === "model" || document.evidence === "simulation";
  const needsComparison = document.sequence?.versus !== undefined;
  const needsSimulation = document.evidence === "simulation";

  const model = needsModel
    ? getNamed("model", modelName, catalog.models, diagnostics)
    : undefined;
  const comparison = needsComparison
    ? getNamed("comparison", comparisonName, catalog.algorithms, diagnostics)
    : undefined;
  const simulation = needsSimulation
    ? getNamed("simulation", simulationName, catalog.algorithms, diagnostics)
    : undefined;

  if (!needsModel && selected?.model) {
    diagnostics.push(
      warning(
        "resolve",
        "S312",
        `Model '${selected.model}' is not used by evidence 'observed'.`,
        {
          hint: "Remove 'resources.model' to keep the study minimal.",
        },
      ),
    );
  }
  if (!needsComparison && selected?.matching) {
    diagnostics.push(
      warning(
        "resolve",
        "S313",
        `Matching resource '${selected.matching}' is not used without a baseline.`,
        {
          hint: "Remove 'resources.matching' or add 'sequence.versus'.",
        },
      ),
    );
  }
  if (!needsSimulation && selected?.simulator) {
    diagnostics.push(
      warning(
        "resolve",
        "S314",
        `Simulator '${selected.simulator}' is not used by this evidence type.`,
        {
          hint: "Remove 'resources.simulator' or use 'evidence: simulation'.",
        },
      ),
    );
  }

  if (
    !data ||
    (needsModel && !model) ||
    (needsComparison && !comparison) ||
    (needsSimulation && !simulation)
  ) {
    return { diagnostics };
  }
  if (hasErrors(diagnostics)) return { diagnostics };

  return {
    plan: {
      catalog: { name: catalog.catalog, version: catalog.version },
      data,
      ...(model ? { model } : {}),
      ...(comparison ? { comparison } : {}),
      ...(simulation ? { simulation } : {}),
      policy: catalog.policy,
    },
    diagnostics,
  };
};
