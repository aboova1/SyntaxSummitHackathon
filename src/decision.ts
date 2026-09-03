import type {
  PlaygroundBatter,
  PlaygroundData,
  PlaygroundPitcher,
} from "./playground-data.js";

export const DECISION_OUTCOMES = [
  "ball",
  "called strike",
  "swing and miss",
  "foul",
  "out in play",
  "hit",
] as const;

export const TARGET_LOCATIONS = [
  "high and inside",
  "high and away",
  "middle",
  "low and inside",
  "low and away",
] as const;

export const RECOMMENDATION_GOALS = [
  "swing and miss",
  "called strike",
  "any strike",
  "out in play",
] as const;

export type DecisionOutcome = (typeof DECISION_OUTCOMES)[number];
export type TargetLocation = (typeof TARGET_LOCATIONS)[number];
export type RecommendationGoal = (typeof RECOMMENDATION_GOALS)[number];

export interface PitchSituation {
  readonly pitcher: string;
  readonly batter: string;
  readonly count: string;
  readonly previousPitch: string;
  readonly previousLocation: TargetLocation | "none";
  readonly previousResult: string;
  readonly outs: number;
  readonly runners: string;
  readonly score: string;
}

export type DecisionQuestion =
  | {
      readonly kind: "predict";
      readonly pitch: string;
      readonly location: TargetLocation;
    }
  | { readonly kind: "recommend"; readonly goal: RecommendationGoal };

export interface PitchDecisionRequest {
  readonly study: string;
  readonly situation: PitchSituation;
  readonly question: DecisionQuestion;
}

export interface OutcomeChance {
  readonly outcome: DecisionOutcome;
  readonly chance: number;
}

export interface PitchCallResult {
  readonly pitch: string;
  readonly location: TargetLocation;
  readonly outcomes: readonly OutcomeChance[];
  readonly goalChance?: number;
  readonly simulationRange: { readonly low: number; readonly high: number };
}

export interface PitchDecisionResult {
  readonly mode: "pitch decision";
  readonly study: string;
  readonly question: DecisionQuestion;
  readonly situation: PitchSituation;
  readonly selected: PitchCallResult;
  readonly recommendations?: readonly PitchCallResult[];
  readonly trials: 40000;
  readonly model: {
    readonly name: "local demonstration outcome model";
    readonly version: "demo-2.0.0";
    readonly status: "illustrative";
  };
  readonly notices: readonly string[];
}

export interface DecisionParseResult {
  readonly request?: PitchDecisionRequest;
  readonly diagnostics: readonly {
    code: string;
    stage: "semantic";
    severity: "error";
    message: string;
    hint?: string;
  }[];
}

export interface PitchDecisionPlan {
  readonly study: string;
  readonly nodes: readonly {
    readonly kind: string;
    readonly description: string;
  }[];
}

export const isPitchDecisionSource = (source: string): boolean =>
  /^situation:\s*$/mu.test(source) && /^question:\s*$/mu.test(source);

export const buildPitchDecisionPlan = (
  request: PitchDecisionRequest,
): PitchDecisionPlan => ({
  study: request.study,
  nodes: [
    {
      kind: "read situation",
      description: "Read known pre-pitch facts.",
    },
    {
      kind: "build pitch calls",
      description:
        request.question.kind === "predict"
          ? "Build the selected pitch call."
          : "Build calls from the pitcher's arsenal.",
    },
    {
      kind: "predict outcomes",
      description: "Estimate one complete outcome distribution for each call.",
    },
    {
      kind: "simulate outcomes",
      description: "Run 40,000 automatic trials for each call.",
    },
    {
      kind: "rank calls",
      description:
        request.question.kind === "recommend"
          ? "Rank calls by the selected goal."
          : "Keep the selected call.",
    },
  ],
});

const BASE: Readonly<Record<string, readonly number[]>> = {
  "four-seam fastball": [0.3, 0.2, 0.11, 0.17, 0.13, 0.09],
  sinker: [0.3, 0.17, 0.1, 0.16, 0.18, 0.09],
  cutter: [0.31, 0.16, 0.16, 0.16, 0.13, 0.08],
  slider: [0.35, 0.12, 0.22, 0.13, 0.11, 0.07],
  sweeper: [0.37, 0.1, 0.25, 0.11, 0.1, 0.07],
  curveball: [0.34, 0.15, 0.2, 0.12, 0.12, 0.07],
  changeup: [0.36, 0.1, 0.23, 0.12, 0.12, 0.07],
  splitter: [0.38, 0.09, 0.26, 0.1, 0.1, 0.07],
};

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value));

