import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BASEBALL_FIELDS } from "../src/domain/baseball-fields.js";

type Value = string | number | boolean | null;

class Random {
  #state = 0x5ea51234;

  next(): number {
    this.#state = (Math.imul(this.#state, 1_664_525) + 1_013_904_223) >>> 0;
    return this.#state / 4_294_967_296;
  }

  around(center: number, range: number): number {
    return center + (this.next() - 0.5) * range;
  }
}

const random = new Random();
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(root, "data/sample-pitches.csv");
const headers = BASEBALL_FIELDS.map((field) => field.name);
const rows: Record<string, Value>[] = [];
const counts: readonly [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 2],
];
const pitchers = ["P100", "P200", "P300", "P400"];
const parks = ["Wrigley Field", "American Family Field", "Busch Stadium"];
const teams = ["CHC", "MIL", "STL", "CIN"];

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));
const fixed = (value: number, digits = 4): number =>
  Number(value.toFixed(digits));

const makeBase = (options: {
  season: number;
  pitcher: string;
  batter: string;
  batterSide: "left" | "right";
  count: readonly [number, number];
  plateAppearance: string;
  gameId: string;
  gameIndex: number;
  repetition: number;
}): Record<string, Value> => {
  const pitcherIndex = pitchers.indexOf(options.pitcher);
  const batterIndex = Number(options.batter.slice(1));
  const park = parks[options.gameIndex % parks.length] ?? parks[0]!;
  const pitchingTeam = teams[pitcherIndex] ?? teams[0]!;
  const battingTeam =
    teams[(pitcherIndex + 1 + (batterIndex % 2)) % teams.length] ?? teams[1]!;
  const batterWhiff = 0.2 + (batterIndex % 7) * 0.012;
  const pitcherWhiff = 0.22 + pitcherIndex * 0.018;
  return {
    game_id: options.gameId,
    plate_appearance_id: options.plateAppearance,
    pitch_number: 0,
    game_date: `${options.season}-${String(4 + (options.gameIndex % 6)).padStart(2, "0")}-${String(1 + (options.gameIndex % 27)).padStart(2, "0")}`,
    season: options.season,
    game_type: "regular season",
    pitching_team: pitchingTeam,
    batting_team: battingTeam,
    pitcher_id: options.pitcher,
    pitcher_hand: pitcherIndex % 2 === 0 ? "right" : "left",
    pitcher_pitch_count_before:
      22 + ((options.repetition * 7 + options.gameIndex) % 78),
    pitcher_days_rest: 4 + (options.gameIndex % 3),
    pitcher_times_through_order: 1 + (options.gameIndex % 3),
    pitcher_season_whiff_rate_before: fixed(pitcherWhiff),
    pitcher_rolling_whiff_rate_before: fixed(
      pitcherWhiff + random.around(0, 0.025),
    ),
    pitcher_pitch_type_use_before: fixed(0.22 + pitcherIndex * 0.02),
    pitcher_batter_pa_before: (options.repetition + batterIndex) % 18,
    batter_id: options.batter,
    batter_side: options.batterSide,
    batter_pa_before: 80 + ((batterIndex * 17 + options.gameIndex) % 420),
    batter_season_woba_before: fixed(0.29 + (batterIndex % 8) * 0.008),
    batter_rolling_woba_before: fixed(0.3 + random.around(0, 0.06)),
    batter_pitch_type_whiff_rate_before: fixed(batterWhiff),
    batter_zone_swing_rate_before: fixed(0.63 + random.around(0, 0.06)),
    batter_chase_rate_before: fixed(0.25 + (batterIndex % 5) * 0.015),
    batter_contact_rate_before: fixed(0.81 - (batterIndex % 6) * 0.016),
    expected_release_speed: 85,
    expected_break_x: fixed(6 + pitcherIndex * 0.8),
    expected_break_z: fixed(1.5 + pitcherIndex * 0.3),
    expected_spin_rate: 2450 + pitcherIndex * 80,
    expected_extension: fixed(6.1 + pitcherIndex * 0.12),
    intended_plate_x: fixed(random.around(0.45, 0.7)),
    intended_plate_z: fixed(random.around(2.15, 0.7)),
    previous_pitch_1: null,
    previous_pitch_2: null,
    previous_pitch_3: null,
    previous_result_1: null,
    previous_speed_1: null,
    speed_change_from_previous: 0,
    break_x_change_from_previous: 0,
    break_z_change_from_previous: 0,
    location_x_change_from_previous: 0,
    location_z_change_from_previous: 0,
    balls: options.count[0],
    strikes: options.count[1],
    outs: options.gameIndex % 3,
    inning: 1 + (options.gameIndex % 9),
    inning_half: options.gameIndex % 2 === 0 ? "top" : "bottom",
    score_difference: (options.gameIndex % 7) - 3,
    runner_on_first: options.gameIndex % 3 === 0,
    runner_on_second: options.gameIndex % 4 === 0,
    runner_on_third: options.gameIndex % 7 === 0,
    leverage_index_before: fixed(0.7 + (options.gameIndex % 9) * 0.12),
    ballpark_id: park,
    park_run_factor_before: fixed(0.96 + parks.indexOf(park) * 0.04),
    park_home_run_factor_before: fixed(0.94 + parks.indexOf(park) * 0.05),
    park_altitude_feet:
      park === "Busch Stadium" ? 466 : park === "Wrigley Field" ? 600 : 593,
    roof_state:
      park === "American Family Field" && options.gameIndex % 2 === 0
        ? "closed"
        : "open",
    temperature_f: 58 + (options.gameIndex % 30),
    wind_speed_mph: 3 + (options.gameIndex % 14),
    wind_direction: options.gameIndex % 2 === 0 ? "out" : "in",
    catcher_id: `C${1 + (options.gameIndex % 4)}`,
    catcher_framing_rate_before: fixed(-0.02 + (options.gameIndex % 5) * 0.01),
    defense_alignment:
      options.batterSide === "left" ? "left shade" : "standard",
    defense_quality_before: fixed(-0.05 + (options.gameIndex % 8) * 0.015),
    pitch_name: "",
    description: "",
    release_speed: 0,
    break_x: 0,
    break_z: 0,
    spin_rate: 0,
    plate_x: 0,
    plate_z: 0,
    exit_velocity: null,
    plate_appearance_result: "field out",
    game_result: options.gameIndex % 2 === 0 ? "win" : "loss",
  };
};

