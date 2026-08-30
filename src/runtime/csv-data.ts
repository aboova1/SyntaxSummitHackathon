import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { BASEBALL_FIELDS, fieldByName } from "../domain/baseball-fields.js";
import type { ExecutionPlan } from "../planner/plan.js";
import type { CellValue, PitchRecord } from "./types.js";

export interface DataReadResult {
  readonly records: readonly PitchRecord[];
  readonly snapshot: string;
  readonly path: string;
  readonly columns: readonly string[];
  readonly optionalMissingColumns: readonly string[];
}

const convert = (field: string, raw: string): CellValue => {
  if (raw === "") return null;
  const definition = fieldByName(field);
  if (!definition || definition.type === "string" || definition.type === "date")
    return raw;
  if (definition.type === "boolean") return raw === "true" || raw === "1";
  const value = Number(raw);
  if (!Number.isFinite(value))
    throw new Error(`Field '${field}' contains non-numeric value '${raw}'.`);
  return value;
};

export const readCsvData = async (
  objectPath: string,
  baseDirectory: string,
  plan: ExecutionPlan,
): Promise<DataReadResult> => {
  const path = resolve(baseDirectory, objectPath);
  const source = await readFile(path);
  const rawRows = parse(source, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as readonly Readonly<Record<string, string>>[];
  const columns = rawRows[0] ? Object.keys(rawRows[0]) : [];
  const core = [
    "game_id",
    "plate_appearance_id",
    "pitch_number",
    "season",
    "game_type",
    "pitcher_id",
    "batter_id",
    "pitch_name",
    "description",
    "plate_appearance_result",
    ...(plan.dataFilters.dates ? ["game_date"] : []),
    ...(plan.dataFilters.teams ? ["pitching_team", "batting_team"] : []),
  ];
  const requested = [
    ...new Set([
      ...core,
      ...plan.features.matchColumns,
      ...plan.features.featureColumns,
    ]),
  ];
  const requiredMissing = requested.filter((field) => {
    const definition = fieldByName(field);
    return !columns.includes(field) && !definition?.optional;
  });
  if (requiredMissing.length > 0) {
    throw new Error(
      `Data is missing required columns: ${requiredMissing.join(", ")}.`,
    );
  }
  const optionalMissingColumns = requested.filter((field) => {
    const definition = fieldByName(field);
    return !columns.includes(field) && definition?.optional;
  });
  const known = new Set(BASEBALL_FIELDS.map((field) => field.name));
  const records = rawRows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([field, raw]) => [
        field,
        known.has(field) ? convert(field, raw) : raw,
      ]),
    ),
  );
  return {
    records,
    snapshot: createHash("sha256").update(source).digest("hex"),
    path,
    columns,
    optionalMissingColumns,
  };
};