const stableNumber = (parts: readonly string[]): number => {
  let value = 2166136261;
  for (const character of parts.join("|")) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
};

const randomGenerator = (parts: readonly string[]): (() => number) => {
  let state = stableNumber(parts) || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
};

const softmax = (scores: readonly number[]): readonly number[] => {
  const maximum = Math.max(...scores);
  const values = scores.map((score) => Math.exp(score - maximum));
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => value / total);
};

const family = (pitch: string): "hard" | "breaking" | "soft" => {
  if (["four-seam fastball", "sinker", "cutter"].includes(pitch)) return "hard";
  if (["slider", "sweeper", "curveball"].includes(pitch)) return "breaking";
  return "soft";
};

const modelDistribution = (
  pitcher: PlaygroundPitcher,
  batter: PlaygroundBatter,
  situation: PitchSituation,
  pitch: string,
  location: TargetLocation,
): readonly number[] => {
  const base = BASE[pitch] ?? BASE.slider!;
  const scores = base.map((value) => Math.log(value));
  const whiffSkill = pitcher.seasonWhiffRate - 0.25;
  const batterWhiff = batter.pitchTypeWhiffRate - 0.24;
  const contact = batter.contactRate - 0.77;
  const chase = batter.chaseRate - 0.28;

  scores[2]! += 2.4 * whiffSkill + 1.7 * batterWhiff - 1.4 * contact;
  scores[3]! += 0.8 * contact;
  scores[4]! += 0.7 * contact;
  scores[5]! += 0.9 * contact - 0.7 * whiffSkill;

  if (location.includes("low")) {
    scores[0]! += 0.18;
    scores[2]! += 0.2 + 0.8 * chase;
    scores[5]! -= 0.16;
  }
  if (location.includes("away")) {
    scores[2]! += 0.12 + 0.6 * chase;
    scores[5]! -= 0.12;
  }
  if (location.includes("high")) {
    scores[1]! += 0.1;
    scores[2]! += family(pitch) === "hard" ? 0.2 : -0.05;
  }
  if (location.includes("inside")) {
    scores[3]! += 0.08;
    scores[4]! += 0.07;
  }
  if (location === "middle") {
    scores[0]! -= 0.24;
    scores[1]! += 0.25;
    scores[5]! += 0.34;
  }

  const [, strikesText] = situation.count.split("-");
  const strikes = Number(strikesText);
  if (strikes === 2) {
    scores[0]! += 0.12;
    scores[2]! += 0.17;
    scores[5]! -= 0.08;
  }
  if (situation.count.startsWith("3-")) {
    scores[0]! -= 0.18;
    scores[1]! += 0.18;
    scores[5]! += 0.08;
  }
  if (
    situation.previousPitch !== "none" &&
    family(situation.previousPitch) !== family(pitch)
  ) {
    scores[2]! += 0.17;
    scores[5]! -= 0.06;
  }
  if (situation.previousResult === "swing and miss") scores[0]! += 0.07;
  if (situation.runners !== "empty") scores[1]! += 0.04;
  if (situation.score === "tied") scores[1]! += 0.03;

  return softmax(scores);
};

const goalChance = (
  outcomes: readonly OutcomeChance[],
  goal: RecommendationGoal,
): number => {
  const chance = (name: DecisionOutcome): number =>
    outcomes.find((item) => item.outcome === name)?.chance ?? 0;
  if (goal === "any strike")
    return chance("called strike") + chance("swing and miss") + chance("foul");
  return chance(goal);
};

