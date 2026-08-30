# SeamScript language specification

Version 0.2

## 1. Design rule

Write each idea once.

Use one key for one meaning.

Keep the grammar small and fixed.

Make predictions different from facts.

Version 0.2 removes the old `sequence`, `compare`, `estimate`, and `show` blocks.

One `analyze` block now contains the complete question.

## 2. Complete example

```seam
study: Fastball before slider

data:
  source: team pitches
  seasons: 2023 through 2025
  games: regular season

use:
  model: approved pitch outcome
  comparison: matched comparison
  simulation: adaptive event simulation

analyze:
  target:
    pitch: slider
    outcome: swing and miss
    horizon: this pitch
  when:
    previous:
      sequence: fastball
      window: 2 pitches
  versus:
    previous:
      exclude: fastball
      window: 2 pitches
  facts:
    match: pitcher, count, batter side, season
    account for: batter history, pitcher form, pitch shape, game situation, ballpark, defense
  method: simulation
  report:
    - zone map
    - 5 examples
```

The meaning is formulaic:

```text
Use this data and these approved tools.
Analyze this target outcome.
Select records with this prior sequence.
Compare them with this baseline when present.
Use these facts as inputs.
Apply this method.
Add these optional report items.
```

## 3. Top-level form

SeamScript has four top-level keys:

1. `study`
2. `data`
3. `use`
4. `analyze`

`study` and `use` are optional.

`data` and `analyze` are required.

The order is fixed.

The `study` value is only a display name.

It never changes execution.

## 4. Layout

- Save a program with the `.seam` extension.
- Use lower-case keys.
- Use two spaces for each indentation level.
- Do not use tabs.
- Put one key-value pair on each line.
- Put a colon after each key.
- Start a list item with `-`.
- Start a full-line comment with `#`.
- Use blank lines only for reading comfort.
- Treat unknown keys as errors.
- Treat duplicate keys as errors.

The lexer splits a key-value line at its first unquoted colon.

Normal values do not need quotes.

## 5. Data

The `data` block selects the factual records.

```seam
data:
  source: team pitches
  seasons: 2023 through 2025
  games: regular season
```

`source` selects one named catalog resource.

Version 0.2 supports these filters:

- `seasons`
- `dates`
- `games`
- `teams`
- `pitchers`
- `batters`

`through` defines an inclusive range.

Dates use the same form:

```seam
dates: 2025-04-01 through 2025-04-30
```

Commas separate values on one line.

The connector sends supported filters to the data source.

## 6. Approved tools

The `use` block selects named computation resources.

```seam
use:
  model: approved pitch outcome
  comparison: matched comparison
  simulation: adaptive event simulation
```

The keys have fixed roles:

- `model` predicts the target outcome.
- `comparison` builds the baseline comparison.
- `simulation` runs repeated outcome paths.

The runtime calculates required uncertainty values automatically.

The runtime stops when a required resource is unavailable.

SeamScript never trains a replacement model automatically.

Catalog defaults supply omitted resources.

## 7. Analyze

The `analyze` block contains one complete analysis.

It has these keys:

- `target`
- `when`
- `versus`
- `facts`
- `method`
- `report`

`target` and `method` are required.

The other keys are optional.

## 8. Target

The `target` block defines the result to estimate.

It never defines an input feature.

```seam
target:
  pitch: slider
  outcome: swing and miss
  horizon: this pitch
```

`pitch` selects the pitch under analysis.

`outcome` selects the predicted or measured event.

`horizon` selects the end of the prediction.

It accepts these values:

- `this pitch`
- `plate appearance`

Immediate-pitch outcomes are:

- `swing`
- `swing and miss`
- `contact`
- `foul`
- `called strike`
- `ball in play`

Plate-appearance outcomes are:

- `strikeout`
- `walk`
- `hit by pitch`
- `ball in play`
- `reach base`

`pitch` anchors the target state. Version 0.2 always requires it.

## 9. Prior sequence

The `when` block selects the primary records.

```seam
when:
  previous:
    sequence: fastball
    window: 2 pitches
```

`sequence` lists pitches from oldest to newest.

Use commas for more than one pitch.

```seam
sequence: changeup, fastball
```

`window` defines how many prior pitches the compiler can inspect.

The target pitch is not part of this window.

The sequence order must match.

Other pitches can occur between sequence members.

