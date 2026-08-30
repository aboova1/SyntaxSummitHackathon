import type {
  ExecutionPlan,
  FrozenPreviousConstraint,
} from "../planner/plan.js";
import type { PitchRecord, SelectedPitch } from "./types.js";

const text = (record: PitchRecord, field: string): string =>
  String(record[field] ?? "");
const number = (record: PitchRecord, field: string): number =>
  Number(record[field] ?? Number.NaN);

const pitchMatches = (record: PitchRecord, names: readonly string[]): boolean =>
  names.includes(text(record, "pitch_name"));

const isOrderedSubsequence = (
  history: readonly PitchRecord[],
  pitchSets: readonly (readonly string[])[],
): boolean => {
  let sequenceIndex = 0;
  for (const record of history) {
    const expected = pitchSets[sequenceIndex];
    if (expected && pitchMatches(record, expected)) sequenceIndex += 1;
    if (sequenceIndex === pitchSets.length) return true;
  }
  return pitchSets.length === 0;
};

const previousMatches = (
  completeHistory: readonly PitchRecord[],
  constraint: FrozenPreviousConstraint | undefined,
): boolean => {
  if (!constraint) return true;
  const window = completeHistory.slice(-constraint.window);
  if (constraint.kind === "exclude") {
    const excluded = constraint.pitchNames[0] ?? [];
    return window.every((record) => !pitchMatches(record, excluded));
  }
  return isOrderedSubsequence(window, constraint.pitchNames);
};

const outcomeMatches = (record: PitchRecord, plan: ExecutionPlan): boolean => {
  if (plan.target.horizon === "plate appearance") {
    const result = text(record, "plate_appearance_result");
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
    return (values[plan.target.outcome] ?? []).includes(result);
  }
  const description = text(record, "description");
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
  return (values[plan.target.outcome] ?? []).includes(description);
};

const recordInScope = (record: PitchRecord, plan: ExecutionPlan): boolean => {
  const filters = plan.dataFilters;
  if (
    filters.seasons?.length &&
    !filters.seasons.includes(number(record, "season"))
  )
    return false;
  if (
    filters.games &&
    filters.games !== "all games" &&
    text(record, "game_type") !== filters.games
  )
    return false;
  if (
    filters.dates &&
    (text(record, "game_date") < filters.dates.start ||
      text(record, "game_date") > filters.dates.end)
  )
    return false;
  if (
    filters.pitchers?.length &&
    !filters.pitchers.includes(text(record, "pitcher_id"))
  )
    return false;
  if (
    filters.batters?.length &&
    !filters.batters.includes(text(record, "batter_id"))
  )
    return false;
  if (
    filters.teams?.length &&
    !filters.teams.includes(text(record, "pitching_team")) &&
    !filters.teams.includes(text(record, "batting_team"))
  ) {
    return false;
  }
  return true;
};

const sortRecords = (records: readonly PitchRecord[]): readonly PitchRecord[] =>
  [...records].sort((left, right) => {
    const game = text(left, "game_id").localeCompare(text(right, "game_id"));
    if (game !== 0) return game;
    const appearance = text(left, "plate_appearance_id").localeCompare(
      text(right, "plate_appearance_id"),
    );
    if (appearance !== 0) return appearance;
    return number(left, "pitch_number") - number(right, "pitch_number");
  });

export const selectPitches = (
  records: readonly PitchRecord[],
  plan: ExecutionPlan,
): readonly SelectedPitch[] => {
  const selected: SelectedPitch[] = [];
  const histories = new Map<string, PitchRecord[]>();

  for (const record of sortRecords(
    records.filter((item) => recordInScope(item, plan)),
  )) {
    const key = `${text(record, "game_id")}\u0000${text(record, "plate_appearance_id")}`;
    const history = histories.get(key) ?? [];
    const targetMatches =
      plan.target.pitchNames.length === 0 ||
      pitchMatches(record, plan.target.pitchNames);
    if (targetMatches) {
      const primary = previousMatches(history, plan.primary);
      const baseline = plan.baseline
        ? previousMatches(history, plan.baseline)
        : false;
      if (primary) {
        selected.push({
          group: "primary",
          record,
          history: [...history],
          outcome: outcomeMatches(record, plan) ? 1 : 0,
          weight: 1,
        });
      }
      if (baseline) {
        selected.push({
          group: "baseline",
          record,
          history: [...history],
          outcome: outcomeMatches(record, plan) ? 1 : 0,
          weight: 1,
        });
      }
    }
    history.push(record);
    histories.set(key, history);
  }

  return selected;
};