const runCall = (
  pitcher: PlaygroundPitcher,
  batter: PlaygroundBatter,
  situation: PitchSituation,
  pitch: string,
  location: TargetLocation,
  goal?: RecommendationGoal,
): PitchCallResult => {
  const probabilities = modelDistribution(
    pitcher,
    batter,
    situation,
    pitch,
    location,
  );
  const random = randomGenerator([
    pitcher.id,
    batter.id,
    situation.count,
    situation.previousPitch,
    situation.previousLocation,
    situation.previousResult,
    String(situation.outs),
    situation.runners,
    situation.score,
    pitch,
    location,
  ]);
  const counts = DECISION_OUTCOMES.map(() => 0);
  for (let trial = 0; trial < 40_000; trial += 1) {
    const value = random();
    let cumulative = 0;
    let selected = probabilities.length - 1;
    for (let index = 0; index < probabilities.length; index += 1) {
      cumulative += probabilities[index] ?? 0;
      if (value <= cumulative) {
        selected = index;
        break;
      }
    }
    counts[selected] = (counts[selected] ?? 0) + 1;
  }
  const outcomes = DECISION_OUTCOMES.map((outcome, index) => ({
    outcome,
    chance: (counts[index] ?? 0) / 40_000,
  }));
  const selectedChance = goal
    ? goalChance(outcomes, goal)
    : Math.max(...outcomes.map((item) => item.chance));
  const halfWidth =
    1.96 * Math.sqrt((selectedChance * (1 - selectedChance)) / 40_000);
  return {
    pitch,
    location,
    outcomes,
    ...(goal ? { goalChance: selectedChance } : {}),
    simulationRange: {
      low: clamp(selectedChance - halfWidth, 0, 1),
      high: clamp(selectedChance + halfWidth, 0, 1),
    },
  };
};

const bestLocationFor = (
  pitcher: PlaygroundPitcher,
  batter: PlaygroundBatter,
  situation: PitchSituation,
  pitch: string,
  goal: RecommendationGoal,
): PitchCallResult =>
  TARGET_LOCATIONS.map((location) =>
    runCall(pitcher, batter, situation, pitch, location, goal),
  ).sort((left, right) => (right.goalChance ?? 0) - (left.goalChance ?? 0))[0]!;

const findPlayer = <T extends { readonly id: string; readonly name: string }>(
  players: readonly T[],
  value: string,
): T | undefined =>
  players.find(
    (player) =>
      player.id.toLowerCase() === value.toLowerCase() ||
      player.name.toLowerCase() === value.toLowerCase(),
  );

export const runPitchDecision = (
  request: PitchDecisionRequest,
  data: PlaygroundData,
): PitchDecisionResult => {
  const pitcher = findPlayer(data.pitchers, request.situation.pitcher);
  const batter = findPlayer(data.batters, request.situation.batter);
  if (!pitcher || !batter)
    throw new Error("The selected player is not available.");
  if (!/^[0-3]-[0-2]$/u.test(request.situation.count))
    throw new Error("The count is not valid.");
  if (![0, 1, 2].includes(request.situation.outs))
    throw new Error("Outs must be 0, 1, or 2.");
  if (
    request.situation.previousPitch !== "none" &&
    !TARGET_LOCATIONS.includes(
      request.situation.previousLocation as TargetLocation,
    )
  )
    throw new Error("The previous location is not valid.");

  if (request.question.kind === "predict") {
    const question = request.question;
    if (!pitcher.pitchMix.some((item) => item.pitch === question.pitch))
      throw new Error("The next pitch is not in this pitcher's arsenal.");
    if (!TARGET_LOCATIONS.includes(question.location))
      throw new Error("The target location is not valid.");
    const selected = runCall(
      pitcher,
      batter,
      request.situation,
      question.pitch,
      question.location,
    );
    return {
      mode: "pitch decision",
      study: request.study,
      question: request.question,
      situation: request.situation,
      selected,
      trials: 40_000,
      model: {
        name: "local demonstration outcome model",
        version: "demo-2.0.0",
        status: "illustrative",
      },
      notices: [
        "The six outcomes are separate and total 100%.",
        "The range covers simulation error only.",
        "The data and model are synthetic demonstration resources.",
      ],
    };
  }

  if (!RECOMMENDATION_GOALS.includes(request.question.goal))
    throw new Error("The recommendation goal is not valid.");
  const goal = request.question.goal;
  const calls = pitcher.pitchMix
    .filter((item) => item.share >= 0.05)
    .map((item) =>
      bestLocationFor(pitcher, batter, request.situation, item.pitch, goal),
    )
    .sort((left, right) => (right.goalChance ?? 0) - (left.goalChance ?? 0));
  return {
    mode: "pitch decision",
    study: request.study,
    question: request.question,
    situation: request.situation,
    selected: calls[0]!,
    recommendations: calls.slice(0, 3),
    trials: 40_000,
    model: {
      name: "local demonstration outcome model",
      version: "demo-2.0.0",
      status: "illustrative",
    },
    notices: [
      "The recommendation tests each pitch in this pitcher’s demonstrated arsenal.",
      "Each pitch uses its best tested target location.",
      "The range covers simulation error only.",
      "The data and model are synthetic demonstration resources.",
    ],
  };
};

