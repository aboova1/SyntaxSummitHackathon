# Five-minute demonstration script

Create a silent interaction draft with `npm run demo:record`.

The command writes `output/playwright/seamscript-demo.webm`.

Use the script below for the final narration.

## 0:00 to 0:30 — Problem

Baseball teams have detailed data and approved models.

Many coaches still need an analyst to use them.

SeamScript turns one baseball question into a checked execution plan.

## 0:30 to 1:20 — Language

Show `examples/demo.seam` in the browser studio.

Point to `target`.

Say: “This is the event we estimate.”

Point to `facts`.

Say: “These are inputs known before the pitch.”

Point to `when` and `versus`.

Explain that both groups share one target and one method.

## 1:20 to 2:00 — Compiler

Select **Check**.

Change `outcome` to `result`.

Show the exact source error and correction.

Restore `outcome`.

Select **Compile**.

Show the frozen execution steps and generated SQL.

## 2:00 to 3:05 — Run

Select **Run study**.

State that the data is synthetic.

Show observed, model, and simulated chances.

Show the primary and baseline difference.

Show the zone map and audit data.

Explain that model uncertainty is unavailable.

Explain that Monte Carlo error excludes model and data uncertainty.

## 3:05 to 3:45 — Automatic simulation

Show `method: simulation`.

Explain that the user does not set a seed or trial count.

The runtime increases trials until its error rule passes.

The normal result shows the trial count.

The protected audit record stores the seed.

## 3:45 to 4:25 — Remote resources

Show `examples/seam.catalog.yml`.

Explain the HTTP data, MLflow, KServe, and OpenAPI connectors.

The compiler freezes each alias to an exact model version.

The system never trains an untested replacement.

## 4:25 to 5:00 — Impact

Name the first user: a pregame game-plan coordinator.

Name the next users: catching coordinators and pitching coaches.

State the boundary: SeamScript supports decisions. It does not replace coaches.

Close with this line:

“SeamScript makes trusted baseball analysis readable, repeatable, and reviewable.”