let appearanceIndex = 0;
for (const season of [2023, 2024, 2025]) {
  for (const pitcher of pitchers) {
    for (const batterSide of ["left", "right"] as const) {
      for (const count of counts) {
        for (let repetition = 0; repetition < 5; repetition += 1) {
          for (const condition of ["primary", "baseline"] as const) {
            appearanceIndex += 1;
            const gameIndex = Math.floor((appearanceIndex - 1) / 12);
            const gameId = `G${season}-${String(gameIndex).padStart(4, "0")}`;
            const plateAppearance = `PA${String(appearanceIndex).padStart(6, "0")}`;
            const batterNumber =
              100 + ((appearanceIndex + (batterSide === "left" ? 0 : 9)) % 18);
            const batter = `B${batterNumber}`;
            const base = makeBase({
              season,
              pitcher,
              batter,
              batterSide,
              count,
              plateAppearance,
              gameId,
              gameIndex,
              repetition,
            });
            const first = {
              ...base,
              pitch_number: 1,
              balls: 0,
              strikes: 0,
              pitch_name: "changeup",
              description: "called strike",
              release_speed: fixed(random.around(83, 2)),
              break_x: fixed(random.around(10, 2)),
              break_z: fixed(random.around(5, 2)),
              spin_rate: Math.round(random.around(1800, 180)),
              plate_x: fixed(random.around(0, 1.5)),
              plate_z: fixed(random.around(2.5, 1.4)),
            };
            const secondPitch =
              condition === "primary" ? "four-seam fastball" : "curveball";
            const secondSpeed = condition === "primary" ? 95 : 79;
            const second = {
              ...base,
              pitch_number: 2,
              balls: 0,
              strikes: 1,
              pitch_name: secondPitch,
              description: "ball",
              release_speed: fixed(random.around(secondSpeed, 2)),
              break_x: fixed(
                random.around(condition === "primary" ? -4 : 8, 2),
              ),
              break_z: fixed(
                random.around(condition === "primary" ? 15 : -6, 2),
              ),
              spin_rate: Math.round(
                random.around(condition === "primary" ? 2350 : 2650, 180),
              ),
              plate_x: fixed(random.around(0, 1.8)),
              plate_z: fixed(random.around(2.6, 1.5)),
              previous_pitch_1: "changeup",
              previous_result_1: "called strike",
              previous_speed_1: first.release_speed,
            };
            const pitcherIndex = pitchers.indexOf(pitcher);
            const batterIndex = Number(batter.slice(1));
            const probability = clamp(
              0.205 +
                (condition === "primary" ? 0.075 : 0) +
                pitcherIndex * 0.018 +
                (batterIndex % 7) * 0.008 +
                count[1] * 0.025 -
                count[0] * 0.012,
              0.08,
              0.58,
            );
            const missed = random.next() < probability;
            const targetDescription = missed
              ? "swinging strike"
              : random.next() < 0.45
                ? "foul"
                : "hit into play";
            const paResult =
              missed && count[1] === 2 ? "strikeout" : "field out";
            const target = {
              ...base,
              pitch_number: 3,
              pitch_name: "slider",
              description: targetDescription,
              release_speed: fixed(random.around(85, 2.4)),
              break_x: fixed(random.around(7, 2.5)),
              break_z: fixed(random.around(1.5, 2)),
              spin_rate: Math.round(random.around(2480, 220)),
              plate_x: fixed(random.around(0.42, 1.1)),
              plate_z: fixed(random.around(2.1, 1.1)),
              exit_velocity:
                targetDescription === "hit into play"
                  ? fixed(random.around(88, 24), 1)
                  : null,
              plate_appearance_result: paResult,
              previous_pitch_1: secondPitch,
              previous_pitch_2: "changeup",
              previous_result_1: "ball",
              previous_speed_1: second.release_speed,
              speed_change_from_previous: fixed(
                Number(second.release_speed) - 85,
              ),
              break_x_change_from_previous: fixed(7 - Number(second.break_x)),
              break_z_change_from_previous: fixed(1.5 - Number(second.break_z)),
              location_x_change_from_previous: fixed(
                Number(base.intended_plate_x) - Number(second.plate_x),
              ),
              location_z_change_from_previous: fixed(
                Number(base.intended_plate_z) - Number(second.plate_z),
              ),
            };
            rows.push(first, second, target);
          }
        }
      }
    }
  }
}

const escape = (value: Value): string => {
  if (value === null) return "";
  const text = String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const csv = [
  headers.join(","),
  ...rows.map((row) =>
    headers.map((header) => escape(row[header] ?? null)).join(","),
  ),
].join("\n");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${csv}\n`, "utf8");
process.stdout.write(
  `Wrote ${rows.length} synthetic pitch rows to ${outputPath}.\n`,
);
