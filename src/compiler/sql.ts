import type { Outcome } from "./ast.js";
import type {
  FrozenPreviousConstraint,
  ExecutionPlan,
} from "../planner/plan.js";

export interface SqlProgram {
  readonly text: string;
  readonly parameters: readonly (string | number)[];
}

const quoteIdentifier = (value: string): string =>
  `"${value.replaceAll('"', '""')}"`;

const quotePath = (value: string): string =>
  value.split(".").map(quoteIdentifier).join(".");

const combinations = (
  values: readonly number[],
  size: number,
  start = 0,
  prefix: readonly number[] = [],
): readonly (readonly number[])[] => {
  if (prefix.length === size) return [prefix];
  const result: (readonly number[])[] = [];
  for (
    let index = start;
    index <= values.length - (size - prefix.length);
    index += 1
  ) {
    const value = values[index];
    if (value !== undefined)
      result.push(...combinations(values, size, index + 1, [...prefix, value]));
  }
  return result;
};

const placeholders = (count: number): string =>
  Array.from({ length: count }, () => "?").join(", ");

const pitchSetExpression = (
  column: string,
  pitchNames: readonly string[],
  parameters: (string | number)[],
): string => {
  parameters.push(...pitchNames);
  return `${column} IN (${placeholders(pitchNames.length)})`;
};

const previousExpression = (
  constraint: FrozenPreviousConstraint,
  parameters: (string | number)[],
): string => {
  if (constraint.kind === "exclude") {
    const names = constraint.pitchNames[0] ?? [];
    return Array.from({ length: constraint.window }, (_, index) => {
      const column = `_previous_pitch_${index + 1}`;
      return `(${column} IS NULL OR NOT ${pitchSetExpression(column, names, parameters)})`;
    }).join(" AND ");
  }

  const positions = Array.from(
    { length: constraint.window },
    (_, index) => index + 1,
  );
  const arrangements = combinations(positions, constraint.pitchNames.length);
  return arrangements
    .map((ascending) => {
      const oldestToNewest = [...ascending].reverse();
      return oldestToNewest
        .map((position, sequenceIndex) => {
          const names = constraint.pitchNames[sequenceIndex] ?? [];
          return pitchSetExpression(
            `_previous_pitch_${position}`,
            names,
            parameters,
          );
        })
        .join(" AND ");
    })
    .map((expression) => `(${expression})`)
    .join(" OR ");
};

const outcomeExpression = (
  outcome: Outcome,
  horizon: ExecutionPlan["target"]["horizon"],
): string => {
  if (horizon === "plate appearance") {
    const values: Readonly<Record<string, readonly string[]>> = {
      strikeout: ["strikeout", "strikeout double play"],
      walk: ["walk", "intentional walk"],
      "hit by pitch": ["hit by pitch"],
      "ball in play": [
        "single",
        "double",
        "triple",
        "home run",
        "field out",
        "force out",
        "field error",
      ],
      "reach base": [
        "single",
        "double",
        "triple",
        "home run",
        "walk",
        "intentional walk",
        "hit by pitch",
        "field error",
      ],
    };
    const allowed = values[outcome] ?? [];
    return `plate_appearance_result IN (${allowed.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")})`;
  }
  const values: Readonly<Record<string, readonly string[]>> = {
    swing: [
      "swinging strike",
      "swinging strike blocked",
      "foul",
      "foul tip",
      "hit into play",
    ],
    "swing and miss": ["swinging strike", "swinging strike blocked"],
    contact: ["foul", "foul tip", "hit into play"],
    foul: ["foul", "foul tip"],
    "called strike": ["called strike"],
    "ball in play": ["hit into play"],
  };
  const allowed = values[outcome] ?? [];
  return `description IN (${allowed.map((value) => `'${value.replaceAll("'", "''")}'`).join(", ")})`;
};

export const generateSql = (plan: ExecutionPlan): SqlProgram => {
  const parameters: (string | number)[] = [];
  const filters: string[] = [];
  if (plan.dataFilters.seasons?.length) {
    parameters.push(...plan.dataFilters.seasons);
    filters.push(
      `season IN (${placeholders(plan.dataFilters.seasons.length)})`,
    );
  }
  if (plan.dataFilters.games && plan.dataFilters.games !== "all games") {
    parameters.push(plan.dataFilters.games);
    filters.push("game_type = ?");
  }
  if (plan.dataFilters.dates) {
    parameters.push(plan.dataFilters.dates.start, plan.dataFilters.dates.end);
    filters.push("game_date >= ? AND game_date <= ?");
  }
  for (const [field, values] of [
    ["pitcher_id", plan.dataFilters.pitchers],
    ["batter_id", plan.dataFilters.batters],
  ] as const) {
    if (values?.length) {
      parameters.push(...values);
      filters.push(`${field} IN (${placeholders(values.length)})`);
    }
  }
  if (plan.dataFilters.teams?.length) {
    parameters.push(...plan.dataFilters.teams, ...plan.dataFilters.teams);
    const teamValues = placeholders(plan.dataFilters.teams.length);
    filters.push(
      `(pitching_team IN (${teamValues}) OR batting_team IN (${teamValues}))`,
    );
  }
  const maxWindow = Math.max(
    plan.primary?.window ?? 0,
    plan.baseline?.window ?? 0,
  );
  const lagColumns = Array.from(
    { length: maxWindow },
    (_, index) =>
      `LAG(pitch_name, ${index + 1}) OVER (PARTITION BY game_id, plate_appearance_id ORDER BY pitch_number) AS _previous_pitch_${index + 1}`,
  );
  const outcome = outcomeExpression(plan.target.outcome, plan.target.horizon);
  const selectColumns = [
    ...new Set([
      "game_id",
      "plate_appearance_id",
      "pitch_number",
      "pitch_name",
      "description",
      "plate_appearance_result",
      ...(plan.dataFilters.dates ? ["game_date"] : []),
      ...(plan.dataFilters.teams ? ["pitching_team", "batting_team"] : []),
      ...plan.features.matchColumns,
      ...plan.features.featureColumns,
    ]),
  ];
  const source = quotePath(plan.resources.data.resource.object);
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const lagSelect =
    lagColumns.length > 0 ? `,\n    ${lagColumns.join(",\n    ")}` : "";
  const groupSql = (
    label: "primary" | "baseline",
    constraint: FrozenPreviousConstraint | undefined,
  ): string => {
    const targetCondition =
      plan.target.pitchNames.length > 0
        ? pitchSetExpression("pitch_name", plan.target.pitchNames, parameters)
        : "TRUE";
    const condition = constraint
      ? previousExpression(constraint, parameters)
      : "TRUE";
    return `SELECT '${label}' AS analysis_group, *, CASE WHEN ${outcome} THEN 1 ELSE 0 END AS target_outcome\n  FROM ordered\n  WHERE ${targetCondition} AND (${condition})`;
  };
  const primarySql = groupSql("primary", plan.primary);
  const baselineSql = plan.baseline
    ? `\n  UNION ALL\n  ${groupSql("baseline", plan.baseline)}`
    : "";

  return {
    text: `-- SeamScript plan ${plan.fingerprint}\nWITH scoped AS (\n  SELECT *\n  FROM ${source}\n  ${where}\n),\nordered AS (\n  SELECT\n    ${selectColumns.map(quoteIdentifier).join(",\n    ")}${lagSelect}\n  FROM scoped\n),\nselected AS (\n  ${primarySql}${baselineSql}\n)\nSELECT *\nFROM selected\nORDER BY game_id, plate_appearance_id, pitch_number;`,
    parameters,
  };
};
