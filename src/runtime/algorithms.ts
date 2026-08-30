import type { MatchResult } from "./match.js";
import { matchGroups } from "./match.js";
import type { SimulationPolicy, SimulationResult } from "./simulation.js";
import { runAdaptiveSimulation } from "./simulation.js";
import type { SelectedPitch } from "./types.js";

export interface ComparisonAlgorithm {
  run(
    rows: readonly SelectedPitch[],
    matchColumns: readonly string[],
  ): Promise<MatchResult>;
}

export interface SimulationAlgorithm {
  run(
    probabilities: readonly number[],
    weights: readonly number[],
    policy: SimulationPolicy,
    seedParts: readonly string[],
  ): Promise<SimulationResult>;
}

export class BuiltinComparisonAlgorithm implements ComparisonAlgorithm {
  async run(
    rows: readonly SelectedPitch[],
    matchColumns: readonly string[],
  ): Promise<MatchResult> {
    return matchGroups(rows, matchColumns);
  }
}

export class BuiltinSimulationAlgorithm implements SimulationAlgorithm {
  async run(
    probabilities: readonly number[],
    weights: readonly number[],
    policy: SimulationPolicy,
    seedParts: readonly string[],
  ): Promise<SimulationResult> {
    return runAdaptiveSimulation(probabilities, weights, policy, seedParts);
  }
}
