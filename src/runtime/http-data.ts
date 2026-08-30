import { z } from "zod";
import type { DataResource } from "../catalog/schema.js";
import type { ConnectionProfile } from "../connections/schema.js";
import { requestJson, type FetchFunction } from "../connections/http.js";
import { fieldByName } from "../domain/baseball-fields.js";
import type { ExecutionPlan } from "../planner/plan.js";
import type { DataReadResult } from "./csv-data.js";

const cellSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const responseSchema = z.object({
  records: z.array(z.record(z.string(), cellSchema)),
  snapshot: z.string().min(1),
});

export const readHttpData = async (
  resource: DataResource,
  profile: ConnectionProfile,
  plan: ExecutionPlan,
  fetchFunction: FetchFunction = fetch,
): Promise<DataReadResult> => {
  const operation = profile.operations.query;
  const path = operation?.path ?? "/v1/query";
  const { counts: _targetCounts, ...historyFilters } = plan.dataFilters;
  const response = await requestJson<unknown>(
    profile,
    path,
    {
      method: operation?.method ?? "POST",
      body: {
        dataset: resource.object,
        contract: resource.contract,
        filters: historyFilters,
        target_filters: {
          counts: plan.dataFilters.counts ?? [],
        },
        columns: [
          ...new Set([
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
            ...(plan.dataFilters.teams
              ? ["pitching_team", "batting_team"]
              : []),
            ...(plan.dataFilters.counts ? ["balls", "strikes"] : []),
            ...(plan.dataFilters.batterSides ? ["batter_side"] : []),
            ...plan.features.matchColumns,
            ...plan.features.featureColumns,
          ]),
        ],
        plan_fingerprint: plan.fingerprint,
      },
      headers: { "x-seam-contract": resource.contract },
      idempotencyKey: `data-${plan.fingerprint}`,
    },
    fetchFunction,
  );
  const parsed = responseSchema.parse(response);
  const columns = parsed.records[0] ? Object.keys(parsed.records[0]) : [];
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
    ...(plan.dataFilters.counts ? ["balls", "strikes"] : []),
    ...(plan.dataFilters.batterSides ? ["batter_side"] : []),
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
      `Remote data is missing required columns: ${requiredMissing.join(", ")}.`,
    );
  }
  const optionalMissingColumns = requested.filter(
    (field) => !columns.includes(field) && fieldByName(field)?.optional,
  );
  return {
    records: parsed.records,
    snapshot: parsed.snapshot,
    path: new URL(path, profile.base_url).toString(),
    columns,
    optionalMissingColumns,
  };
};
