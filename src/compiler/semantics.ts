import {
  ATOMIC_PITCHES,
  FEATURE_GROUPS,
  IMMEDIATE_OUTCOMES,
  MATCH_FIELDS,
  PITCH_GROUPS,
  PLATE_APPEARANCE_OUTCOMES,
  type Analysis,
  type AnalysisMethod,
  type DataScope,
  type DateRange,
  type Facts,
  type FeatureGroup,
  type Horizon,
  type MatchField,
  type Outcome,
  type PitchName,
  type PreviousConstraint,
  type RecordCondition,
  type ReportAddition,
  type ResourceSelection,
  type SeamDocument,
  type Target,
} from "./ast.js";
import type { CstMapping, CstScalar } from "./cst.js";
import { MappingReader, parseCommaList, parseEnum } from "./cst-reader.js";
import { error, hasErrors, type Diagnostic } from "./diagnostic.js";

export interface SemanticResult {
  readonly document?: SeamDocument;
  readonly diagnostics: readonly Diagnostic[];
}

const TOP_LEVEL_KEYS = ["study", "data", "use", "analyze"] as const;
const DATA_KEYS = [
  "source",
  "seasons",
  "dates",
  "games",
  "teams",
  "pitchers",
  "batters",
] as const;
const USE_KEYS = ["model", "comparison", "simulation"] as const;
const ANALYZE_KEYS = [
  "target",
  "when",
  "versus",
  "facts",
  "method",
  "report",
] as const;
const TARGET_KEYS = ["pitch", "outcome", "horizon"] as const;
const CONDITION_KEYS = ["previous"] as const;
const PREVIOUS_KEYS = ["sequence", "exclude", "window"] as const;
const FACT_KEYS = ["match", "account for"] as const;
const METHODS = ["observed", "model", "simulation"] as const;
const HORIZONS = ["this pitch", "plate appearance"] as const;
const GAME_FILTERS = [
  "regular season",
  "postseason",
  "spring training",
  "all games",
] as const;
const PITCHES = [...ATOMIC_PITCHES, ...PITCH_GROUPS] as const;

const isIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
};

const parseDates = (
  scalar: CstScalar | undefined,
  diagnostics: Diagnostic[],
): DateRange | undefined => {
  if (!scalar) return undefined;
  const range = /^(\d{4}-\d{2}-\d{2}) through (\d{4}-\d{2}-\d{2})$/u.exec(
    scalar.value,
  );
  if (
    !range ||
    !range[1] ||
    !range[2] ||
    !isIsoDate(range[1]) ||
    !isIsoDate(range[2])
  ) {
    diagnostics.push(
      error("semantic", "S212", `Invalid date range '${scalar.value}'.`, {
        hint: "Use '2025-04-01 through 2025-04-30'.",
        span: scalar.span,
      }),
    );
    return undefined;
  }
  if (range[1] > range[2]) {
    diagnostics.push(
      error("semantic", "S213", "The first date is after the last date.", {
        hint: "Write the earlier date first.",
        span: scalar.span,
      }),
    );
    return undefined;
  }
  return { start: range[1], end: range[2] };
};

const parseSeasons = (
  scalar: CstScalar | undefined,
  diagnostics: Diagnostic[],
): readonly number[] | undefined => {
  if (!scalar) return undefined;
  const range = /^(\d{4}) through (\d{4})$/u.exec(scalar.value);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start > end) {
      diagnostics.push(
        error(
          "semantic",
          "S210",
          "The first season is after the last season.",
          {
            hint: "Write the earlier season first.",
            span: scalar.span,
          },
        ),
      );
      return undefined;
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  const values = parseCommaList(scalar);
  if (values.length > 0 && values.every((value) => /^\d{4}$/u.test(value))) {
    return values.map(Number);
  }
  diagnostics.push(
    error("semantic", "S211", `Invalid seasons value '${scalar.value}'.`, {
      hint: "Use '2023 through 2025' or '2023, 2025'.",
      span: scalar.span,
    }),
  );
  return undefined;
};

