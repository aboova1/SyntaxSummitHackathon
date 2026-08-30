import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

interface RawPitch {
  readonly [field: string]: string;
}

const PITCHER_NAMES: Readonly<Record<string, string>> = {
  P100: "Alex Morgan",
  P200: "Jordan Lee",
  P300: "Sam Rivera",
  P400: "Casey Brooks",
};

const BATTER_NAMES: Readonly<Record<string, string>> = {
  B100: "Taylor Kim",
  B101: "Cameron Ellis",
  B102: "Riley Chen",
  B103: "Drew Parker",
  B104: "Morgan Diaz",
  B105: "Avery Johnson",
};

const number = (row: RawPitch, field: string): number => {
  const value = Number(row[field]);
  return Number.isFinite(value) ? value : 0;
};

const mean = (rows: readonly RawPitch[], field: string): number =>
  rows.length === 0
    ? 0
    : rows.reduce((total, row) => total + number(row, field), 0) / rows.length;

const fixed = (value: number, digits = 3): number =>
  Number(value.toFixed(digits));

const unique = (rows: readonly RawPitch[], field: string): readonly string[] =>
  [
    ...new Set(
      rows
        .map((row) => row[field])
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort();

const labelSide = (sides: readonly string[]): string => {
  if (sides.length !== 1) return "switch";
  return sides[0] ?? "unknown";
};

export interface PlaygroundPitcher {
  readonly id: string;
  readonly name: string;
  readonly team: string;
  readonly hand: string;
  readonly pitches: number;
  readonly sliderVelocity: number;
  readonly sliderSpin: number;
  readonly sliderWhiffRate: number;
  readonly seasonWhiffRate: number;
  readonly pitchMix: readonly {
    readonly pitch: string;
    readonly share: number;
  }[];
}

export interface PlaygroundBatter {
  readonly id: string;
  readonly name: string;
  readonly side: string;
  readonly pitches: number;
  readonly plateAppearances: number;
  readonly woba: number;
  readonly contactRate: number;
  readonly chaseRate: number;
  readonly pitchTypeWhiffRate: number;
}

export interface PlaygroundData {
  readonly mode: "synthetic demonstration";
  readonly pitchers: readonly PlaygroundPitcher[];
  readonly batters: readonly PlaygroundBatter[];
  readonly targetPitches: readonly string[];
  readonly previousPitches: readonly string[];
  readonly outcomes: readonly string[];
  readonly methods: readonly string[];
}

export const loadPlaygroundData = async (
  path: string,
): Promise<PlaygroundData> => {
  const rows = parse(await readFile(path), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as readonly RawPitch[];

  const pitchers = unique(rows, "pitcher_id").map((id) => {
    const playerRows = rows.filter((row) => row.pitcher_id === id);
    const sliders = playerRows.filter((row) => row.pitch_name === "slider");
    const pitchCounts = new Map<string, number>();
    for (const row of playerRows) {
      const pitchName = row.pitch_name;
      if (!pitchName) continue;
      pitchCounts.set(pitchName, (pitchCounts.get(pitchName) ?? 0) + 1);
    }
    return {
      id,
      name: PITCHER_NAMES[id] ?? id,
      team: playerRows[0]?.pitching_team ?? "Unknown",
      hand: playerRows[0]?.pitcher_hand ?? "unknown",
      pitches: playerRows.length,
      sliderVelocity: fixed(mean(sliders, "release_speed"), 1),
      sliderSpin: Math.round(mean(sliders, "spin_rate")),
      sliderWhiffRate: fixed(
        sliders.filter((row) => row.description === "swinging strike").length /
          Math.max(1, sliders.length),
      ),
      seasonWhiffRate: fixed(
        mean(playerRows, "pitcher_season_whiff_rate_before"),
      ),
      pitchMix: [...pitchCounts.entries()]
        .map(([pitch, count]) => ({
          pitch,
          share: fixed(count / playerRows.length),
        }))
        .sort((left, right) => right.share - left.share),
    };
  });

  const batters = unique(rows, "batter_id").map((id) => {
    const playerRows = rows.filter((row) => row.batter_id === id);
    return {
      id,
      name: BATTER_NAMES[id] ?? id,
      side: labelSide(unique(playerRows, "batter_side")),
      pitches: playerRows.length,
      plateAppearances: new Set(
        playerRows.map((row) => row.plate_appearance_id),
      ).size,
      woba: fixed(mean(playerRows, "batter_season_woba_before")),
      contactRate: fixed(mean(playerRows, "batter_contact_rate_before")),
      chaseRate: fixed(mean(playerRows, "batter_chase_rate_before")),
      pitchTypeWhiffRate: fixed(
        mean(playerRows, "batter_pitch_type_whiff_rate_before"),
      ),
    };
  });

  return {
    mode: "synthetic demonstration",
    pitchers,
    batters,
    targetPitches: ["slider"],
    previousPitches: ["four-seam fastball", "sinker", "curveball", "changeup"],
    outcomes: ["swing and miss", "contact", "ball in play"],
    methods: ["simulation", "model", "observed"],
  };
};
