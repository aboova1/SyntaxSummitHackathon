import {
  ATOMIC_PITCHES,
  FEATURE_GROUPS,
  IMMEDIATE_OUTCOMES,
  MATCH_FIELDS,
  PITCH_GROUPS,
  PLATE_APPEARANCE_OUTCOMES,
  type DateRange,
  type EvidenceType,
  type Facts,
  type FeatureGroup,
  type Horizon,
  type MatchField,
  type Outcome,
  type PitchName,
  type PreviousConstraint,
  type IncludedView,
  type ResourceSelection,
  type Scope,
  type SeamDocument,
  type Sequence,
  type Target,
} from "./ast.js";
import type { CstMapping, CstScalar } from "./cst.js";
import { MappingReader, parseCommaList, parseEnum } from "./cst-reader.js";
import { error, hasErrors, type Diagnostic } from "./diagnostic.js";

export interface SemanticResult {
  readonly document?: SeamDocument;
  readonly diagnostics: readonly Diagnostic[];
}

const TOP_LEVEL_KEYS = [
  "study",
  "source",
  "scope",
  "resources",
  "target",
  "sequence",
  "facts",
  "evidence",
  "include",
] as const;
const SCOPE_KEYS = [
  "seasons",
  "dates",
  "games",
  "teams",
  "pitchers",
  "batters",
  "counts",
  "batter sides",
] as const;
const RESOURCE_KEYS = ["model", "matching", "simulator"] as const;
const TARGET_KEYS = ["event", "pitch", "period"] as const;
const SEQUENCE_KEYS = ["after", "versus", "lookback"] as const;
const FACT_KEYS = ["match", "consider"] as const;
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

const parseCounts = (
  scalar: CstScalar | undefined,
  diagnostics: Diagnostic[],
): readonly string[] | undefined => {
  if (!scalar) return undefined;
  const values = parseCommaList(scalar);
  if (
    values.length > 0 &&
    values.every((value) => /^[0-3]-[0-2]$/u.test(value))
  )
    return values;
  diagnostics.push(
    error("semantic", "S214", `Invalid count list '${scalar.value}'.`, {
      hint: "Use values such as '0-0, 1-2, 2-2'.",
      span: scalar.span,
    }),
  );
  return undefined;
};

const parseScope = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): Omit<Scope, "span"> => {
  const reader = new MappingReader(mapping, diagnostics, SCOPE_KEYS, "scope");
  const seasons = parseSeasons(reader.optionalScalar("seasons"), diagnostics);
  const dates = parseDates(reader.optionalScalar("dates"), diagnostics);
  const games = parseEnum(
    reader.optionalScalar("games"),
    GAME_FILTERS,
    diagnostics,
    "games value",
  );
  const counts = parseCounts(reader.optionalScalar("counts"), diagnostics);
  const batterSides = parseTypedList(
    reader.optionalScalar("batter sides"),
    ["left", "right", "switch"] as const,
    diagnostics,
    "batter side",
  );
  return {
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
    ...(counts ? { counts } : {}),
    ...(batterSides.length > 0 ? { batterSides } : {}),
  };
};