const parseData = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): DataScope | undefined => {
  const reader = new MappingReader(mapping, diagnostics, DATA_KEYS, "data");
  const source = reader.requiredScalar("source");
  const seasons = parseSeasons(reader.optionalScalar("seasons"), diagnostics);
  const dates = parseDates(reader.optionalScalar("dates"), diagnostics);
  const games = parseEnum(
    reader.optionalScalar("games"),
    GAME_FILTERS,
    diagnostics,
    "games value",
  );
  if (!source) return undefined;
  return {
    source: source.value,
    ...(seasons ? { seasons } : {}),
    ...(dates ? { dates } : {}),
    ...(games ? { games } : {}),
    ...(reader.optionalScalar("teams")
      ? { teams: parseCommaList(reader.optionalScalar("teams")) }
      : {}),
    ...(reader.optionalScalar("pitchers")
      ? { pitchers: parseCommaList(reader.optionalScalar("pitchers")) }
      : {}),
    ...(reader.optionalScalar("batters")
      ? { batters: parseCommaList(reader.optionalScalar("batters")) }
      : {}),
    span: mapping.span,
  };
};

const parseUse = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): ResourceSelection => {
  const reader = new MappingReader(mapping, diagnostics, USE_KEYS, "use");
  return {
    ...(reader.optionalScalar("model")?.value
      ? { model: reader.optionalScalar("model")!.value }
      : {}),
    ...(reader.optionalScalar("comparison")?.value
      ? { comparison: reader.optionalScalar("comparison")!.value }
      : {}),
    ...(reader.optionalScalar("simulation")?.value
      ? { simulation: reader.optionalScalar("simulation")!.value }
      : {}),
    span: mapping.span,
  };
};

const parsePitchList = (
  scalar: CstScalar | undefined,
  diagnostics: Diagnostic[],
): readonly PitchName[] => {
  if (!scalar) return [];
  const values = parseCommaList(scalar);
  const result: PitchName[] = [];
  for (const value of values) {
    const pitch = parseEnum(
      { ...scalar, value },
      PITCHES,
      diagnostics,
      "pitch",
    );
    if (pitch) result.push(pitch);
  }
  return result;
};

const parseWindow = (
  scalar: CstScalar | undefined,
  diagnostics: Diagnostic[],
): number | undefined => {
  if (!scalar) return undefined;
  const match = /^([1-9]\d*) pitch(?:es)?$/u.exec(scalar.value);
  if (!match) {
    diagnostics.push(
      error(
        "semantic",
        "S220",
        `Invalid prior-pitch window '${scalar.value}'.`,
        {
          hint: "Use '1 pitch' or '2 pitches'.",
          span: scalar.span,
        },
      ),
    );
    return undefined;
  }
  const value = Number(match[1]);
  if (value > 20) {
    diagnostics.push(
      error(
        "semantic",
        "S221",
        "A prior-pitch window cannot exceed 20 pitches.",
        {
          hint: "Use a smaller window inside one plate appearance.",
          span: scalar.span,
        },
      ),
    );
    return undefined;
  }
  return value;
};

const parsePrevious = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): PreviousConstraint | undefined => {
  const reader = new MappingReader(
    mapping,
    diagnostics,
    PREVIOUS_KEYS,
    "previous",
  );
  const sequence = reader.optionalScalar("sequence");
  const exclude = reader.optionalScalar("exclude");
  if ((sequence && exclude) || (!sequence && !exclude)) {
    diagnostics.push(
      error(
        "semantic",
        "S222",
        "A previous block needs one sequence or one exclusion.",
        {
          hint: "Use either 'sequence:' or 'exclude:'.",
          span: mapping.span,
        },
      ),
    );
    return undefined;
  }
  const window = parseWindow(reader.requiredScalar("window"), diagnostics);
  const selected = sequence ?? exclude;
  const pitches = parsePitchList(selected, diagnostics);
  if (exclude && pitches.length !== 1) {
    diagnostics.push(
      error("semantic", "S223", "An exclusion accepts one pitch name.", {
        hint: "Write one pitch after 'exclude:'.",
        span: exclude.span,
      }),
    );
  }
  if (sequence && window !== undefined && pitches.length > window) {
    diagnostics.push(
      error(
        "semantic",
        "S224",
        "The prior sequence is longer than its window.",
        {
          hint: `Use a window of at least ${pitches.length} pitches.`,
          span: mapping.span,
        },
      ),
    );
  }
  if (!selected || window === undefined || pitches.length === 0)
    return undefined;
  return {
    kind: sequence ? "sequence" : "exclude",
    pitches,
    window,
    span: mapping.span,
  };
};

