import type { SourceSpan } from "./source.js";

export type TokenKind =
  | "indent"
  | "dash"
  | "key"
  | "colon"
  | "scalar"
  | "newline"
  | "invalid"
  | "eof";

export interface Token {
  readonly kind: TokenKind;
  readonly lexeme: string;
  readonly span: SourceSpan;
  readonly indent?: number;
}
