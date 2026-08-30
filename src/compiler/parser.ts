import type {
  CstMapping,
  CstMappingEntry,
  CstNode,
  CstScalar,
  CstSequence,
} from "./cst.js";
import { error, hasErrors, type Diagnostic } from "./diagnostic.js";
import { mergeSpans, span, type SourceSpan } from "./source.js";
import type { Token } from "./token.js";

interface ParsedLine {
  readonly indent: number;
  readonly kind: "mapping" | "sequence" | "invalid";
  readonly key?: Token;
  readonly value?: Token;
  readonly span: SourceSpan;
}

export interface ParseResult {
  readonly root?: CstMapping;
  readonly diagnostics: readonly Diagnostic[];
}

const linesFromTokens = (tokens: readonly Token[]): ParsedLine[] => {
  const lines: ParsedLine[] = [];
  let current: Token[] = [];

  for (const token of tokens) {
    if (token.kind === "newline" || token.kind === "eof") {
      if (current.length > 0) {
        const first = current[0];
        const last = current[current.length - 1];
        if (!first || !last) {
          current = [];
          continue;
        }
        const indentToken = current.find((item) => item.kind === "indent");
        const key = current.find((item) => item.kind === "key");
        const value = current.find((item) => item.kind === "scalar");
        const hasDash = current.some((item) => item.kind === "dash");
        const invalid = current.some((item) => item.kind === "invalid");
        lines.push({
          indent: indentToken?.indent ?? 0,
          kind: invalid ? "invalid" : hasDash ? "sequence" : "mapping",
          ...(key ? { key } : {}),
          ...(value ? { value } : {}),
          span: mergeSpans(first.span, last.span),
        });
      }
      current = [];
      continue;
    }
    current.push(token);
  }

  return lines;
};

class CstParser {
  readonly #lines: readonly ParsedLine[];
  readonly diagnostics: Diagnostic[] = [];
  #index = 0;

  constructor(lines: readonly ParsedLine[]) {
    this.#lines = lines;
  }

  parseRoot(): CstMapping | undefined {
    if (this.#lines.length === 0) {
      this.diagnostics.push(
        error("parse", "S100", "The study is empty.", {
          hint: "Start with 'study: <question>'.",
        }),
      );
      return undefined;
    }
    const root = this.#parseMapping(0);
    if (this.#index < this.#lines.length) {
      const line = this.#lines[this.#index];
      if (line) {
        this.diagnostics.push(
          error(
            "parse",
            "S101",
            "This line has an unexpected indentation level.",
            {
              hint: "Use two spaces inside a block.",
              span: line.span,
            },
          ),
        );
      }
    }
    return root;
  }

  #parseMapping(indent: number): CstMapping {
    const entries: CstMappingEntry[] = [];
    let firstSpan: SourceSpan | undefined;
    let lastSpan: SourceSpan | undefined;

    while (this.#index < this.#lines.length) {
      const line = this.#lines[this.#index];
      if (!line || line.indent < indent) {
        break;
      }
      if (line.indent > indent) {
        this.diagnostics.push(
          error("parse", "S102", "This line is indented too far.", {
            hint: `Use ${indent} spaces here.`,
            span: line.span,
          }),
        );
        this.#index += 1;
        continue;
      }
      if (line.kind !== "mapping" || !line.key) {
        this.diagnostics.push(
          error(
            "parse",
            "S103",
            "A mapping block cannot contain this list item.",
            {
              hint: "Put list items under a key that ends with a colon.",
              span: line.span,
            },
          ),
        );
        this.#index += 1;
        continue;
      }

      this.#index += 1;
      let value: CstNode;
      if (line.value) {
        value = {
          kind: "scalar",
          value: line.value.lexeme,
          span: line.value.span,
        };
      } else {
        const next = this.#lines[this.#index];
        if (!next || next.indent <= indent) {
          this.diagnostics.push(
            error("parse", "S104", `The '${line.key.lexeme}' block is empty.`, {
              hint: "Add an indented value.",
              span: line.span,
            }),
          );
          value = { kind: "mapping", entries: [], span: line.span };
        } else if (next.indent !== indent + 2) {
          this.diagnostics.push(
            error(
              "parse",
              "S105",
              `The '${line.key.lexeme}' block has invalid indentation.`,
              {
                hint: `Use ${indent + 2} spaces inside this block.`,
                span: next.span,
              },
            ),
          );
          value = this.#parseMapping(next.indent);
        } else if (next.kind === "sequence") {
          value = this.#parseSequence(indent + 2);
        } else {
          value = this.#parseMapping(indent + 2);
        }
      }

      const entrySpan = mergeSpans(line.span, value.span);
      entries.push({
        key: line.key.lexeme,
        keySpan: line.key.span,
        value,
        span: entrySpan,
      });
      firstSpan ??= entrySpan;
      lastSpan = entrySpan;
    }

    const fallbackSpan = span(0, 0, 1, 1, 1);
    return {
      kind: "mapping",
      entries,
      span:
        firstSpan && lastSpan ? mergeSpans(firstSpan, lastSpan) : fallbackSpan,
    };
  }

  #parseSequence(indent: number): CstSequence {
    const items: CstScalar[] = [];
    let firstSpan: SourceSpan | undefined;
    let lastSpan: SourceSpan | undefined;

    while (this.#index < this.#lines.length) {
      const line = this.#lines[this.#index];
      if (!line || line.indent < indent) {
        break;
      }
      if (line.indent !== indent || line.kind !== "sequence") {
        if (line.indent === indent && line.kind === "mapping") {
          break;
        }
        this.diagnostics.push(
          error("parse", "S106", "This list has an invalid item.", {
            hint: `Use ${indent} spaces and start the item with '- '.`,
            span: line.span,
          }),
        );
        this.#index += 1;
        continue;
      }
      this.#index += 1;
      if (!line.value) {
        continue;
      }
      const item: CstScalar = {
        kind: "scalar",
        value: line.value.lexeme,
        span: line.value.span,
      };
      items.push(item);
      firstSpan ??= item.span;
      lastSpan = item.span;
    }

    const fallbackSpan = span(0, 0, 1, 1, 1);
    return {
      kind: "sequence",
      items,
      span:
        firstSpan && lastSpan ? mergeSpans(firstSpan, lastSpan) : fallbackSpan,
    };
  }
}

export const parse = (
  tokens: readonly Token[],
  priorDiagnostics: readonly Diagnostic[] = [],
): ParseResult => {
  const parser = new CstParser(linesFromTokens(tokens));
  const root = parser.parseRoot();
  const diagnostics = [...priorDiagnostics, ...parser.diagnostics];
  return {
    ...(root && !hasErrors(diagnostics) ? { root } : {}),
    diagnostics,
  };
};