const parseCondition = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
  path: "when" | "versus",
): RecordCondition | undefined => {
  const reader = new MappingReader(mapping, diagnostics, CONDITION_KEYS, path);
  const previousMapping = reader.requiredMapping("previous");
  if (!previousMapping) return undefined;
  const previous = parsePrevious(previousMapping, diagnostics);
  if (!previous) return undefined;
  return { previous, span: mapping.span };
};

const parseTarget = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): Target | undefined => {
  const reader = new MappingReader(mapping, diagnostics, TARGET_KEYS, "target");
  const pitch = parseEnum(
    reader.optionalScalar("pitch"),
    PITCHES,
    diagnostics,
    "target pitch",
  );
  const horizon = parseEnum(
    reader.requiredScalar("horizon"),
    HORIZONS,
    diagnostics,
    "horizon",
  );
  const outcomeScalar = reader.requiredScalar("outcome");
  const allOutcomes = [
    ...IMMEDIATE_OUTCOMES,
    ...PLATE_APPEARANCE_OUTCOMES,
  ] as const;
  const outcome = parseEnum(outcomeScalar, allOutcomes, diagnostics, "outcome");
  if (!pitch) {
    diagnostics.push(
      error(
        "semantic",
        "S230",
        "A target needs an anchor pitch in version 0.2.",
        {
          hint: "Add 'pitch:' inside 'target'.",
          span: mapping.span,
        },
      ),
    );
  }
  if (
    horizon === "this pitch" &&
    outcome &&
    !IMMEDIATE_OUTCOMES.includes(outcome as never)
  ) {
    diagnostics.push(
      error("semantic", "S231", `'${outcome}' is not a one-pitch outcome.`, {
        hint: `Use one of: ${IMMEDIATE_OUTCOMES.join(", ")}.`,
        span: outcomeScalar?.span ?? mapping.span,
      }),
    );
  }
  if (
    horizon === "plate appearance" &&
    outcome &&
    !PLATE_APPEARANCE_OUTCOMES.includes(outcome as never)
  ) {
    diagnostics.push(
      error(
        "semantic",
        "S232",
        `'${outcome}' is not a plate-appearance outcome.`,
        {
          hint: `Use one of: ${PLATE_APPEARANCE_OUTCOMES.join(", ")}.`,
          span: outcomeScalar?.span ?? mapping.span,
        },
      ),
    );
  }
  if (!horizon || !outcome) return undefined;
  return {
    ...(pitch ? { pitch } : {}),
    outcome: outcome as Outcome,
    horizon: horizon as Horizon,
    span: mapping.span,
  };
};

const parseTypedList = <T extends string>(
  scalar: CstScalar | undefined,
  allowed: readonly T[],
  diagnostics: Diagnostic[],
  label: string,
): readonly T[] => {
  if (!scalar) return [];
  const result: T[] = [];
  for (const value of parseCommaList(scalar)) {
    const parsed = parseEnum({ ...scalar, value }, allowed, diagnostics, label);
    if (parsed) result.push(parsed);
  }
  return result;
};

const parseFacts = (mapping: CstMapping, diagnostics: Diagnostic[]): Facts => {
  const reader = new MappingReader(mapping, diagnostics, FACT_KEYS, "facts");
  return {
    match: parseTypedList(
      reader.optionalScalar("match"),
      MATCH_FIELDS,
      diagnostics,
      "match fact",
    ) as readonly MatchField[],
    accountFor: parseTypedList(
      reader.optionalScalar("account for"),
      FEATURE_GROUPS,
      diagnostics,
      "feature group",
    ) as readonly FeatureGroup[],
    span: mapping.span,
  };
};