const valueMap = (
  source: string,
  block: string,
): Readonly<Record<string, string>> => {
  const values: Record<string, string> = {};
  let active = false;
  for (const line of source.split(/\r?\n/u)) {
    const top = /^(\S[^:]*):\s*(.*)$/u.exec(line);
    if (top) {
      active = top[1] === block;
      continue;
    }
    if (!active) continue;
    const child = /^\s{2}([^:]+):\s*(.+)$/u.exec(line);
    if (child?.[1] && child[2]) values[child[1].trim()] = child[2].trim();
  }
  return values;
};

const childKeys = (source: string, block: string): readonly string[] => {
  const keys: string[] = [];
  let active = false;
  for (const line of source.split(/\r?\n/u)) {
    const top = /^(\S[^:]*):\s*(.*)$/u.exec(line);
    if (top) {
      active = top[1] === block;
      continue;
    }
    if (!active) continue;
    const child = /^\s{2}([^:]+):\s*(.*)$/u.exec(line);
    if (child?.[1]) keys.push(child[1].trim());
  }
  return keys;
};

const listItems = (source: string, block: string): readonly string[] => {
  const items: string[] = [];
  let active = false;
  for (const line of source.split(/\r?\n/u)) {
    const top = /^(\S[^:]*):\s*(.*)$/u.exec(line);
    if (top) {
      active = top[1] === block;
      continue;
    }
    if (!active) continue;
    const item = /^\s{2}-\s+(.+)$/u.exec(line);
    if (item?.[1]) items.push(item[1].trim());
  }
  return items;
};

