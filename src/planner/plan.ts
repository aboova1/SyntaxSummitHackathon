import type {
  AnalysisMethod,
  FeatureGroup,
  Horizon,
  MatchField,
  Outcome,
  PitchName,
  ReportAddition,
} from "../compiler/ast.js";
import type { ResourcePlan } from "../catalog/resolve.js";

export type PlanNodeKind =
  | "read data"
  | "filter data"
  | "build history"
  | "select primary"
  | "select baseline"
  | "match groups"
  | "predict outcome"
  | "simulate outcome"
  | "summarize"
  | "build report";

export interface PlanNode {
  readonly id: string;
  readonly kind: PlanNodeKind;
  readonly dependsOn: readonly string[];
  readonly description: string;
}

export interface FrozenTarget {
  readonly pitchNames: readonly string[];
  readonly sourcePitch: PitchName | null;
  readonly outcome: Outcome;
  readonly horizon: Horizon;
}

export interface FrozenPreviousConstraint {
  readonly kind: "sequence" | "exclude";
  readonly pitchNames: readonly (readonly string[])[];
  readonly sourcePitches: readonly PitchName[];
  readonly window: number;
}

export interface FeaturePlan {
  readonly match: readonly MatchField[];
  readonly matchColumns: readonly string[];
  readonly featureGroups: readonly FeatureGroup[];
  readonly featureColumns: readonly string[];
  readonly source: "study" | "catalog policy";
}

export interface ExecutionPlan {
  readonly version: 1;
  readonly fingerprint: string;
  readonly study: string;
  readonly method: AnalysisMethod;
  readonly target: FrozenTarget;
  readonly primary?: FrozenPreviousConstraint;
  readonly baseline?: FrozenPreviousConstraint;
  readonly features: FeaturePlan;
  readonly dataFilters: {
    readonly seasons?: readonly number[];
    readonly dates?: { readonly start: string; readonly end: string };
    readonly games?: string;
    readonly teams?: readonly string[];
    readonly pitchers?: readonly string[];
    readonly batters?: readonly string[];
  };
  readonly report: readonly ReportAddition[];
  readonly resources: ResourcePlan;
  readonly nodes: readonly PlanNode[];
}