Use `window: 1 pitch` for the immediately prior pitch.

The target pitch never belongs in this prior window.

## 10. Baseline

The optional `versus` block defines one baseline.

It replaces the old `compare` block.

```seam
versus:
  previous:
    exclude: fastball
    window: 2 pitches
```

`exclude` means the named pitch cannot occur in the complete window.

The baseline uses the same target outcome and method.

It does not repeat those values.

Version 0.2 supports these baseline forms:

```seam
previous:
  exclude: fastball
  window: 2 pitches
```

```seam
previous:
  sequence: changeup
  window: 2 pitches
```

## 11. Facts

The `facts` block defines information that can affect the result.

Facts are inputs. They are never prediction targets.

```seam
facts:
  match: pitcher, count, batter side, season
  account for: batter history, pitcher form, pitch shape, game situation, ballpark, defense
```

`match` defines facts that must be equal across comparison groups.

`account for` defines feature groups for models and adjustment algorithms.

The runtime reports the exact fields used from every group.

Version 0.2 defines these feature groups:

### Batter history

- Batter side
- Season-to-date rates
- Rolling rates
- Pitch-type splits
- Zone swing rate
- Chase rate
- Contact rate
- Prior batter-pitcher history

### Pitcher form

- Pitcher hand
- Season-to-date rates
- Rolling rates
- Arsenal use
- Pitch count
- Days of rest
- Times through the order

### Pitch shape

- Pitch type
- Velocity
- Movement
- Spin
- Release position
- Extension
- Plate location
- Differences from prior pitches

### Game situation

- Balls and strikes
- Outs
- Inning
- Score difference
- Base state
- Leverage
- Batter times faced

### Ballpark

- Park identifier
- Park factors
- Altitude
- Roof state
- Weather available before the pitch

### Defense

- Catcher identifier
- Catcher framing history
- Fielder alignment
- Fielder quality

### Sequence history

- Prior pitch types
- Prior pitch results
- Velocity changes
- Movement changes
- Location changes

## 12. Feature timing

Every field has one availability class:

- `before pitch`
- `after pitch`
- `after plate appearance`
- `after game`

Predictive features can use only `before pitch` values.

Historical aggregates must use dates before the target pitch.

The target outcome can use later values only as its label.

The compiler rejects feature leakage before execution.

Examples of forbidden prediction inputs are:

- Target pitch result
- Target exit velocity
- Final plate-appearance result
- Future season statistics

## 13. Method

`method` selects one evidence method.

```seam
method: simulation
```

It accepts these values:

- `observed`
- `model`
- `simulation`

`observed` calculates rates from selected records.

`model` calculates a chance with the approved outcome model.

`simulation` repeatedly samples from approved model results.

SeamScript never labels these methods as causal.

## 14. Automatic simulation

The user does not set a seed or trial count.

The runtime starts with 10,000 trials.

For a binary event, it calculates this Monte Carlo half-width:

```text
1.96 * sqrt(chance * (1 - chance) / trials)
```

It doubles the trials when the half-width exceeds 0.5 percentage points.

It stops when the limit passes or after 100,000 trials.

The normal result shows the trial count and stopping reason.

It never shows the seed.

A protected audit record stores the seed.

The runtime reports sample, model, and Monte Carlo uncertainty separately.

## 15. Report additions

The runtime always reports required evidence.

The user does not request it again.

Required evidence includes:

- Target definition
- Data scope
- Sample counts
- Observed rates
- Method result
- Baseline difference when present
- Uncertainty
- Exact resource versions
- Warnings

The optional `report` list adds supporting views.

```seam
report:
  - zone map
  - 5 examples
```

Version 0.2 accepts these additions:

- `zone map`
- `<number> examples`
- `pitcher breakdown`
- `batter breakdown`
- `park breakdown`

The automatic audit shows fields, filters, trials, stopping rules, and versions.

It does not show credentials or the hidden seed.

## 16. Cross-key rules

The compiler checks the complete analysis.

`method: observed` needs only a data source.

`method: model` needs an outcome model.

`method: simulation` needs an outcome model and simulation algorithm.

`versus` needs a comparison algorithm.

`horizon: this pitch` accepts only immediate-pitch outcomes.

`horizon: plate appearance` accepts only plate-appearance outcomes.

Version 0.2 predicts that final result from the anchored pitch state.

Its simulation samples that result. It does not build a pitch-by-pitch path.