const parseResources = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): ResourceSelection => {
  const reader = new MappingReader(
    mapping,
    diagnostics,
    RESOURCE_KEYS,
    "resources",
  );
  return {
    ...(reader.optionalScalar("model")?.value
      ? { model: reader.optionalScalar("model")!.value }
      : {}),
    ...(reader.optionalScalar("matching")?.value
      ? { matching: reader.optionalScalar("matching")!.value }
      : {}),
    ...(reader.optionalScalar("simulator")?.value
      ? { simulator: reader.optionalScalar("simulator")!.value }
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

const parseLookback = (
  scalar: CstScalar | undefined,
  diagnostics: Diagnostic[],
): number | undefined => {
  if (!scalar) return undefined;
  const match = /^([1-9]\d*) pitch(?:es)?$/u.exec(scalar.value);
  if (!match) {
    diagnostics.push(
      error("semantic", "S220", `Invalid lookback '${scalar.value}'.`, {
        hint: "Use '1 pitch' or '2 pitches'.",
        span: scalar.span,
      }),
    );
    return undefined;
  }
  const value = Number(match[1]);
  if (value > 20) {
    diagnostics.push(
      error("semantic", "S221", "A lookback cannot exceed 20 pitches.", {
        hint: "Use a smaller window inside one plate appearance.",
        span: scalar.span,
      }),
    );
    return undefined;
  }
  return value;
};

const makePrevious = (
  kind: PreviousConstraint["kind"],
  scalar: CstScalar,
  lookback: number,
  diagnostics: Diagnostic[],
): PreviousConstraint | undefined => {
  const pitches = parsePitchList(scalar, diagnostics);
  if (kind === "exclude" && pitches.length !== 1) {
    diagnostics.push(
      error("semantic", "S223", "A 'without' baseline accepts one pitch.", {
        hint: "Use 'versus: without fastball'.",
        span: scalar.span,
      }),
    );
  }
  if (kind === "sequence" && pitches.length > lookback) {
    diagnostics.push(
      error("semantic", "S224", "The sequence is longer than its lookback.", {
        hint: `Use a lookback of at least ${pitches.length} pitches.`,
        span: scalar.span,
      }),
    );
  }
  if (pitches.length === 0) return undefined;
  return { kind, pitches, lookback, span: scalar.span };
};

const parseSequence = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): Sequence | undefined => {
  const reader = new MappingReader(
    mapping,
    diagnostics,
    SEQUENCE_KEYS,
    "sequence",
  );
  const after = reader.requiredScalar("after");
  const versus = reader.optionalScalar("versus");
  const lookback = parseLookback(
    reader.requiredScalar("lookback"),
    diagnostics,
  );
  if (!after || lookback === undefined) return undefined;

  const primary = makePrevious("sequence", after, lookback, diagnostics);
  let baseline: PreviousConstraint | undefined;
  if (versus) {
    const without = /^without\s+(.+)$/u.exec(versus.value);
    const afterBaseline = /^after\s+(.+)$/u.exec(versus.value);
    if (!without && !afterBaseline) {
      diagnostics.push(
        error(
          "semantic",
          "S222",
          "A versus value must start with 'after' or 'without'.",
          {
            hint: "Use 'versus: without fastball' or 'versus: after changeup'.",
            span: versus.span,
          },
        ),
      );
    } else {
      const value = without?.[1] ?? afterBaseline?.[1] ?? "";
      baseline = makePrevious(
        without ? "exclude" : "sequence",
        { ...versus, value },
        lookback,
        diagnostics,
      );
    }
  }

  if (!primary) return undefined;
  return {
    after: primary,
    ...(baseline ? { versus: baseline } : {}),
    span: mapping.span,
  };
};

const parseTarget = (
  mapping: CstMapping,
  diagnostics: Diagnostic[],
): Target | undefined => {
  const reader = new MappingReader(mapping, diagnostics, TARGET_KEYS, "target");
  const pitch = parseEnum(
    reader.requiredScalar("pitch"),
    PITCHES,
    diagnostics,
    "target pitch",
  );
  const periodScalar = reader.optionalScalar("period");
  const explicitPeriod = parseEnum(
    periodScalar,
    HORIZONS,
    diagnostics,
    "period",
  );
  const eventScalar = reader.requiredScalar("event");
  const allOutcomes = [
    ...IMMEDIATE_OUTCOMES,
    ...PLATE_APPEARANCE_OUTCOMES,
  ] as const;
  const outcome = parseEnum(eventScalar, allOutcomes, diagnostics, "event");
  const horizon: Horizon | undefined = explicitPeriod
    ? (explicitPeriod as Horizon)
    : outcome &&
        PLATE_APPEARANCE_OUTCOMES.includes(outcome as never) &&
        !IMMEDIATE_OUTCOMES.includes(outcome as never)
      ? "plate appearance"
      : outcome
        ? "this pitch"
        : undefined;
  if (!pitch) {
    diagnostics.push(
      error("semantic", "S230", "A target needs a pitch.", {
        hint: "Add 'pitch:' inside 'target'.",
        span: mapping.span,
      }),
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
        span: eventScalar?.span ?? mapping.span,
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
          span: eventScalar?.span ?? mapping.span,
        },
      ),
    );
  }
  if (!pitch || !horizon || !outcome) return undefined;
  return {
    pitch,
    event: outcome as Outcome,
    period: horizon as Horizon,
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
    consider: parseTypedList(
      reader.optionalScalar("consider"),
      FEATURE_GROUPS,
      diagnostics,
      "feature group",
    ) as readonly FeatureGroup[],
    span: mapping.span,
  };
};

const parseInclude = (
  items: readonly CstScalar[],
  diagnostics: Diagnostic[],
): readonly IncludedView[] => {
  const additions: IncludedView[] = [];
  for (const item of items) {
    const examples = /^([1-9]\d*) examples$/u.exec(item.value);
    if (examples) {
      const count = Number(examples[1]);
      if (count > 20) {
        diagnostics.push(
          error(
            "semantic",
            "S240",
            "A study can include at most 20 examples.",
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
      "included view",
    );
    if (kind) additions.push({ kind, span: item.span });
  }
  return additions;
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
            hint: "Use this order: study, source, scope, resources, target, sequence, facts, evidence, include.",
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
  const source = reader.requiredScalar("source");
  const scopeMapping = reader.optionalMapping("scope");
  const scope = scopeMapping ? parseScope(scopeMapping, diagnostics) : {};
  const resourcesMapping = reader.optionalMapping("resources");
  const resources = resourcesMapping
    ? parseResources(resourcesMapping, diagnostics)
    : undefined;
  const targetMapping = reader.requiredMapping("target");
  const target = targetMapping
    ? parseTarget(targetMapping, diagnostics)
    : undefined;
  const sequenceMapping = reader.optionalMapping("sequence");
  const sequence = sequenceMapping
    ? parseSequence(sequenceMapping, diagnostics)
    : undefined;
  const factsMapping = reader.optionalMapping("facts");
  const facts = factsMapping
    ? parseFacts(factsMapping, diagnostics)
    : undefined;
  const evidence = parseEnum(
    reader.requiredScalar("evidence"),
    METHODS,
    diagnostics,
    "evidence type",
  );
  const includeSequence = reader.optionalSequence("include");
  const include = includeSequence
    ? parseInclude(includeSequence.items, diagnostics)
    : [];

  if (!source || !target || !evidence || hasErrors(diagnostics))
    return { diagnostics };
  return {
    document: {
      version: "0.3",
      ...(study ? { study } : {}),
      source: source.value,
      ...(scopeMapping ? { scope: { ...scope, span: scopeMapping.span } } : {}),
      ...(resources ? { resources } : {}),
      target,
      ...(sequence ? { sequence } : {}),
      ...(facts ? { facts } : {}),
      evidence: evidence as EvidenceType,
      include,
      span: root.span,
    },
    diagnostics,
  };
};
