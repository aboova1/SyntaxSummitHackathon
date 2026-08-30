import { error, type Diagnostic } from "./diagnostic.js";
import { span } from "./source.js";
import type { Token } from "./token.js";

export interface LexResult {
  readonly tokens: readonly Token[];
  readonly diagnostics: readonly Diagnostic[];
}

const makeToken = (
  kind: Token["kind"],
  lexeme: string,
  startOffset: number,
  endOffset: number,
  line: number,
  startColumn: number,
  endColumn: number,
  indent?: number,
): Token => ({
  kind,
  lexeme,
  span: span(startOffset, endOffset, line, startColumn, endColumn),
  ...(indent === undefined ? {} : { indent }),
});

const findFirstColon = (text: string): number => {
  let quoted = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && quoted) {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === ":" && !quoted) {
      return index;
    }
  }
  return -1;
};

export const lex = (source: string): LexResult => {
  const normalized = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const lines = normalized.split("\n");
  let offset = 0;

  lines.forEach((lineText, lineIndex) => {
    const lineNumber = lineIndex + 1;
    const tabIndex = lineText.indexOf("\t");
    if (tabIndex >= 0) {
      diagnostics.push(
        error("lex", "S001", "Tabs are not allowed.", {
          hint: "Use two spaces for each indentation level.",
          span: span(
            offset + tabIndex,
            offset + tabIndex + 1,
            lineNumber,
            tabIndex + 1,
            tabIndex + 2,
          ),
        }),
      );
    }

    const indentationText = lineText.match(/^ */u)?.[0] ?? "";
    const indentation = indentationText.length;
    const content = lineText.slice(indentation);

    if (indentation % 2 !== 0) {
      diagnostics.push(
        error("lex", "S002", `Indentation has ${indentation} spaces.`, {
          hint: "Use a multiple of two spaces.",
          span: span(
            offset,
            offset + indentation,
            lineNumber,
            1,
            indentation + 1,
          ),
        }),
      );
    }

    if (content.length === 0 || content.startsWith("#")) {
      tokens.push(
        makeToken(
          "newline",
          "\n",
          offset + lineText.length,
          offset + lineText.length + 1,
          lineNumber,
          lineText.length + 1,
          lineText.length + 2,
        ),
      );
      offset += lineText.length + 1;
      return;
    }

    tokens.push(
      makeToken(
        "indent",
        indentationText,
        offset,
        offset + indentation,
        lineNumber,
        1,
        indentation + 1,
        indentation,
      ),
    );

    const contentOffset = offset + indentation;
    const contentColumn = indentation + 1;
    if (content.startsWith("- ")) {
      tokens.push(
        makeToken(
          "dash",
          "-",
          contentOffset,
          contentOffset + 1,
          lineNumber,
          contentColumn,
          contentColumn + 1,
        ),
      );
      const value = content.slice(2).trimEnd();
      const valueStart = contentOffset + 2;
      if (value.length === 0) {
        diagnostics.push(
          error("lex", "S003", "A list item needs a value.", {
            hint: "Write a value after '- '.",
            span: span(
              contentOffset,
              contentOffset + content.length,
              lineNumber,
              contentColumn,
              contentColumn + content.length,
            ),
          }),
        );
      } else {
        tokens.push(
          makeToken(
            "scalar",
            value,
            valueStart,
            valueStart + value.length,
            lineNumber,
            contentColumn + 2,
            contentColumn + 2 + value.length,
          ),
        );
      }
    } else {
      const colonIndex = findFirstColon(content);
      if (colonIndex < 1) {
        diagnostics.push(
          error("lex", "S004", "A key-value line needs a colon.", {
            hint: "Use 'key: value'.",
            span: span(
              contentOffset,
              contentOffset + content.length,
              lineNumber,
              contentColumn,
              contentColumn + content.length,
            ),
          }),
        );
        tokens.push(
          makeToken(
            "invalid",
            content,
            contentOffset,
            contentOffset + content.length,
            lineNumber,
            contentColumn,
            contentColumn + content.length,
          ),
        );
      } else {
        const rawKey = content.slice(0, colonIndex);
        const key = rawKey.trim();
        const keyStartDelta = rawKey.indexOf(key);
        const keyStart = contentOffset + keyStartDelta;
        tokens.push(
          makeToken(
            "key",
            key,
            keyStart,
            keyStart + key.length,
            lineNumber,
            contentColumn + keyStartDelta,
            contentColumn + keyStartDelta + key.length,
          ),
        );
        const colonOffset = contentOffset + colonIndex;
        tokens.push(
          makeToken(
            "colon",
            ":",
            colonOffset,
            colonOffset + 1,
            lineNumber,
            contentColumn + colonIndex,
            contentColumn + colonIndex + 1,
          ),
        );
        const rawValue = content.slice(colonIndex + 1);
        const value = rawValue.trim();
        if (value.length > 0) {
          const valueDelta = rawValue.indexOf(value);
          const valueStart = colonOffset + 1 + valueDelta;
          tokens.push(
            makeToken(
              "scalar",
              value,
              valueStart,
              valueStart + value.length,
              lineNumber,
              contentColumn + colonIndex + 1 + valueDelta,
              contentColumn + colonIndex + 1 + valueDelta + value.length,
            ),
          );
        }
      }
    }

    tokens.push(
      makeToken(
        "newline",
        "\n",
        offset + lineText.length,
        offset + lineText.length + 1,
        lineNumber,
        lineText.length + 1,
        lineText.length + 2,
      ),
    );
    offset += lineText.length + 1;
  });

  tokens.push(
    makeToken(
      "eof",
      "",
      normalized.length,
      normalized.length,
      lines.length,
      1,
      1,
    ),
  );

  return { tokens, diagnostics };
};
