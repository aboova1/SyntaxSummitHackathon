import type {
  EvidenceType,
  FeatureGroup,
  Horizon,
  MatchField,
  Outcome,
  PitchName,
  IncludedView,
} from "../compiler/ast.js";
import type { ResourcePlan } from "../catalog/resolve.js";

export type PlanNodeKind =
  | "read data"
  | "filter data"
  | "build history"
  | "select primary"
  | "select baseline"
  | "match groups"
  | "predict event"
  | "simulate outcome"
  | "summarize"
  | "build included views";

export interface PlanNode {
  readonly id: string;
  readonly kind: PlanNodeKind;
  readonly dependsOn: readonly string[];
  readonly description: string;
}

export interface FrozenTarget {
  readonly pitchNames: readonly string[];
  readonly sourcePitch: PitchName | null;
  readonly event: Outcome;
  readonly period: Horizon;
}

export interface FrozenPreviousConstraint {
  readonly kind: "sequence" | "exclude";
  readonly pitchNames: readonly (readonly string[])[];
  readonly sourcePitches: readonly PitchName[];
  readonly lookback: number;
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
  readonly evidence: EvidenceType;
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
    readonly counts?: readonly string[];
    readonly batterSides?: readonly ("left" | "right" | "switch")[];
  };
  readonly include: readonly IncludedView[];
  readonly resources: ResourcePlan;
  readonly nodes: readonly PlanNode[];
}
