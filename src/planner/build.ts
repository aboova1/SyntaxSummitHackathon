import { createHash } from "node:crypto";
import type { SeamDocument, PitchName } from "../compiler/ast.js";
import { error, hasErrors, type Diagnostic } from "../compiler/diagnostic.js";
import type { ResourcePlan } from "../catalog/resolve.js";
import {
  columnsForMatchFields,
  fieldsForFeatureGroups,
} from "../domain/baseball-fields.js";
import type {
  ExecutionPlan,
  FeaturePlan,
  FrozenPreviousConstraint,
  PlanNode,
} from "./plan.js";

export interface PlanResult {
  readonly plan?: ExecutionPlan;
  readonly diagnostics: readonly Diagnostic[];
}

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");

const expandPitch = (
  pitch: PitchName,
  resources: ResourcePlan,
): readonly string[] => resources.policy.pitch_groups[pitch] ?? [pitch];

const freezePrevious = (
  document: SeamDocument,
  resources: ResourcePlan,
  type: "primary" | "baseline",
): FrozenPreviousConstraint | undefined => {
  const source =
    type === "primary" ? document.sequence?.after : document.sequence?.versus;
  if (!source) return undefined;
  return {
    kind: source.kind,
    pitchNames: source.pitches.map((pitch) => expandPitch(pitch, resources)),
    sourcePitches: source.pitches,
    lookback: source.lookback,
  };
};

const buildNodes = (document: SeamDocument): readonly PlanNode[] => {
  const nodes: PlanNode[] = [
    {
      id: "read",
      kind: "read data",
      dependsOn: [],
      description: "Read the selected pitch records.",
    },
    {
      id: "filter",
      kind: "filter data",
      dependsOn: ["read"],
      description: "Apply the data scope.",
    },
    {
      id: "history",
      kind: "build history",
      dependsOn: ["filter"],
      description: "Build prior pitches inside each plate appearance.",
    },
    {
      id: "primary",
      kind: "select primary",
      dependsOn: ["history"],
      description: "Select the target and primary condition.",
    },
  ];
  let comparisonInput = "primary";
  if (document.sequence?.versus) {
    nodes.push({
      id: "baseline",
      kind: "select baseline",
      dependsOn: ["history"],
      description: "Select the target and baseline condition.",
    });
    nodes.push({
      id: "match",
      kind: "match groups",
      dependsOn: ["primary", "baseline"],
      description: "Build comparable groups from pre-pitch facts.",
    });
    comparisonInput = "match";
  }
  let resultInput = comparisonInput;
  if (document.evidence === "model" || document.evidence === "simulation") {
    nodes.push({
      id: "predict",
      kind: "predict event",
      dependsOn: [comparisonInput],
      description: "Request target chances from the approved model.",
    });
    resultInput = "predict";
  }
  if (document.evidence === "simulation") {
    nodes.push({
      id: "simulate",
      kind: "simulate outcome",
      dependsOn: ["predict"],
      description: "Run automatic trials until the error limit passes.",
    });
    resultInput = "simulate";
  }
  nodes.push({
    id: "summary",
    kind: "summarize",
    dependsOn: [resultInput],
    description:
      "Calculate rates, differences, and separate uncertainty values.",
  });
  nodes.push({
    id: "include",
    kind: "build included views",
    dependsOn: ["summary"],
    description: "Build required evidence and requested additions.",
  });
  return nodes;
};

export const buildExecutionPlan = (
  document: SeamDocument,
  resources: ResourcePlan,
  priorDiagnostics: readonly Diagnostic[] = [],
): PlanResult => {
  const diagnostics = [...priorDiagnostics];
  const factSource: FeaturePlan["source"] = document.facts
    ? "study"
    : "catalog policy";
  const match = document.facts?.match ?? resources.policy.default_match;
  const featureGroups =
    document.facts?.consider ?? resources.policy.default_feature_groups;
  const featureFields = fieldsForFeatureGroups(featureGroups);
  const matchColumns = columnsForMatchFields(match);
  const featureColumns = [...new Set(featureFields.map((field) => field.name))];

  if (document.sequence?.versus && match.length === 0) {
    diagnostics.push(
      error(
        "plan",
        "S400",
        "A baseline comparison needs at least one matching fact.",
        {
          hint: "Add 'facts.match' or configure a catalog default.",
        },
      ),
    );
  }
  if (document.evidence !== "observed" && featureGroups.length === 0) {
    diagnostics.push(
      error(
        "plan",
        "S401",
        "A predictive method needs at least one feature group.",
        {
          hint: "Add 'facts.consider' or configure catalog defaults.",
        },
      ),
    );
  }
  if (resources.policy.initial_trials > resources.policy.maximum_trials) {
    diagnostics.push(
      error(
        "plan",
        "S402",
        "The initial trial count exceeds the maximum trial count.",
        {
          hint: "Correct the catalog simulation policy.",
        },
      ),
    );
  }
  if (hasErrors(diagnostics)) return { diagnostics };

  const targetPitch = document.target.pitch ?? null;
  const planWithoutFingerprint = {
    version: 1 as const,
    study: document.study ?? "Untitled study",
    evidence: document.evidence,
    target: {
      pitchNames: targetPitch ? expandPitch(targetPitch, resources) : [],
      sourcePitch: targetPitch,
      event: document.target.event,
      period: document.target.period,
    },
    ...(document.sequence
      ? { primary: freezePrevious(document, resources, "primary")! }
      : {}),
    ...(document.sequence?.versus
      ? { baseline: freezePrevious(document, resources, "baseline")! }
      : {}),
    features: {
      match,
      matchColumns,
      featureGroups,
      featureColumns,
      source: factSource,
    },
    dataFilters: {
      ...(document.scope?.seasons ? { seasons: document.scope.seasons } : {}),
      ...(document.scope?.dates ? { dates: document.scope.dates } : {}),
      ...(document.scope?.games ? { games: document.scope.games } : {}),
      ...(document.scope?.teams ? { teams: document.scope.teams } : {}),
      ...(document.scope?.pitchers
        ? { pitchers: document.scope.pitchers }
        : {}),
      ...(document.scope?.batters ? { batters: document.scope.batters } : {}),
      ...(document.scope?.counts ? { counts: document.scope.counts } : {}),
      ...(document.scope?.batterSides
        ? { batterSides: document.scope.batterSides }
        : {}),
    },
    include: document.include,
    resources,
    nodes: buildNodes(document),
  };

  return {
    plan: {
      ...planWithoutFingerprint,
      fingerprint: fingerprint(planWithoutFingerprint),
    },
    diagnostics,
  };
};
