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
    diagnostics.push(
      error("resolve", "S310", `No ${kind} resource is selected.`, {
        hint: `Add 'use.${kind}' or configure a catalog default.`,
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
  const data = getNamed(
    "data",
    document.data.source,
    catalog.data,
    diagnostics,
  );
  const selected = document.use;
  const modelName = selected?.model ?? catalog.defaults.model;
  const comparisonName = selected?.comparison ?? catalog.defaults.comparison;
  const simulationName = selected?.simulation ?? catalog.defaults.simulation;

  const needsModel =
    document.analyze.method === "model" ||
    document.analyze.method === "simulation";
  const needsComparison = document.analyze.versus !== undefined;
  const needsSimulation = document.analyze.method === "simulation";

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
        `Model '${selected.model}' is not used by method 'observed'.`,
        {
          hint: "Remove 'use.model' to keep the study minimal.",
        },
      ),
    );
  }
  if (!needsComparison && selected?.comparison) {
    diagnostics.push(
      warning(
        "resolve",
        "S313",
        `Comparison '${selected.comparison}' is not used without 'versus'.`,
        {
          hint: "Remove 'use.comparison' or add a baseline.",
        },
      ),
    );
  }
  if (!needsSimulation && selected?.simulation) {
    diagnostics.push(
      warning(
        "resolve",
        "S314",
        `Simulation '${selected.simulation}' is not used by this method.`,
        {
          hint: "Remove 'use.simulation' or use 'method: simulation'.",
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
