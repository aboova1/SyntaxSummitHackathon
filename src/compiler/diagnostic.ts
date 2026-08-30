import type { SourceSpan } from "./source.js";

export type CompilerStage =
  "lex" | "parse" | "semantic" | "resolve" | "plan" | "runtime";

export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  readonly stage: CompilerStage;
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly hint?: string;
  readonly span?: SourceSpan;
}

export const error = (
  stage: CompilerStage,
  code: string,
  message: string,
  options: { readonly hint?: string; readonly span?: SourceSpan } = {},
): Diagnostic => ({ stage, severity: "error", code, message, ...options });

export const warning = (
  stage: CompilerStage,
  code: string,
  message: string,
  options: { readonly hint?: string; readonly span?: SourceSpan } = {},
): Diagnostic => ({ stage, severity: "warning", code, message, ...options });

export const hasErrors = (diagnostics: readonly Diagnostic[]): boolean =>
  diagnostics.some((item) => item.severity === "error");

export const formatDiagnostic = (
  diagnostic: Diagnostic,
  sourceName = "study.seam",
): string => {
  const location = diagnostic.span
    ? `${sourceName}:${diagnostic.span.start.line}:${diagnostic.span.start.column}`
    : sourceName;
  const hint = diagnostic.hint ? `\n  ${diagnostic.hint}` : "";
  return `${location} [${diagnostic.code}] ${diagnostic.message}${hint}`;
};
