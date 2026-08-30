import type { PitchRecord, SelectedPitch } from "./types.js";

const keyFor = (record: PitchRecord, columns: readonly string[]): string =>
  JSON.stringify(columns.map((column) => record[column] ?? null));

export interface MatchResult {
  readonly rows: readonly SelectedPitch[];
  readonly rawPrimary: number;
  readonly rawBaseline: number;
  readonly matchedPrimary: number;
  readonly matchedBaseline: number;
  readonly strata: number;
}

export const matchGroups = (
  rows: readonly SelectedPitch[],
  columns: readonly string[],
): MatchResult => {
  const rawPrimary = rows.filter((row) => row.group === "primary").length;
  const rawBaseline = rows.filter((row) => row.group === "baseline").length;
  if (rawBaseline === 0) {
    return {
      rows,
      rawPrimary,
      rawBaseline,
      matchedPrimary: rawPrimary,
      matchedBaseline: 0,
      strata: 0,
    };
  }

  const strata = new Map<
    string,
    { primary: SelectedPitch[]; baseline: SelectedPitch[] }
  >();
  for (const row of rows) {
    const key = keyFor(row.record, columns);
    const stratum = strata.get(key) ?? { primary: [], baseline: [] };
    stratum[row.group].push(row);
    strata.set(key, stratum);
  }

  const matched: SelectedPitch[] = [];
  let keptStrata = 0;
  let matchedPrimary = 0;
  let matchedBaseline = 0;
  for (const stratum of strata.values()) {
    if (stratum.primary.length === 0 || stratum.baseline.length === 0) continue;
    keptStrata += 1;
    const effective = Math.min(stratum.primary.length, stratum.baseline.length);
    matchedPrimary += effective;
    matchedBaseline += effective;
    matched.push(
      ...stratum.primary.map((row) => ({
        ...row,
        weight: effective / stratum.primary.length,
      })),
      ...stratum.baseline.map((row) => ({
        ...row,
        weight: effective / stratum.baseline.length,
      })),
    );
  }

  return {
    rows: matched,
    rawPrimary,
    rawBaseline,
    matchedPrimary,
    matchedBaseline,
    strata: keptStrata,
  };
};
