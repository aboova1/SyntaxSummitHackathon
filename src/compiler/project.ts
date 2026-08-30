import type { SeamCatalog } from "../catalog/schema.js";
import { parseCatalog } from "../catalog/load.js";
import { resolveCatalog, type ResourcePlan } from "../catalog/resolve.js";
import { buildExecutionPlan } from "../planner/build.js";
import type { ExecutionPlan } from "../planner/plan.js";
import { compileFrontEnd, type FrontEndResult } from "./compile.js";
import type { Diagnostic } from "./diagnostic.js";
import { hasErrors } from "./diagnostic.js";
import { generateSql, type SqlProgram } from "./sql.js";

export interface ProjectCompileResult {
  readonly frontEnd: FrontEndResult;
  readonly catalog?: SeamCatalog;
  readonly resources?: ResourcePlan;
  readonly plan?: ExecutionPlan;
  readonly sql?: SqlProgram;
  readonly diagnostics: readonly Diagnostic[];
}

export const compileProject = (
  studySource: string,
  catalogSource: string,
): ProjectCompileResult => {
  const frontEnd = compileFrontEnd(studySource);
  if (!frontEnd.document || hasErrors(frontEnd.diagnostics)) {
    return { frontEnd, diagnostics: frontEnd.diagnostics };
  }
  const loaded = parseCatalog(catalogSource);
  const afterCatalog = [...frontEnd.diagnostics, ...loaded.diagnostics];
  if (!loaded.catalog || hasErrors(afterCatalog)) {
    return {
      frontEnd,
      diagnostics: afterCatalog,
    };
  }
  const resolved = resolveCatalog(
    frontEnd.document,
    loaded.catalog,
    afterCatalog,
  );
  if (!resolved.plan || hasErrors(resolved.diagnostics)) {
    return {
      frontEnd,
      catalog: loaded.catalog,
      diagnostics: resolved.diagnostics,
    };
  }
  const planned = buildExecutionPlan(
    frontEnd.document,
    resolved.plan,
    resolved.diagnostics,
  );
  if (!planned.plan || hasErrors(planned.diagnostics)) {
    return {
      frontEnd,
      catalog: loaded.catalog,
      resources: resolved.plan,
      diagnostics: planned.diagnostics,
    };
  }
  return {
    frontEnd,
    catalog: loaded.catalog,
    resources: resolved.plan,
    plan: planned.plan,
    sql: generateSql(planned.plan),
    diagnostics: planned.diagnostics,
  };
};
