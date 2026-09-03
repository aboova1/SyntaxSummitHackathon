#!/usr/bin/env node

import { chmod, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { parseCatalog } from "./catalog/load.js";
import { compileFrontEnd } from "./compiler/compile.js";
import { compileProject } from "./compiler/project.js";
import {
  error,
  formatDiagnostic,
  hasErrors,
  type Diagnostic,
} from "./compiler/diagnostic.js";
import { loadConnections } from "./connections/load.js";
import {
  buildPitchDecisionPlan,
  isPitchDecisionSource,
  parseDecisionSource,
  runPitchDecision,
  type PitchDecisionPlan,
  type PitchDecisionRequest,
  type PitchDecisionResult,
} from "./decision.js";
import { loadPlaygroundData, type PlaygroundData } from "./playground-data.js";
import { executePlan } from "./runtime/execute.js";
import { prepareExecution } from "./runtime/prepare.js";
import { toPublicResult } from "./runtime/public-result.js";
import type { StudyResult } from "./runtime/types.js";

interface CatalogOption {
  readonly catalog?: string;
}

const program = new Command();

const readText = async (path: string): Promise<string> =>
  readFile(resolve(path), "utf8");

const printDiagnostics = (
  diagnostics: readonly Diagnostic[],
  sourceName: string,
): void => {
  for (const diagnostic of diagnostics) {
    const stream =
      diagnostic.severity === "error" ? process.stderr : process.stdout;
    stream.write(`${formatDiagnostic(diagnostic, sourceName)}\n`);
  }
};

const requireCatalog = (options: CatalogOption): string => {
  if (!options.catalog) throw new Error("This command needs --catalog <path>.");
  return options.catalog;
};

const percent = (value: number | undefined): string =>
  value === undefined ? "not available" : `${(value * 100).toFixed(1)}%`;

const printResult = (result: StudyResult): void => {
  process.stdout.write(`\n${result.study}\n`);
  process.stdout.write(`Target: ${result.target.event}`);
  if (result.target.sourcePitch)
    process.stdout.write(` on ${result.target.sourcePitch}`);
  process.stdout.write(`\nEvidence: ${result.evidence}\n\n`);
  process.stdout.write(
    `Primary records: ${result.primary.matchedCount.toFixed(0)} matched\n`,
  );
  process.stdout.write(
    `Primary observed rate: ${percent(result.primary.observedRate)}\n`,
  );
  if (result.primary.modelChance !== undefined) {
    process.stdout.write(
      `Primary model chance: ${percent(result.primary.modelChance)}\n`,
    );
    process.stdout.write("Primary model uncertainty: unavailable\n");
  }
  if (result.primary.simulatedChance !== undefined) {
    process.stdout.write(
      `Primary simulated chance: ${percent(result.primary.simulatedChance)}\n`,
    );
    process.stdout.write(
      `Primary Monte Carlo half-width: ${percent(result.primary.monteCarloHalfWidth)}\n`,
    );
  }
  if (result.baseline) {
    process.stdout.write(
      `\nBaseline records: ${result.baseline.matchedCount.toFixed(0)} matched\n`,
    );
    process.stdout.write(
      `Baseline observed rate: ${percent(result.baseline.observedRate)}\n`,
    );
    if (result.baseline.modelChance !== undefined) {
      process.stdout.write(
        `Baseline model chance: ${percent(result.baseline.modelChance)}\n`,
      );
      process.stdout.write("Baseline model uncertainty: unavailable\n");
    }
    if (result.baseline.simulatedChance !== undefined) {
      process.stdout.write(
        `Baseline simulated chance: ${percent(result.baseline.simulatedChance)}\n`,
      );
      process.stdout.write(
        `Baseline Monte Carlo half-width: ${percent(result.baseline.monteCarloHalfWidth)}\n`,
      );
    }
  }
  if (result.difference) {
    process.stdout.write(
      `\nObserved difference: ${percent(result.difference.observed)}\n`,
    );
    process.stdout.write(
      `Approximate observed difference range: ${percent(result.difference.observedInterval.low)} to ${percent(result.difference.observedInterval.high)}\n`,
    );
    if (result.difference.model !== undefined) {
      process.stdout.write(
        `Model difference: ${percent(result.difference.model)}\n`,
      );
    }
    if (result.difference.simulated !== undefined) {
      process.stdout.write(
        `Simulated difference: ${percent(result.difference.simulated)}\n`,
      );
    }
  }
  if (result.audit.trials)
    process.stdout.write(`\nTrials: ${result.audit.trials.toLocaleString()}\n`);
  process.stdout.write(`Plan: ${result.audit.planFingerprint.slice(0, 12)}\n`);
  if (result.warnings.length > 0) {
    process.stdout.write("\nWarnings:\n");
    for (const warning of result.warnings)
      process.stdout.write(`- ${warning}\n`);
  }
};

const printDecisionResult = (result: PitchDecisionResult): void => {
  process.stdout.write(`\n${result.study}\n`);
  if (result.question.kind === "predict") {
    process.stdout.write(
      `Call: ${result.selected.pitch} at ${result.selected.location}\n`,
    );
  } else {
    process.stdout.write(`Goal: ${result.question.goal}\n`);
    process.stdout.write(
      `Best call: ${result.selected.pitch} at ${result.selected.location}\n`,
    );
    process.stdout.write("\nRanked calls:\n");
    for (const [index, call] of (result.recommendations ?? []).entries()) {
      process.stdout.write(
        `${index + 1}. ${call.pitch} at ${call.location}: ${percent(call.goalChance)}\n`,
      );
    }
  }
  process.stdout.write("\nOutcome chances:\n");
  for (const item of result.selected.outcomes)
    process.stdout.write(`- ${item.outcome}: ${percent(item.chance)}\n`);
  process.stdout.write(`\nTrials: ${result.trials.toLocaleString()}\n`);
  process.stdout.write(
    `Model: ${result.model.name} ${result.model.version} (${result.model.status})\n`,
  );
  process.stdout.write("\nLimits:\n");
  for (const notice of result.notices) process.stdout.write(`- ${notice}\n`);
};

interface CompiledPitchDecision {
  readonly data?: PlaygroundData;
  readonly request?: PitchDecisionRequest;
  readonly plan?: PitchDecisionPlan;
  readonly diagnostics: readonly Diagnostic[];
}

const compilePitchDecisionFromFiles = async (
  studyPath: string,
  catalogPath: string,
  studySource?: string,
): Promise<CompiledPitchDecision> => {
  const [source, catalogSource] = await Promise.all([
    studySource ?? readText(studyPath),
    readText(catalogPath),
  ]);
  const loadedCatalog = parseCatalog(catalogSource);
  if (!loadedCatalog.catalog) return { diagnostics: loadedCatalog.diagnostics };

  const sourceName = /^source:\s*(.+)$/mu.exec(source)?.[1]?.trim();
  const resource = sourceName
    ? loadedCatalog.catalog.data[sourceName]
    : undefined;
  if (!sourceName || !resource) {
    return {
      diagnostics: [
        error("resolve", "S260", "The decision source is not in the catalog.", {
          hint: "Select a named catalog data source.",
        }),
      ],
    };
  }
  if (resource.connector !== "csv") {
    return {
      diagnostics: [
        error(
          "resolve",
          "S261",
          "The local decision command needs a CSV demonstration source.",
          { hint: "Use the browser studio for configured remote resources." },
        ),
      ],
    };
  }

  const data = await loadPlaygroundData(
    resolve(dirname(resolve(catalogPath)), resource.object),
  );
  const parsed = parseDecisionSource(source, data);
  return {
    data,
    ...(parsed.request
      ? {
          request: parsed.request,
          plan: buildPitchDecisionPlan(parsed.request),
        }
      : {}),
    diagnostics: parsed.diagnostics,
  };
};

const compileFromFiles = async (studyPath: string, catalogPath: string) => {
  const [studySource, catalogSource] = await Promise.all([
    readText(studyPath),
    readText(catalogPath),
  ]);
  return compileProject(studySource, catalogSource);
};

program
  .name("seam")
  .description("Compile and run SeamScript baseball studies.")
  .version("0.4.0");

program
  .command("check")
  .description("Check a study and its optional resource catalog.")
  .argument("<study>", "Path to a .seam file.")
  .option("-c, --catalog <path>", "Path to a catalog file.")
  .action(async (studyPath: string, options: CatalogOption) => {
    const studySource = await readText(studyPath);
    if (isPitchDecisionSource(studySource)) {
      if (!options.catalog) {
        const diagnostic = error(
          "resolve",
          "S260",
          "A pitch decision needs a resource catalog.",
          { hint: "Add --catalog <path>." },
        );
        printDiagnostics([diagnostic], studyPath);
        process.exitCode = 1;
        return;
      }
      const result = await compilePitchDecisionFromFiles(
        studyPath,
        options.catalog,
        studySource,
      );
      printDiagnostics(result.diagnostics, studyPath);
      if (hasErrors(result.diagnostics)) {
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${studyPath} is valid.\n`);
      return;
    }
    const result = options.catalog
      ? compileProject(studySource, await readText(options.catalog))
      : compileFrontEnd(studySource);
    printDiagnostics(result.diagnostics, studyPath);
    if (hasErrors(result.diagnostics)) {
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${studyPath} is valid.\n`);
  });

program
  .command("compile")
  .description("Compile a study to a typed tree, plan, or SQL.")
  .argument("<study>", "Path to a .seam file.")
  .requiredOption("-c, --catalog <path>", "Path to a catalog file.")
  .option("--emit <form>", "ast, plan, sql, or tokens.", "plan")
  .action(
    async (
      studyPath: string,
      options: CatalogOption & { readonly emit: string },
    ) => {
      const catalogPath = requireCatalog(options);
      const studySource = await readText(studyPath);
      if (isPitchDecisionSource(studySource)) {
        const result = await compilePitchDecisionFromFiles(
          studyPath,
          catalogPath,
          studySource,
        );
        printDiagnostics(result.diagnostics, studyPath);
        if (hasErrors(result.diagnostics) || !result.request || !result.plan) {
          process.exitCode = 1;
          return;
        }
        if (options.emit === "ast") {
          process.stdout.write(`${JSON.stringify(result.request, null, 2)}\n`);
        } else if (options.emit === "plan") {
          process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
        } else if (options.emit === "tokens") {
          process.stdout.write(
            `${JSON.stringify(compileFrontEnd(studySource).tokens, null, 2)}\n`,
          );
        } else if (options.emit === "sql") {
          process.stdout.write(
            "-- Pitch decisions call an approved outcome model.\n\nParameters: []\n",
          );
        } else {
          process.stderr.write(`Unknown output form '${options.emit}'.\n`);
          process.exitCode = 1;
        }
        return;
      }
      const result = await compileFromFiles(studyPath, catalogPath);
      printDiagnostics(result.diagnostics, studyPath);
      if (hasErrors(result.diagnostics) || !result.plan) {
        process.exitCode = 1;
        return;
      }
      if (options.emit === "ast") {
        process.stdout.write(
          `${JSON.stringify(result.frontEnd.document, null, 2)}\n`,
        );
      } else if (options.emit === "plan") {
        process.stdout.write(`${JSON.stringify(result.plan, null, 2)}\n`);
      } else if (options.emit === "tokens") {
        process.stdout.write(
          `${JSON.stringify(result.frontEnd.tokens, null, 2)}\n`,
        );
      } else if (options.emit === "sql") {
        process.stdout.write(`${result.sql?.text ?? ""}\n\n`);
        process.stdout.write(
          `Parameters: ${JSON.stringify(result.sql?.parameters ?? [])}\n`,
        );
      } else {
        process.stderr.write(`Unknown output form '${options.emit}'.\n`);
        process.exitCode = 1;
      }
    },
  );

program
  .command("explain")
  .description("Explain each step without running the study.")
  .argument("<study>", "Path to a .seam file.")
  .requiredOption("-c, --catalog <path>", "Path to a catalog file.")
  .action(async (studyPath: string, options: CatalogOption) => {
    const catalogPath = requireCatalog(options);
    const studySource = await readText(studyPath);
    if (isPitchDecisionSource(studySource)) {
      const result = await compilePitchDecisionFromFiles(
        studyPath,
        catalogPath,
        studySource,
      );
      printDiagnostics(result.diagnostics, studyPath);
      if (hasErrors(result.diagnostics) || !result.plan) {
        process.exitCode = 1;
        return;
      }
      process.stdout.write(`${result.plan.study}\n\n`);
      for (const [index, node] of result.plan.nodes.entries())
        process.stdout.write(`${index + 1}. ${node.description}\n`);
      return;
    }
    const result = await compileFromFiles(studyPath, catalogPath);
    printDiagnostics(result.diagnostics, studyPath);
    if (hasErrors(result.diagnostics) || !result.plan) {
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${result.plan.study}\n\n`);
    for (const [index, node] of result.plan.nodes.entries()) {
      process.stdout.write(`${index + 1}. ${node.description}\n`);
    }
    process.stdout.write(
      `\nFacts come from: ${result.plan.features.source}.\n`,
    );
    process.stdout.write(
      `Match fields: ${result.plan.features.match.join(", ")}.\n`,
    );
    process.stdout.write(
      `Feature groups: ${result.plan.features.featureGroups.join(", ")}.\n`,
    );
  });

program
  .command("run")
  .description("Compile and run a study.")
  .argument("<study>", "Path to a .seam file.")
  .requiredOption("-c, --catalog <path>", "Path to a catalog file.")
  .option("--connections <path>", "Path to connection profiles.")
  .option("--json", "Print normal output as JSON.")
  .option(
    "--audit-file <path>",
    "Write the protected audit record to a private file.",
  )
  .action(
    async (
      studyPath: string,
      options: CatalogOption & {
        readonly connections?: string;
        readonly json?: boolean;
        readonly auditFile?: string;
      },
    ) => {
      const catalogPath = requireCatalog(options);
      const studySource = await readText(studyPath);
      if (isPitchDecisionSource(studySource)) {
        const compiled = await compilePitchDecisionFromFiles(
          studyPath,
          catalogPath,
          studySource,
        );
        printDiagnostics(compiled.diagnostics, studyPath);
        if (
          hasErrors(compiled.diagnostics) ||
          !compiled.request ||
          !compiled.data
        ) {
          process.exitCode = 1;
          return;
        }
        const result = runPitchDecision(compiled.request, compiled.data);
        if (options.auditFile) {
          const auditPath = resolve(options.auditFile);
          await writeFile(auditPath, `${JSON.stringify(result, null, 2)}\n`, {
            encoding: "utf8",
            mode: 0o600,
          });
          await chmod(auditPath, 0o600);
        }
        if (options.json)
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        else printDecisionResult(result);
        return;
      }
      const compiled = await compileFromFiles(studyPath, catalogPath);
      printDiagnostics(compiled.diagnostics, studyPath);
      if (hasErrors(compiled.diagnostics) || !compiled.plan) {
        process.exitCode = 1;
        return;
      }
      const connectionPath = options.connections;
      const loadedConnections = connectionPath
        ? await loadConnections(connectionPath)
        : { diagnostics: [] as readonly Diagnostic[] };
      printDiagnostics(
        loadedConnections.diagnostics,
        connectionPath ?? studyPath,
      );
      if (hasErrors(loadedConnections.diagnostics)) {
        process.exitCode = 1;
        return;
      }
      const prepared = await prepareExecution(
        compiled.plan,
        dirname(resolve(catalogPath)),
        loadedConnections.profiles,
      );
      printDiagnostics(prepared.diagnostics, studyPath);
      if (!prepared.options || hasErrors(prepared.diagnostics)) {
        process.exitCode = 1;
        return;
      }
      const executed = await executePlan(compiled.plan, prepared.options);
      printDiagnostics(executed.diagnostics, studyPath);
      if (!executed.result || hasErrors(executed.diagnostics)) {
        process.exitCode = 1;
        return;
      }
      if (options.auditFile) {
        const auditPath = resolve(options.auditFile);
        await writeFile(
          auditPath,
          `${JSON.stringify(executed.result.protectedAudit, null, 2)}\n`,
          {
            encoding: "utf8",
            mode: 0o600,
          },
        );
        await chmod(auditPath, 0o600);
      }
      if (options.json) {
        process.stdout.write(
          `${JSON.stringify(toPublicResult(executed.result), null, 2)}\n`,
        );
      } else {
        printResult(executed.result);
      }
    },
  );

program.parseAsync().catch((cause: unknown) => {
  process.stderr.write(
    `${cause instanceof Error ? cause.message : "Command failed."}\n`,
  );
  process.exitCode = 1;
});
