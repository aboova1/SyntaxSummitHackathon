import type { BreakdownRow, SelectedPitch, ZoneMapCell } from "./types.js";
import { weightedRate } from "./statistics.js";

const bin = (value: number, minimum: number, maximum: number): number => {
  if (value < minimum || value > maximum) return -1;
  return Math.min(4, Math.floor(((value - minimum) / (maximum - minimum)) * 5));
};

export const buildZoneMap = (
  rows: readonly SelectedPitch[],
): readonly ZoneMapCell[] => {
  const cells = new Map<
    string,
    { column: number; row: number; attempts: number; successes: number }
  >();
  for (const pitch of rows) {
    const x = Number(pitch.record.plate_x);
    const z = Number(pitch.record.plate_z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    const column = bin(x, -2, 2);
    const row = 4 - bin(z, 1, 4.5);
    if (column < 0 || row < 0) continue;
    const key = `${column}:${row}`;
    const current = cells.get(key) ?? {
      column,
      row,
      attempts: 0,
      successes: 0,
    };
    current.attempts += pitch.weight;
    current.successes += pitch.outcome * pitch.weight;
    cells.set(key, current);
  }
  return [...cells.values()]
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .map((cell) => ({
      ...cell,
      rate: cell.attempts ? cell.successes / cell.attempts : 0,
    }));
};

export const buildBreakdown = (
  rows: readonly SelectedPitch[],
  field: string,
): readonly BreakdownRow[] => {
  const groups = new Map<string, SelectedPitch[]>();
  for (const row of rows) {
    const value = String(row.record[field] ?? "unknown");
    groups.set(value, [...(groups.get(value) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([value, values]) => ({
      value,
      attempts: values.reduce((sum, row) => sum + row.weight, 0),
      rate: weightedRate(values),
    }))
    .sort(
      (left, right) =>
        right.attempts - left.attempts || left.value.localeCompare(right.value),
    );
};