A future path simulator will need an approved pitch-choice policy.

The runtime gets minimum sample rules from the catalog policy.

The normal language does not repeat those technical limits.

## 17. Pitch names

Version 0.2 defines these atomic names:

- `four-seam fastball`
- `sinker`
- `cutter`
- `slider`
- `sweeper`
- `curveball`
- `knuckle curve`
- `changeup`
- `splitter`

It defines these groups:

- `fastball`
- `breaking ball`
- `off-speed pitch`

The data catalog defines each group expansion.

The execution plan shows the expansion.

## 18. Resource catalog

The catalog maps readable names to local or remote resources.

The analyst does not write addresses or credentials.

```yaml
catalog: team baseball
version: 1

defaults:
  model: approved pitch outcome
  comparison: matched comparison
  simulation: adaptive event simulation

data:
  team pitches:
    connector: csv
    connection: demo data
    object: data/sample-pitches.csv
    contract: seam.pitch.v1
    access: read only

models:
  approved pitch outcome:
    registry:
      connector: mlflow
      connection: team model registry
      name: pitch-outcome
      alias: champion
    serving:
      connector: kserve v2
      connection: team model gateway
      name: pitch-outcome
    input: seam.pitch.features.v1
    output: seam.pitch.outcomes.v1
    require:
      status: approved
      calibration: passed

algorithms:
  matched comparison:
    connector: openapi
    connection: team analytics gateway
    operation: comparePitchSequences
    release: 3.2.1
    input: seam.comparison.request.v1
    output: seam.comparison.result.v1
```

The catalog can use local resources without changing the study.

## 19. Remote checks

Before execution, the compiler performs these steps:

1. Resolve every readable resource name.
2. Check each connection profile.
3. Read resource information.
4. Check input and output contracts.
5. Check approval requirements.
6. Resolve aliases to exact versions.
7. Freeze all versions in the execution plan.
8. Check data movement and feature timing.

The runtime never resolves an alias again during that execution.

If the exact version becomes unavailable, the execution stops.

It never trains or selects an undeclared replacement.

## 20. Compiler forms

The compiler produces these forms:

1. Lexer tokens
2. Concrete syntax tree
3. Typed analysis tree
4. Checked resource plan
5. Bounded execution graph
6. Generated SQL and service requests

The runtime executes only the bounded graph.

## 21. Connector contract

Each connector provides these operations:

```text
describe
check
run
cancel
audit
```

Each remote request gets a time limit and idempotency key.

The runtime retries only safe or idempotent requests.

The execution plan lists every service that receives data.

## 22. Errors

Each error names the source, line, key, problem, and correction.

```text
study.seam:24:5 [S202]
Unknown target key "result".
Use 'outcome'.
```

```text
study.seam:37:3 [S315]
"simulation" needs an outcome model.
Add "use.model" or configure an approved catalog default.
```

## 23. Core grammar

```ebnf
document       = study?, data, use?, analyze ;
study          = "study:", text, newline ;
data           = "data:", newline, data_entry+ ;
use            = "use:", newline, use_entry+ ;
analyze        = "analyze:", newline, analyze_entry+ ;
target         = indent, "target:", newline, target_entry+ ;
when           = indent, "when:", newline, previous ;
versus         = indent, "versus:", newline, previous ;
facts          = indent, "facts:", newline, facts_entry+ ;
report         = indent, "report:", newline, report_item+ ;
previous       = indent, "previous:", newline, previous_entry+ ;
report_item    = indent, indent, "- ", report_value, newline ;
entry          = indent, key, ": ", value, newline ;
indent         = "  " ;
newline        = "\n" ;
```

The parser reads structure first.

The semantic checker then reads domain values.

This separation keeps errors specific.

## 24. Standards

- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [CommonMark 0.31.2](https://spec.commonmark.org/spec)
- [JSON RFC 8259](https://www.rfc-editor.org/info/rfc8259/)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [Apache Arrow Flight SQL](https://arrow.apache.org/docs/format/FlightSql.html)
- [KServe V2 inference protocol](https://kserve.github.io/website/docs/concepts/architecture/data-plane/v2-protocol)
- [OpenAPI 3.2.0](https://spec.openapis.org/oas/latest.html)
- [MLflow model registry aliases](https://mlflow.org/docs/latest/ml/model-registry/workflow)
