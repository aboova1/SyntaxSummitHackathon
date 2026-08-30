import { createHash } from "node:crypto";
import type { SimulationEvidence } from "./types.js";

const seedFrom = (parts: readonly string[]): bigint =>
  BigInt(
    `0x${createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 16)}`,
  );

export const protectedSeedFor = (parts: readonly string[]): string =>
  seedFrom(parts).toString(16).padStart(16, "0");

class SplitMix64 {
  #state: bigint;

  constructor(seed: bigint) {
    this.#state = seed & 0xffffffffffffffffn;
  }

  next(): number {
    this.#state = (this.#state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let value = this.#state;
    value =
      ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    value =
      ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    value ^= value >> 31n;
    return Number(value >> 11n) / 9_007_199_254_740_992;
  }
}

export interface SimulationPolicy {
  readonly initialTrials: number;
  readonly maximumTrials: number;
  readonly maximumHalfWidth: number;
}

export interface SimulationResult {
  readonly evidence: SimulationEvidence;
  readonly protectedSeed: string;
}

export const runAdaptiveSimulation = (
  probabilities: readonly number[],
  weights: readonly number[],
  policy: SimulationPolicy,
  seedParts: readonly string[],
): SimulationResult => {
  if (probabilities.length === 0)
    throw new Error("Simulation needs at least one probability.");
  if (probabilities.length !== weights.length)
    throw new Error("Each simulation probability needs one weight.");
  if (
    probabilities.some(
      (probability) =>
        !Number.isFinite(probability) || probability < 0 || probability > 1,
    )
  ) {
    throw new Error("Simulation probabilities must be between zero and one.");
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0)) {
    throw new Error("Simulation weights must be finite and nonnegative.");
  }
  if (
    !Number.isInteger(policy.initialTrials) ||
    !Number.isInteger(policy.maximumTrials) ||
    policy.initialTrials <= 0 ||
    policy.maximumTrials < policy.initialTrials ||
    !Number.isFinite(policy.maximumHalfWidth) ||
    policy.maximumHalfWidth <= 0 ||
    policy.maximumHalfWidth >= 1
  ) {
    throw new Error("The simulation policy is invalid.");
  }
  const seed = seedFrom(seedParts);
  const random = new SplitMix64(seed);
  const cumulative: number[] = [];
  let totalWeight = 0;
  for (const weight of weights) {
    totalWeight += weight;
    cumulative.push(totalWeight);
  }
  if (totalWeight <= 0) throw new Error("Simulation weights must be positive.");

  let trials = 0;
  let successes = 0;
  let targetTrials = Math.min(policy.initialTrials, policy.maximumTrials);
  let halfWidth = Number.POSITIVE_INFINITY;
  while (trials < targetTrials) {
    const draw = random.next() * totalWeight;
    let index = cumulative.findIndex((value) => draw < value);
    if (index < 0) index = probabilities.length - 1;
    if (random.next() < (probabilities[index] ?? 0)) successes += 1;
    trials += 1;
    if (trials === targetTrials) {
      const chance = successes / trials;
      halfWidth =
        1.959963984540054 * Math.sqrt((chance * (1 - chance)) / trials);
      if (
        halfWidth > policy.maximumHalfWidth &&
        trials < policy.maximumTrials
      ) {
        targetTrials = Math.min(policy.maximumTrials, trials * 2);
      }
    }
  }
  const chance = successes / trials;
  return {
    evidence: {
      trials,
      chance,
      halfWidth,
      stoppedBecause:
        halfWidth <= policy.maximumHalfWidth
          ? "error limit passed"
          : "maximum trials reached",
    },
    protectedSeed: protectedSeedFor(seedParts),
  };
};
