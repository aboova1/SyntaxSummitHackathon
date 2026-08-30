import type { FrozenTarget } from "../planner/plan.js";

export type CellValue = string | number | boolean | null;
export type PitchRecord = Readonly<Record<string, CellValue>>;

export interface SelectedPitch {
  readonly group: "primary" | "baseline";
  readonly record: PitchRecord;
  readonly history: readonly PitchRecord[];
  readonly outcome: 0 | 1;
  readonly weight: number;
}

export interface ProbabilityPrediction {
  readonly probability: number;
}

export interface ModelDescription {
  readonly name: string;
  readonly version: string;
  readonly digest: string;
  readonly trainingCutoff: string;
  readonly status: "approved";
  readonly calibration: "passed";
  readonly featureColumns: readonly string[];
}

export interface OutcomeModel {
  describe(): Promise<ModelDescription>;
  predict(
    rows: readonly SelectedPitch[],
    target: FrozenTarget,
    allowedFeatures: readonly string[],
  ): Promise<readonly ProbabilityPrediction[]>;
}

export interface Interval {
  readonly low: number;
  readonly high: number;
  readonly level: 0.95;
}

export interface UncertaintyNotice {
  readonly status: "unavailable";
  readonly reason: string;
}

export interface GroupEvidence {
  readonly rawCount: number;
  readonly matchedCount: number;
  readonly observedRate: number;
  readonly observedInterval: Interval;
  readonly observedIntervalMethod: "Wilson with Kish effective sample size";
  readonly modelChance?: number;
  readonly modelUncertainty?: UncertaintyNotice;
  readonly simulatedChance?: number;
  readonly simulatedInterval?: Interval;
  readonly monteCarloHalfWidth?: number;
  readonly simulatedUncertainty?: "Monte Carlo error only";
}

export interface SimulationEvidence {
  readonly trials: number;
  readonly chance: number;
  readonly halfWidth: number;
  readonly stoppedBecause: "error limit passed" | "maximum trials reached";
}

export interface PublicAudit {
  readonly planFingerprint: string;
  readonly dataSnapshot: string;
  readonly model?: {
    readonly name: string;
    readonly version: string;
    readonly digest: string;
    readonly trainingCutoff: string;
  };
  readonly featureColumns: readonly string[];
  readonly matchColumns: readonly string[];
  readonly trials?: number;
  readonly stoppingRule?: string;
}

export interface ProtectedAudit {
  readonly seeds: Readonly<Record<string, string>>;
}

export interface ZoneMapCell {
  readonly column: number;
  readonly row: number;
  readonly attempts: number;
  readonly successes: number;
  readonly rate: number;
}

export interface BreakdownRow {
  readonly value: string;
  readonly attempts: number;
  readonly rate: number;
}

export interface ReportViews {
  readonly zoneMap?: {
    readonly primary: readonly ZoneMapCell[];
    readonly baseline?: readonly ZoneMapCell[];
  };
  readonly breakdowns?: Readonly<
    Partial<Record<"pitcher" | "batter" | "park", readonly BreakdownRow[]>>
  >;
}

export interface StudyResult {
  readonly status: "complete";
  readonly study: string;
  readonly evidence: "observed rate" | "model chance" | "simulated chance";
  readonly target: FrozenTarget;
  readonly primary: GroupEvidence;
  readonly baseline?: GroupEvidence;
  readonly difference?: {
    readonly observed: number;
    readonly observedInterval: Interval;
    readonly observedIntervalMethod: "normal approximation with Kish effective sample sizes";
    readonly model?: number;
    readonly modelUncertainty?: UncertaintyNotice;
    readonly simulated?: number;
    readonly simulatedMonteCarloHalfWidth?: number;
  };
  readonly examples: readonly PitchRecord[];
  readonly views?: ReportViews;
  readonly warnings: readonly string[];
  readonly audit: PublicAudit;
  readonly protectedAudit: ProtectedAudit;
}