const parseReport = (
  items: readonly CstScalar[],
  diagnostics: Diagnostic[],
): readonly ReportAddition[] => {
  const additions: ReportAddition[] = [];
  for (const item of items) {
    const examples = /^([1-9]\d*) examples$/u.exec(item.value);
    if (examples) {
      const count = Number(examples[1]);
      if (count > 20) {
        diagnostics.push(
          error(
            "semantic",
            "S240",
            "The report can include at most 20 examples.",
            {
              hint: "Use '20 examples' or fewer.",
              span: item.span,
            },
          ),
        );
      } else {
        additions.push({ kind: "examples", count, span: item.span });
      }
      continue;
    }
    const kind = parseEnum(
      item,
      [
        "zone map",
        "pitcher breakdown",
        "batter breakdown",
        "park breakdown",
      ] as const,
      diagnostics,
      "report item",
    );
    if (kind) additions.push({ kind, span: item.span });
  }
  return additions;
};

const parseAnalysis = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): Analysis | undefined => {
  const reader = new MappingReader(
    mapping,
    diagnostics,
    ANALYZE_KEYS,
    "analyze",
  );
  const targetMapping = reader.requiredMapping("target");
  const target = targetMapping
    ? parseTarget(targetMapping, diagnostics)
    : undefined;
  const whenMapping = reader.optionalMapping("when");
  const when = whenMapping
    ? parseCondition(whenMapping, diagnostics, "when")
    : undefined;
  const versusMapping = reader.optionalMapping("versus");
  const versus = versusMapping
    ? parseCondition(versusMapping, diagnostics, "versus")
    : undefined;
  const factsMapping = reader.optionalMapping("facts");
  const facts = factsMapping
    ? parseFacts(factsMapping, diagnostics)
    : undefined;
  const method = parseEnum(
    reader.requiredScalar("method"),
    METHODS,
    diagnostics,
    "method",
  );
  const reportSequence = reader.optionalSequence("report");
  const report = reportSequence
    ? parseReport(reportSequence.items, diagnostics)
    : [];
  if (!target || !method) return undefined;
  return {
    target,
    ...(when ? { when } : {}),
    ...(versus ? { versus } : {}),
    ...(facts ? { facts } : {}),
    method: method as AnalysisMethod,
    report,
    span: mapping.span,
  };
};

const checkTopLevelOrder = (
  root: CstMapping,
  diagnostics: Diagnostic[],
): void => {
  const order = root.entries.map((entry) =>
    TOP_LEVEL_KEYS.indexOf(entry.key as never),
  );
  let previous = -1;
  for (let index = 0; index < order.length; index += 1) {
    const current = order[index];
    if (current === undefined || current < 0) continue;
    if (current < previous) {
      const entry = root.entries[index];
      diagnostics.push(
        error(
          "semantic",
          "S250",
          `Top-level key '${entry?.key}' is out of order.`,
          {
            hint: "Use this order: study, data, use, analyze.",
            ...(entry ? { span: entry.keySpan } : {}),
          },
        ),
      );
    }
    previous = current;
  }
};

export const analyzeSemantics = (
  root: CstMapping,
  priorDiagnostics: readonly Diagnostic[] = [],
): SemanticResult => {
  const diagnostics = [...priorDiagnostics];
  const reader = new MappingReader(
    root,
    diagnostics,
    TOP_LEVEL_KEYS,
    "document",
  );
  checkTopLevelOrder(root, diagnostics);
  const study = reader.optionalScalar("study")?.value;
  const dataMapping = reader.requiredMapping("data");
  const useMapping = reader.optionalMapping("use");
  const analyzeMapping = reader.requiredMapping("analyze");
  const data = dataMapping ? parseData(dataMapping, diagnostics) : undefined;
  const use = useMapping ? parseUse(useMapping, diagnostics) : undefined;
  const analyze = analyzeMapping
    ? parseAnalysis(analyzeMapping, diagnostics)
    : undefined;

  if (!data || !analyze || hasErrors(diagnostics)) return { diagnostics };
  return {
    document: {
      version: "0.2",
      ...(study ? { study } : {}),
      data,
      ...(use ? { use } : {}),
      analyze,
      span: root.span,
    },
    diagnostics,
  };
};
