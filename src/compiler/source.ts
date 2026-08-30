export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export const span = (
  startOffset: number,
  endOffset: number,
  line: number,
  startColumn: number,
  endColumn: number,
): SourceSpan => ({
  start: { offset: startOffset, line, column: startColumn },
  end: { offset: endOffset, line, column: endColumn },
});

export const mergeSpans = (
  first: SourceSpan,
  last: SourceSpan,
): SourceSpan => ({
  start: first.start,
  end: last.end,
});
