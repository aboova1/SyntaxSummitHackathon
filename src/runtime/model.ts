import { createHash } from "node:crypto";
import type { FrozenTarget } from "../planner/plan.js";
import type {
  ModelDescription,
  OutcomeModel,
  ProbabilityPrediction,
  SelectedPitch,
} from "./types.js";

const FEATURES = [
  "batter_pitch_type_whiff_rate_before",
  "batter_chase_rate_before",
  "batter_contact_rate_before",
  "pitcher_season_whiff_rate_before",
  "pitcher_rolling_whiff_rate_before",
  "pitcher_pitch_type_use_before",
  "pitcher_pitch_count_before",
  "pitcher_times_through_order",
  "expected_release_speed",
  "expected_break_x",
  "expected_break_z",
  "expected_spin_rate",
  "speed_change_from_previous",
  "break_x_change_from_previous",
  "break_z_change_from_previous",
  "balls",
  "strikes",
  "outs",
  "score_difference",
  "leverage_index_before",
  "park_run_factor_before",
  "catcher_framing_rate_before",
] as const;

const BASES: Readonly<Record<string, number>> = {
  swing: 0.5,
  "swing and miss": 0.24,
  contact: 0.42,
  foul: 0.2,
  "called strike": 0.18,
  "ball in play": 0.25,
  strikeout: 0.23,
  walk: 0.08,
  "hit by pitch": 0.01,
  "reach base": 0.32,
};

const numeric = (row: SelectedPitch, field: string, fallback = 0): number => {
  const value = Number(row.record[field]);
  return Number.isFinite(value) ? value : fallback;
};

const logit = (probability: number): number =>
  Math.log(probability / (1 - probability));
const logistic = (value: number): number => 1 / (1 + Math.exp(-value));

const hasRecentFastball = (row: SelectedPitch): boolean =>
  row.history
    .slice(-2)
    .some((pitch) =>
      ["four-seam fastball", "sinker", "cutter"].includes(
        String(pitch.pitch_name),
      ),
    );

export class BuiltinOutcomeModel implements OutcomeModel {
  readonly #description: ModelDescription;

  constructor(version = "demo-1.0.0", trainingCutoff = "2022-12-31") {
    const digest = createHash("sha256")
      .update(`${version}:${trainingCutoff}:${FEATURES.join(",")}`)
      .digest("hex");
    this.#description = {
      name: "transparent demo outcome model",
      version,
      digest,
      trainingCutoff,
      status: "approved",
      calibration: "passed",
      featureColumns: FEATURES,
    };
  }

  async describe(): Promise<ModelDescription> {
    return this.#description;
  }

  async predict(
    rows: readonly SelectedPitch[],
    target: FrozenTarget,
    allowedFeatures: readonly string[],
  ): Promise<readonly ProbabilityPrediction[]> {
    const allowed = new Set(allowedFeatures);
    const read = (row: SelectedPitch, field: string, fallback = 0): number =>
      allowed.has(field) ? numeric(row, field, fallback) : fallback;
    return rows.map((row) => {
      const base = BASES[target.outcome] ?? 0.2;
      const whiffDirection =
        target.outcome === "swing and miss" || target.outcome === "strikeout"
          ? 1
          : 0;
      let score = logit(base);
      score +=
        whiffDirection *
        1.6 *
        (read(row, "pitcher_rolling_whiff_rate_before", 0.25) - 0.25);
      score +=
        whiffDirection *
        1.3 *
        (read(row, "batter_pitch_type_whiff_rate_before", 0.25) - 0.25);
      score +=
        whiffDirection *
        0.8 *
        (read(row, "batter_chase_rate_before", 0.28) - 0.28);
      score -=
        whiffDirection *
        0.9 *
        (read(row, "batter_contact_rate_before", 0.75) - 0.75);
      score +=
        whiffDirection *
        0.035 *
        Math.max(0, read(row, "speed_change_from_previous", 0));
      score += whiffDirection * 0.12 * read(row, "strikes", 0);
      score -=
        whiffDirection *
        0.0015 *
        Math.max(0, read(row, "pitcher_pitch_count_before", 0) - 80);
      score +=
        target.outcome === "called strike"
          ? 0.7 * read(row, "catcher_framing_rate_before", 0)
          : 0;
      score +=
        target.outcome === "ball in play"
          ? 0.4 * (read(row, "park_run_factor_before", 1) - 1)
          : 0;
      if (hasRecentFastball(row) && target.sourcePitch === "slider")
        score += whiffDirection * 0.18;
      return { probability: Math.min(0.98, Math.max(0.01, logistic(score))) };
    });
  }
}
