import type { SourceSpan } from "./source.js";

export const ATOMIC_PITCHES = [
  "four-seam fastball",
  "sinker",
  "cutter",
  "slider",
  "sweeper",
  "curveball",
  "knuckle curve",
  "changeup",
  "splitter",
] as const;

export const PITCH_GROUPS = [
  "fastball",
  "breaking ball",
  "off-speed pitch",
] as const;

export type AtomicPitch = (typeof ATOMIC_PITCHES)[number];
export type PitchGroup = (typeof PITCH_GROUPS)[number];
export type PitchName = AtomicPitch | PitchGroup;

export const IMMEDIATE_OUTCOMES = [
  "swing",
  "swing and miss",
  "contact",
  "foul",
  "called strike",
  "ball in play",
] as const;

export const PLATE_APPEARANCE_OUTCOMES = [
  "strikeout",
  "walk",
  "hit by pitch",
  "ball in play",
  "reach base",
] as const;

export type ImmediateOutcome = (typeof IMMEDIATE_OUTCOMES)[number];
export type PlateAppearanceOutcome = (typeof PLATE_APPEARANCE_OUTCOMES)[number];
export type Outcome = ImmediateOutcome | PlateAppearanceOutcome;
export type Horizon = "this pitch" | "plate appearance";
export type EvidenceType = "observed" | "model" | "simulation";

export const MATCH_FIELDS = [
  "pitcher",
  "batter",
  "count",
  "batter side",
  "pitcher hand",
  "season",
  "ballpark",
  "inning",
  "outs",
  "base state",
] as const;

export type MatchField = (typeof MATCH_FIELDS)[number];

export const FEATURE_GROUPS = [
  "batter history",
  "pitcher form",
  "pitch shape",
  "game situation",
  "ballpark",
  "defense",
  "sequence history",
] as const;

export type FeatureGroup = (typeof FEATURE_GROUPS)[number];

export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export interface Scope {
  readonly seasons?: readonly number[];
  readonly dates?: DateRange;
  readonly games?: string;
  readonly teams?: readonly string[];
  readonly pitchers?: readonly string[];
  readonly batters?: readonly string[];
  readonly counts?: readonly string[];
  readonly batterSides?: readonly ("left" | "right" | "switch")[];
  readonly span: SourceSpan;
}

export interface ResourceSelection {
  readonly model?: string;
  readonly matching?: string;
  readonly simulator?: string;
  readonly span: SourceSpan;
}

export interface Target {
  readonly event: Outcome;
  readonly pitch: PitchName;
  readonly period: Horizon;
  readonly span: SourceSpan;
}

export interface PreviousConstraint {
  readonly kind: "sequence" | "exclude";
  readonly pitches: readonly PitchName[];
  readonly lookback: number;
  readonly span: SourceSpan;
}

export interface Sequence {
  readonly after: PreviousConstraint;
  readonly versus?: PreviousConstraint;
  readonly span: SourceSpan;
}

export interface Facts {
  readonly match: readonly MatchField[];
  readonly consider: readonly FeatureGroup[];
  readonly span: SourceSpan;
}

export type IncludedView =
  | { readonly kind: "zone map"; readonly span: SourceSpan }
  | {
      readonly kind: "examples";
      readonly count: number;
      readonly span: SourceSpan;
    }
  | { readonly kind: "pitcher breakdown"; readonly span: SourceSpan }
  | { readonly kind: "batter breakdown"; readonly span: SourceSpan }
  | { readonly kind: "park breakdown"; readonly span: SourceSpan };

export interface SeamDocument {
  readonly version: "0.3";
  readonly study?: string;
  readonly source: string;
  readonly scope?: Scope;
  readonly resources?: ResourceSelection;
  readonly target: Target;
  readonly sequence?: Sequence;
  readonly facts?: Facts;
  readonly evidence: EvidenceType;
  readonly include: readonly IncludedView[];
  readonly span: SourceSpan;
}
