import { readFile } from "node:fs/promises";
import { compileProject } from "../src/compiler/project.js";
import { readCsvData } from "../src/runtime/csv-data.js";
import { matchGroups } from "../src/runtime/match.js";
import { BuiltinOutcomeModel } from "../src/runtime/model.js";
import { selectPitches } from "../src/runtime/select.js";

const [study, catalog] = await Promise.all([
  readFile("examples/demo.seam", "utf8"),
  readFile("examples/demo.catalog.yml", "utf8"),
]);
const compiled = compileProject(study, catalog);
if (!compiled.plan) throw new Error(JSON.stringify(compiled.diagnostics));
const plan = compiled.plan;
const data = await readCsvData(
  plan.resources.data.resource.object,
  "examples",
  plan,
);
const matched = matchGroups(
  selectPitches(data.records, plan),
  plan.features.matchColumns,
).rows;
const model = new BuiltinOutcomeModel();
const description = await model.describe();
const allowed = plan.features.featureColumns.filter((field) =>
  description.featureColumns.includes(field),
);
const predictions = await model.predict(matched, plan.target, allowed);

const rows = matched.map((row, index) => ({
  outcome: row.outcome,
  probability: predictions[index]?.probability ?? 0,
  weight: row.weight,
}));
const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
const weighted = (values: readonly number[]): number =>
  values.reduce(
    (sum, value, index) => sum + value * (rows[index]?.weight ?? 0),
    0,
  ) / totalWeight;
const brier = weighted(rows.map((row) => (row.probability - row.outcome) ** 2));
const logLoss = weighted(
  rows.map((row) => {
    const probability = Math.min(1 - 1e-12, Math.max(1e-12, row.probability));
    return -(
      row.outcome * Math.log(probability) +
      (1 - row.outcome) * Math.log(1 - probability)
    );
  }),
);
const bins = Array.from({ length: 10 }, (_, index) => {
  const selected = rows.filter((row) =>
    index === 9
      ? row.probability >= index / 10 && row.probability <= 1
      : row.probability >= index / 10 && row.probability < (index + 1) / 10,
  );
  const weight = selected.reduce((sum, row) => sum + row.weight, 0);
  if (!weight) return undefined;
  return {
    range: `${(index / 10).toFixed(1)}-${((index + 1) / 10).toFixed(1)}`,
    records: weight,
    mean_prediction:
      selected.reduce((sum, row) => sum + row.probability * row.weight, 0) /
      weight,
    observed_rate:
      selected.reduce((sum, row) => sum + row.outcome * row.weight, 0) / weight,
  };
}).filter((value) => value !== undefined);
const calibrationError = bins.reduce(
  (sum, bin) =>
    sum +
    (bin.records / totalWeight) *
      Math.abs(bin.mean_prediction - bin.observed_rate),
  0,
);

process.stdout.write(
  `${JSON.stringify(
    {
      data: "synthetic demonstration data",
      records: totalWeight,
      target: plan.target,
      brier_score: brier,
      log_loss: logLoss,
      expected_calibration_error: calibrationError,
      threshold: "expected calibration error below 0.05",
      passed: calibrationError < 0.05,
      bins,
    },
    null,
    2,
  )}\n`,
);
