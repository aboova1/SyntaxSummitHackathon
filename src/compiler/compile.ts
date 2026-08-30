import type { SeamDocument } from "./ast.js";
import type { Diagnostic } from "./diagnostic.js";
import { lex } from "./lexer.js";
import { parse } from "./parser.js";
import { analyzeSemantics } from "./semantics.js";
import type { Token } from "./token.js";

export interface FrontEndResult {
  readonly tokens: readonly Token[];
  readonly document?: SeamDocument;
  readonly diagnostics: readonly Diagnostic[];
}

export const compileFrontEnd = (source: string): FrontEndResult => {
  const lexed = lex(source);
  const parsed = parse(lexed.tokens, lexed.diagnostics);
  if (!parsed.root) {
    return { tokens: lexed.tokens, diagnostics: parsed.diagnostics };
  }
  const analyzed = analyzeSemantics(parsed.root, parsed.diagnostics);
  return {
    tokens: lexed.tokens,
    ...(analyzed.document ? { document: analyzed.document } : {}),
    diagnostics: analyzed.diagnostics,
  };
};
