import type { Interval, SelectedPitch } from "./types.js";

const clamp = (value: number, low = 0, high = 1): number =>
  Math.min(high, Math.max(low, value));

export const weightedRate = (rows: readonly SelectedPitch[]): number => {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (total === 0) return Number.NaN;
  return rows.reduce((sum, row) => sum + row.outcome * row.weight, 0) / total;
};

export const effectiveCount = (rows: readonly SelectedPitch[]): number =>
  rows.reduce((sum, row) => sum + row.weight, 0);

export const effectiveSampleSize = (rows: readonly SelectedPitch[]): number => {
  const total = effectiveCount(rows);
  const squared = rows.reduce((sum, row) => sum + row.weight * row.weight, 0);
  return squared === 0 ? 0 : (total * total) / squared;
};

export const wilsonInterval = (
  successRate: number,
  count: number,
): Interval => {
  if (!Number.isFinite(successRate) || count <= 0)
    return { low: 0, high: 1, level: 0.95 };
  const z = 1.959963984540054;
  const z2 = z * z;
  const denominator = 1 + z2 / count;
  const center = (successRate + z2 / (2 * count)) / denominator;
  const half =
    (z / denominator) *
    Math.sqrt(
      (successRate * (1 - successRate)) / count + z2 / (4 * count * count),
    );
  return { low: clamp(center - half), high: clamp(center + half), level: 0.95 };
};

export const differenceInterval = (
  firstRate: number,
  firstCount: number,
  secondRate: number,
  secondCount: number,
): Interval => {
  const difference = firstRate - secondRate;
  if (firstCount <= 0 || secondCount <= 0)
    return { low: -1, high: 1, level: 0.95 };
  const variance =
    (firstRate * (1 - firstRate)) / firstCount +
    (secondRate * (1 - secondRate)) / secondCount;
  const half = 1.959963984540054 * Math.sqrt(Math.max(0, variance));
  return {
    low: clamp(difference - half, -1, 1),
    high: clamp(difference + half, -1, 1),
    level: 0.95,
  };
};

export const average = (
  values: readonly number[],
  weights?: readonly number[],
): number => {
  if (values.length === 0) return Number.NaN;
  if (!weights)
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight === 0) return Number.NaN;
  return (
    values.reduce(
      (sum, value, index) => sum + value * (weights[index] ?? 0),
      0,
    ) / totalWeight
  );
};
