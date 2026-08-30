import type {
  CstMapping,
  CstMappingEntry,
  CstNode,
  CstScalar,
  CstSequence,
} from "./cst.js";
import { error, type Diagnostic } from "./diagnostic.js";
import type { SourceSpan } from "./source.js";

const editDistance = (left: string, right: string): number => {
  const rows = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let row = 0; row <= left.length; row += 1) rows[row]![0] = row;
  for (let column = 0; column <= right.length; column += 1)
    rows[0]![column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + cost,
      );
    }
  }
  return rows[left.length]![right.length]!;
};

const nearest = (
  value: string,
  allowed: readonly string[],
): string | undefined => {
  const preferred: Readonly<Record<string, string>> = {
    result: "outcome",
    estimate: "analyze",
    compare: "versus",
    show: "report",
    factors: "account for",
  };
  const preferredValue = preferred[value];
  if (preferredValue && allowed.includes(preferredValue)) return preferredValue;
  const ranked = allowed
    .map((candidate) => ({
      candidate,
      distance: editDistance(value, candidate),
    }))
    .sort((a, b) => a.distance - b.distance);
  const best = ranked[0];
  if (!best || best.distance > Math.max(2, Math.floor(value.length / 3)))
    return undefined;
  return best.candidate;
};

export class MappingReader {
  readonly mapping: CstMapping;
  readonly diagnostics: Diagnostic[];
  readonly #entries = new Map<string, CstMappingEntry>();

  constructor(
    mapping: CstMapping,
    diagnostics: Diagnostic[],
    allowed: readonly string[],
    path: string,
  ) {
    this.mapping = mapping;
    this.diagnostics = diagnostics;

    for (const entry of mapping.entries) {
      if (this.#entries.has(entry.key)) {
        diagnostics.push(
          error(
            "semantic",
            "S201",
            `Duplicate key '${entry.key}' in ${path}.`,
            {
              hint: "Keep one value for each key.",
              span: entry.keySpan,
            },
          ),
        );
        continue;
      }
      this.#entries.set(entry.key, entry);
      if (!allowed.includes(entry.key)) {
        const suggestion = nearest(entry.key, allowed);
        diagnostics.push(
          error("semantic", "S202", `Unknown key '${entry.key}' in ${path}.`, {
            hint: suggestion
              ? `Use '${suggestion}'.`
              : `Use one of: ${allowed.join(", ")}.`,
            span: entry.keySpan,
          }),
        );
      }
    }
  }

  entry(key: string): CstMappingEntry | undefined {
    return this.#entries.get(key);
  }

  optionalScalar(key: string): CstScalar | undefined {
    const entry = this.entry(key);
    if (!entry) return undefined;
    if (entry.value.kind !== "scalar") {
      this.#wrongType(key, "a value", entry.value);
      return undefined;
    }
    return entry.value;
  }

  requiredScalar(key: string): CstScalar | undefined {
    const value = this.optionalScalar(key);
    if (!this.entry(key)) this.#missing(key);
    return value;
  }

  optionalMapping(key: string): CstMapping | undefined {
    const entry = this.entry(key);
    if (!entry) return undefined;
    if (entry.value.kind !== "mapping") {
      this.#wrongType(key, "an indented block", entry.value);
      return undefined;
    }
    return entry.value;
  }

  requiredMapping(key: string): CstMapping | undefined {
    const value = this.optionalMapping(key);
    if (!this.entry(key)) this.#missing(key);
    return value;
  }

  optionalSequence(key: string): CstSequence | undefined {
    const entry = this.entry(key);
    if (!entry) return undefined;
    if (entry.value.kind !== "sequence") {
      this.#wrongType(key, "a list", entry.value);
      return undefined;
    }
    return entry.value;
  }

  #missing(key: string): void {
    this.diagnostics.push(
      error("semantic", "S203", `Required key '${key}' is missing.`, {
        hint: `Add '${key}:' to this block.`,
        span: this.mapping.span,
      }),
    );
  }

  #wrongType(key: string, expected: string, value: CstNode): void {
    this.diagnostics.push(
      error("semantic", "S204", `Key '${key}' needs ${expected}.`, {
        span: value.span,
      }),
    );
  }
}

export const parseEnum = <T extends string>(
  value: CstScalar | undefined,
  allowed: readonly T[],
  diagnostics: Diagnostic[],
  label: string,
): T | undefined => {
  if (!value) return undefined;
  if ((allowed as readonly string[]).includes(value.value))
    return value.value as T;
  const suggestion = nearest(value.value, allowed);
  diagnostics.push(
    error("semantic", "S205", `Unknown ${label} '${value.value}'.`, {
      hint: suggestion
        ? `Use '${suggestion}'.`
        : `Use one of: ${allowed.join(", ")}.`,
      span: value.span,
    }),
  );
  return undefined;
};

export const parseCommaList = (
  value: CstScalar | undefined,
): readonly string[] =>
  value
    ? value.value
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    : [];

export const nodeSpan = (
  entry: CstMappingEntry | undefined,
  fallback: SourceSpan,
): SourceSpan => entry?.span ?? fallback;