export const parseDecisionSource = (
  source: string,
  data: PlaygroundData,
): DecisionParseResult => {
  const diagnostics: DecisionParseResult["diagnostics"][number][] = [];
  const fail = (message: string, hint?: string): void => {
    diagnostics.push({
      code: "S260",
      stage: "semantic",
      severity: "error",
      message,
      ...(hint ? { hint } : {}),
    });
  };
  const topEntries = source
    .split(/\r?\n/u)
    .map((line) => /^(\S[^:]*):\s*(.*)$/u.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => [match[1]!.trim(), match[2]!.trim()] as const);
  const top = Object.fromEntries(topEntries);
  const allowedBlocks = new Set([
    "study",
    "source",
    "situation",
    "question",
    "using",
    "include",
  ]);
  for (const [name] of topEntries) {
    if (!allowedBlocks.has(name)) fail(`Unknown block '${name}'.`);
  }
  for (const required of ["study", "source", "situation", "question"]) {
    if (!topEntries.some(([name]) => name === required))
      fail(`The study needs the '${required}' block.`);
  }
  if (topEntries.some(([name]) => name === "study") && !top.study)
    fail("The study needs a name.");
  if (topEntries.some(([name]) => name === "source") && !top.source)
    fail("The source needs a catalog name.");
  const seenBlocks = new Set<string>();
  for (const [name] of topEntries) {
    if (seenBlocks.has(name))
      fail(`The '${name}' block occurs more than once.`);
    seenBlocks.add(name);
  }

  const situation = valueMap(source, "situation");
  const question = valueMap(source, "question");
  const using = valueMap(source, "using");
  const allowedSituation = new Set([
    "pitcher",
    "batter",
    "count",
    "previous pitch",
    "previous location",
    "previous result",
    "outs",
    "runners",
    "score",
  ]);
  for (const key of childKeys(source, "situation")) {
    if (!allowedSituation.has(key)) fail(`Unknown situation field '${key}'.`);
  }
  const allowedQuestion = new Set([
    "outcomes for",
    "target location",
    "best pitch for",
  ]);
  for (const key of childKeys(source, "question")) {
    if (!allowedQuestion.has(key)) fail(`Unknown question field '${key}'.`);
  }
  const allowedUsing = new Set(["model", "simulation"]);
  for (const key of childKeys(source, "using")) {
    if (!allowedUsing.has(key)) fail(`Unknown using field '${key}'.`);
  }
  if (using.simulation && using.simulation !== "automatic")
    fail("Simulation must be automatic.");
  const allowedInclude = new Set(["outcome chances", "uncertainty"]);
  for (const item of listItems(source, "include")) {
    if (!allowedInclude.has(item)) fail(`Unknown include item '${item}'.`);
  }

  const pitcher = findPlayer(data.pitchers, situation.pitcher ?? "");
  const batter = findPlayer(data.batters, situation.batter ?? "");
  if (!pitcher)
    fail(
      "The situation needs an available pitcher.",
      "Add 'pitcher: Alex Morgan'.",
    );
  if (!batter)
    fail(
      "The situation needs an available batter.",
      "Add 'batter: Taylor Kim'.",
    );
  if (!/^[0-3]-[0-2]$/u.test(situation.count ?? ""))
    fail(
      "The situation needs a valid count.",
      "Add a count such as 'count: 1-2'.",
    );
  const location =
    situation["previous pitch"] === "none"
      ? "none"
      : (situation["previous location"] as TargetLocation);
  if (
    location !== "none" &&
    !TARGET_LOCATIONS.includes(location as TargetLocation)
  )
    fail("Select a valid previous location.");
  const previousResults = [
    "ball",
    "called strike",
    "swing and miss",
    "foul",
    "in play",
  ];
  if (
    situation["previous pitch"] !== "none" &&
    !previousResults.includes(situation["previous result"] ?? "")
  )
    fail("Select a valid previous result.");
  const outs = Number(situation.outs);
  if (![0, 1, 2].includes(outs)) fail("Outs must be 0, 1, or 2.");
  if (
    ![
      "empty",
      "first",
      "second",
      "third",
      "first and second",
      "loaded",
    ].includes(situation.runners ?? "")
  )
    fail("Select a valid runner state.");
  if (!["ahead", "tied", "behind"].includes(situation.score ?? ""))
    fail("Score must be ahead, tied, or behind.");

  let parsedQuestion: DecisionQuestion | undefined;
  const predict = Boolean(question["outcomes for"]);
  const recommend = Boolean(question["best pitch for"]);
  if (predict && recommend) {
    fail("The question must contain only one task.");
  } else if (predict) {
    const targetLocation = question["target location"] as TargetLocation;
    if (!TARGET_LOCATIONS.includes(targetLocation))
      fail("Select a valid target location.");
    const pitch = question["outcomes for"]!;
    if (pitcher && !pitcher.pitchMix.some((item) => item.pitch === pitch))
      fail("The selected pitch is not in this pitcher's arsenal.");
    if (TARGET_LOCATIONS.includes(targetLocation))
      parsedQuestion = { kind: "predict", pitch, location: targetLocation };
  } else if (recommend) {
    const goal = question["best pitch for"] as RecommendationGoal;
    if (!RECOMMENDATION_GOALS.includes(goal))
      fail("Select a valid recommendation goal.");
    else parsedQuestion = { kind: "recommend", goal };
  } else {
    fail(
      "The question needs one task.",
      "Use 'outcomes for' or 'best pitch for'.",
    );
  }

  if (diagnostics.length || !pitcher || !batter || !parsedQuestion)
    return { diagnostics };
  return {
    request: {
      study: top.study || "Next pitch decision",
      situation: {
        pitcher: pitcher.id,
        batter: batter.id,
        count: situation.count!,
        previousPitch: situation["previous pitch"] ?? "none",
        previousLocation: location,
        previousResult:
          situation["previous pitch"] === "none"
            ? "none"
            : (situation["previous result"] ?? "ball"),
        outs,
        runners: situation.runners ?? "empty",
        score: situation.score ?? "tied",
      },
      question: parsedQuestion,
    },
    diagnostics,
  };
};
