import type { SourceSpan } from "./source.js";

export interface CstScalar {
  readonly kind: "scalar";
  readonly value: string;
  readonly span: SourceSpan;
}

export interface CstMappingEntry {
  readonly key: string;
  readonly keySpan: SourceSpan;
  readonly value: CstNode;
  readonly span: SourceSpan;
}

export interface CstMapping {
  readonly kind: "mapping";
  readonly entries: readonly CstMappingEntry[];
  readonly span: SourceSpan;
}

export interface CstSequence {
  readonly kind: "sequence";
  readonly items: readonly CstScalar[];
  readonly span: SourceSpan;
}

export type CstNode = CstScalar | CstMapping | CstSequence;
