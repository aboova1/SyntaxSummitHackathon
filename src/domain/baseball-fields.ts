import type { FeatureGroup, MatchField } from "../compiler/ast.js";

export type FieldAvailability =
  "before pitch" | "after pitch" | "after plate appearance" | "after game";

export type FieldType = "string" | "integer" | "number" | "boolean" | "date";

export interface BaseballField {
  readonly name: string;
  readonly type: FieldType;
  readonly availability: FieldAvailability;
  readonly group: FeatureGroup | "identity" | "target label";
  readonly description: string;
  readonly optional?: boolean;
}

const before = (
  name: string,
  type: FieldType,
  group: BaseballField["group"],
  description: string,
  optional = false,
): BaseballField => ({
  name,
  type,
  availability: "before pitch",
  group,
  description,
  ...(optional ? { optional } : {}),
});

const after = (
  name: string,
  type: FieldType,
  availability: Exclude<FieldAvailability, "before pitch">,
  description: string,
): BaseballField => ({
  name,
  type,
  availability,
  group: "target label",
  description,
});

export const BASEBALL_FIELDS: readonly BaseballField[] = [
  before("game_id", "string", "identity", "Stable game identifier."),
  before(
    "plate_appearance_id",
    "string",
    "identity",
    "Stable plate-appearance identifier.",
  ),
  before(
    "pitch_number",
    "integer",
    "identity",
    "Pitch order inside the plate appearance.",
  ),
  before("game_date", "date", "identity", "Game date."),
  before("season", "integer", "identity", "Season year."),
  before("game_type", "string", "identity", "Game category."),
  before("pitching_team", "string", "identity", "Pitching team."),
  before("batting_team", "string", "identity", "Batting team."),
  before("pitcher_id", "string", "pitcher form", "Stable pitcher identifier."),
  before("pitcher_hand", "string", "pitcher form", "Pitcher throwing hand."),
  before(
    "pitcher_pitch_count_before",
    "integer",
    "pitcher form",
    "Pitches thrown before this pitch.",
  ),
  before(
    "pitcher_days_rest",
    "integer",
    "pitcher form",
    "Completed rest days before the game.",
  ),
  before(
    "pitcher_times_through_order",
    "integer",
    "pitcher form",
    "Current trip through the batting order.",
  ),
  before(
    "pitcher_season_whiff_rate_before",
    "number",
    "pitcher form",
    "Season whiff rate before this date.",
  ),
  before(
    "pitcher_rolling_whiff_rate_before",
    "number",
    "pitcher form",
    "Recent whiff rate before this date.",
  ),
  before(
    "pitcher_pitch_type_use_before",
    "number",
    "pitcher form",
    "Prior use rate for the selected pitch.",
  ),
  before(
    "pitcher_batter_pa_before",
    "integer",
    "pitcher form",
    "Prior plate appearances against this batter.",
  ),
  before("batter_id", "string", "batter history", "Stable batter identifier."),
  before(
    "batter_side",
    "string",
    "batter history",
    "Batter side for this pitch.",
  ),
  before(
    "batter_pa_before",
    "integer",
    "batter history",
    "Prior season plate appearances.",
  ),
  before(
    "batter_season_woba_before",
    "number",
    "batter history",
    "Season wOBA before this date.",
  ),
  before(
    "batter_rolling_woba_before",
    "number",
    "batter history",
    "Recent wOBA before this date.",
  ),
  before(
    "batter_pitch_type_whiff_rate_before",
    "number",
    "batter history",
    "Prior whiff rate against this pitch type.",
  ),
  before(
    "batter_zone_swing_rate_before",
    "number",
    "batter history",
    "Prior in-zone swing rate.",
  ),
  before(
    "batter_chase_rate_before",
    "number",
    "batter history",
    "Prior out-of-zone swing rate.",
  ),
  before(
    "batter_contact_rate_before",
    "number",
    "batter history",
    "Prior contact rate.",
  ),
  before(
    "expected_release_speed",
    "number",
    "pitch shape",
    "Prior pitcher average speed for this pitch.",
  ),
  before(
    "expected_break_x",
    "number",
    "pitch shape",
    "Prior pitcher average horizontal break.",
  ),
  before(
    "expected_break_z",
    "number",
    "pitch shape",
    "Prior pitcher average vertical break.",
  ),
  before(
    "expected_spin_rate",
    "number",
    "pitch shape",
    "Prior pitcher average spin rate.",
  ),
  before(
    "expected_extension",
    "number",
    "pitch shape",
    "Prior pitcher average extension.",
  ),
  before(
    "intended_plate_x",
    "number",
    "pitch shape",
    "Team-recorded intended horizontal location.",
    true,
  ),
  before(
    "intended_plate_z",
    "number",
    "pitch shape",
    "Team-recorded intended vertical location.",
    true,
  ),
  before(
    "previous_pitch_1",
    "string",
    "sequence history",
    "Immediately prior pitch type.",
  ),
  before(
    "previous_pitch_2",
    "string",
    "sequence history",
    "Second prior pitch type.",
  ),
  before(
    "previous_pitch_3",
    "string",
    "sequence history",
    "Third prior pitch type.",
  ),
  before(
    "previous_result_1",
    "string",
    "sequence history",
    "Immediately prior pitch result.",
  ),
  before(
    "previous_speed_1",
    "number",
    "sequence history",
    "Immediately prior pitch speed.",
  ),
  before(
    "speed_change_from_previous",
    "number",
    "sequence history",
    "Expected speed change from the prior pitch.",
  ),
  before(
    "break_x_change_from_previous",
    "number",
    "sequence history",
    "Expected horizontal break change.",
  ),
  before(
    "break_z_change_from_previous",
    "number",
    "sequence history",
    "Expected vertical break change.",
  ),
  before(
    "location_x_change_from_previous",
    "number",
    "sequence history",
    "Intended horizontal location change.",
    true,
  ),
  before(
    "location_z_change_from_previous",
    "number",
    "sequence history",
    "Intended vertical location change.",
    true,
  ),
  before("balls", "integer", "game situation", "Ball count before the pitch."),
  before(
    "strikes",
    "integer",
    "game situation",
    "Strike count before the pitch.",
  ),
  before("outs", "integer", "game situation", "Out count before the pitch."),
  before("inning", "integer", "game situation", "Current inning."),
  before(
    "inning_half",
    "string",
    "game situation",
    "Top or bottom inning half.",
  ),
  before(
    "score_difference",
    "integer",
    "game situation",
    "Pitching-team score difference.",
  ),
  before(
    "runner_on_first",
    "boolean",
    "game situation",
    "Runner state before the pitch.",
  ),
  before(
    "runner_on_second",
    "boolean",
    "game situation",
    "Runner state before the pitch.",
  ),
  before(
    "runner_on_third",
    "boolean",
    "game situation",
    "Runner state before the pitch.",
  ),
  before(
    "leverage_index_before",
    "number",
    "game situation",
    "Leverage estimate before the pitch.",
  ),
  before("ballpark_id", "string", "ballpark", "Stable ballpark identifier."),
  before(
    "park_run_factor_before",
    "number",
    "ballpark",
    "Park run factor known before the game.",
  ),
  before(
    "park_home_run_factor_before",
    "number",
    "ballpark",
    "Park home-run factor known before the game.",
  ),
  before("park_altitude_feet", "number", "ballpark", "Ballpark altitude."),
  before("roof_state", "string", "ballpark", "Known roof state."),
  before(
    "temperature_f",
    "number",
    "ballpark",
    "Temperature known before the pitch.",
    true,
  ),
  before(
    "wind_speed_mph",
    "number",
    "ballpark",
    "Wind speed known before the pitch.",
    true,
  ),
  before(
    "wind_direction",
    "string",
    "ballpark",
    "Wind direction known before the pitch.",
    true,
  ),
  before("catcher_id", "string", "defense", "Stable catcher identifier."),
  before(
    "catcher_framing_rate_before",
    "number",
    "defense",
    "Catcher framing history before this date.",
  ),
  before(
    "defense_alignment",
    "string",
    "defense",
    "Fielder alignment before the pitch.",
    true,
  ),
  before(
    "defense_quality_before",
    "number",
    "defense",
    "Prior defense quality for active fielders.",
    true,
  ),
  after(
    "pitch_name",
    "string",
    "after pitch",
    "Delivered pitch classification.",
  ),
  after("description", "string", "after pitch", "Pitch result description."),
  after(
    "release_speed",
    "number",
    "after pitch",
    "Measured target pitch speed.",
  ),
  after(
    "break_x",
    "number",
    "after pitch",
    "Measured target horizontal break.",
  ),
  after("break_z", "number", "after pitch", "Measured target vertical break."),
  after("spin_rate", "number", "after pitch", "Measured target spin rate."),
  after(
    "plate_x",
    "number",
    "after pitch",
    "Measured horizontal plate location.",
  ),
  after(
    "plate_z",
    "number",
    "after pitch",
    "Measured vertical plate location.",
  ),
  after("exit_velocity", "number", "after pitch", "Exit speed after contact."),
  after(
    "plate_appearance_result",
    "string",
    "after plate appearance",
    "Final plate-appearance result.",
  ),
  after("game_result", "string", "after game", "Final game result."),
];

const byName = new Map(BASEBALL_FIELDS.map((field) => [field.name, field]));

export const fieldByName = (name: string): BaseballField | undefined =>
  byName.get(name);

export const fieldsForFeatureGroups = (
  groups: readonly FeatureGroup[],
): readonly BaseballField[] =>
  BASEBALL_FIELDS.filter(
    (field) =>
      groups.includes(field.group as FeatureGroup) &&
      field.availability === "before pitch",
  );

export const MATCH_FIELD_COLUMNS: Readonly<
  Record<MatchField, readonly string[]>
> = {
  pitcher: ["pitcher_id"],
  batter: ["batter_id"],
  count: ["balls", "strikes"],
  "batter side": ["batter_side"],
  "pitcher hand": ["pitcher_hand"],
  season: ["season"],
  ballpark: ["ballpark_id"],
  inning: ["inning"],
  outs: ["outs"],
  "base state": ["runner_on_first", "runner_on_second", "runner_on_third"],
};

export const columnsForMatchFields = (
  fields: readonly MatchField[],
): readonly string[] => [
  ...new Set(fields.flatMap((field) => MATCH_FIELD_COLUMNS[field])),
];
