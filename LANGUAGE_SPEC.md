# SeamScript Language Specification

Version 0.1

## 1. Purpose

SeamScript is a controlled language for sports sequence analysis.

The first release supports baseball pitch data.

The language has seven stable blocks:

1. `study`
2. `use`
3. `data`
4. `sequence`
5. `compare`
6. `estimate`
7. `show`

The structure uses ideas from YAML, Markdown, and JSON.

It uses indentation and key-value lines from YAML.

It uses lists and comments from Markdown.

It uses strict names, types, and schema checks from JSON.

SeamScript is not YAML. It does not support tags, anchors, or implicit values.

## 2. Complete example

```seam
study: Does a fastball set up a slider?

use:
  data: team pitches
  model:
    outcomes: approved pitch outcome
  algorithm:
    comparison: matched comparison
    simulation: plate appearance simulator
  on unavailable: stop

data:
  seasons: 2023 through 2025
  games: regular season

sequence:
  - fastball
  - slider within 2 pitches

compare:
  against: slider without fastball within 2 pitches before it
  match: pitcher, count, batter side, season
  minimum: 100 sliders per pitcher in each group

estimate:
  event: swing and miss on the slider
  method: simulation
  horizon: this pitch

show:
  - observed rates
  - simulated chance
  - difference
  - uncertainty range
  - strike-zone map
  - 5 example plate appearances
  - calculation details
```

A new reader can follow this file from top to bottom.

An experienced user can remember the seven block names.

## 3. Layout rules

- Save study files with the `.seam` extension.
- Use lower-case block names and keys.
- Use two spaces for each indentation level.
- Do not use tabs.
- Put one key-value pair on each line.
- Put a colon after each block name and key.
- Use `-` for each list item.
- Start a full-line comment with `#`.
- Blank lines have no meaning.
- Duplicate keys are errors.
- Unknown keys are errors.
- Block order is fixed.

The parser splits a key-value line at the first colon.

Text after that colon is the value.

Quotes are optional for normal text values.

Use double quotes when leading or trailing spaces are part of a value.

## 4. Study block

The `study` block gives the question.

It must be the first non-comment line.

```seam
study: Does a fastball set up a slider?
```

The question is a label. It does not control execution.

## 5. Use block

The `use` block selects named resources from a trusted catalog.

```seam
use:
  data: team pitches
  model:
    outcomes: approved pitch outcome
  algorithm:
    comparison: matched comparison
    simulation: plate appearance simulator
  on unavailable: stop
```

The `data` value selects one data resource.

The `model` map assigns a model to a model role.

The `algorithm` map assigns an algorithm to an execution role.

Resource names must use lower-case letters, spaces, numbers, and hyphens.

The compiler matches each resource name exactly.

Version 0.1 defines these model roles:

- `outcomes`
- `pitch choice`

Version 0.1 defines these algorithm roles:

- `comparison`
- `simulation`
- `uncertainty`

The `on unavailable` key accepts these values:

- `stop`
- `use approved fallback`

The default value is `stop`.

SeamScript never trains a model because a resource is missing.

A future `train` block can request training. Version 0.1 does not include that block.

## 6. Data block

The `data` block limits the selected data.

```seam
data:
  seasons: 2023 through 2025
  games: regular season
```

Version 0.1 defines these keys:

- `seasons`
- `dates`
- `games`
- `pitchers`
- `batters`
- `teams`

Use `through` for an inclusive range.

```seam
seasons: 2023 through 2025
```

Use commas for a list on one line.

```seam
teams: Cubs, Brewers, Cardinals
```

The compiler sends filters to the remote source when the connector supports this action.

## 7. Sequence block

The `sequence` block contains an ordered list.

```seam
sequence:
  - fastball
  - slider within 2 pitches
```

Each item has this form:

```text
<pitch> [in <zone>] [at <count>] [within <number> pitches]
```

Examples:

```seam
sequence:
  - fastball high and inside
  - slider low and outside within 2 pitches
```

```seam
sequence:
  - changeup at 1-1
  - fastball within 1 pitch
```

A sequence cannot cross a plate-appearance boundary.

The compiler reports this rule in every execution plan.

Version 0.1 has these atomic pitch names:

- `four-seam fastball`
- `sinker`
- `cutter`
- `slider`
- `sweeper`
- `curveball`
- `knuckle curve`
- `changeup`
- `splitter`

It also has these pitch groups:

- `fastball`
- `breaking ball`
- `off-speed pitch`

The selected data catalog defines each group expansion.

The execution plan shows the expanded pitch names.

## 8. Compare block

The `compare` block defines the reference group.

```seam
compare:
  against: slider without fastball within 2 pitches before it
  match: pitcher, count, batter side, season
  minimum: 100 sliders per pitcher in each group
```

The `against` key defines the reference event.

Version 0.1 accepts this reference form:

```text
<pitch> without <pitch> within <number> pitches before it
```

The first pitch must match the final item in `sequence`.

The `match` key defines required matching fields.

The `minimum` key defines the sample rule.

The `match` value is a comma-separated list of catalog fields.

The `minimum` value has this form:

```text
<number> <records> per <group field> in each group
```

The compiler must show both group sizes.

The compiler must reject an unsupported match field.

## 9. Estimate block

The `estimate` block requests a probability.

```seam
estimate:
  event: swing and miss on the slider
  method: simulation
  horizon: this pitch
```

The `event` key defines the result of interest.

Version 0.1 accepts these immediate-pitch events:

- `swing`
- `swing and miss`
- `contact`
- `foul`
- `called strike`
- `ball in play`

It accepts these plate-appearance events:

- `strikeout`
- `walk`
- `hit by pitch`
- `ball in play`

The `method` key accepts these values:

- `observed`
- `model`
- `simulation`

The `horizon` key accepts these values:

- `this pitch`
- `rest of plate appearance`

The `method: simulation` line starts automatic simulation.

The language does not show the random seed.

The runtime stores the seed in a protected audit record.

The runtime starts with 10,000 trials.

It calculates the Monte Carlo error for every requested event.

It doubles the trial count when a 95 percent half-width exceeds 0.5 percentage points.

For a binary event, the half-width is `1.96 * sqrt(p * (1 - p) / trials)`.

It stops after the limit passes or after 100,000 trials.

The runtime reports the final trial count and stopping reason.

It reports model and sample uncertainty separately from Monte Carlo error.

Use this form for a full plate-appearance simulation:

```seam
estimate:
  event: strikeout, walk, or ball in play
  method: simulation
  horizon: rest of plate appearance
  future pitches: observed pitch choices
```

The `future pitches` key accepts these values:

- `observed pitch choices`
- `selected pitch choice model`

The second value requires the `pitch choice` model role.

## 10. Show block

The `show` block lists required output.

```seam
show:
  - observed rates
  - simulated chance
  - difference
  - uncertainty range
  - strike-zone map
  - 5 example plate appearances
  - calculation details
```

Output order follows list order.

Unknown output names are errors.

Version 0.1 accepts these output names:

- `observed rates`
- `model chance`
- `simulated chance`
- `difference`
- `uncertainty range`
- `strike-zone map`
- `<number> example plate appearances`
- `calculation details`

`calculation details` does not show the hidden seed.

## 11. Cross-block rules

The compiler checks all blocks together.

`method: observed` does not require a model.

`method: model` requires the `outcomes` model role.

`method: simulation` requires the `outcomes` model role and the `simulation` algorithm role.

`horizon: this pitch` accepts only immediate-pitch events.

`horizon: rest of plate appearance` accepts only plate-appearance events.

A plate-appearance simulation also requires the `future pitches` key.

The `difference` output requires a `compare` block.

The `simulated chance` output requires `method: simulation`.

When `use` is absent, the compiler uses approved catalog defaults.

The compiler stops when a required default does not exist.

## 12. Resource catalog

The catalog maps readable names to local or remote resources.

The analyst does not write addresses or credentials in a study.

An administrator owns the catalog and connection profiles.

```seam
catalog: team baseball
version: 1

defaults:
  data: team pitches
  model:
    outcomes: approved pitch outcome
  algorithm:
    comparison: matched comparison
    simulation: plate appearance simulator

data:
  team pitches:
    connector: flight sql
    connection: team warehouse
    object: baseball.analytics.statcast_pitches
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

  plate appearance simulator:
    connector: openapi
    connection: team analytics gateway
    operation: simulatePlateAppearance
    release: 2.4.0
    input: seam.simulation.request.v1
    output: seam.simulation.result.v1
```

The catalog can point to a local resource. The study syntax does not change.

An approved fallback must have its own named catalog entry.

The primary entry must name that fallback.

`use approved fallback` cannot select any other resource.

## 13. Remote resource rules

The compiler performs these steps before execution:

1. Resolve each readable resource name.
2. Check the connection profile.
3. Read the remote metadata.
4. Check the input and output contracts.
5. Check the approval requirements.
6. Resolve each alias to an exact version.
7. Freeze all versions in the execution plan.
8. Ask the user to approve the plan when policy requires approval.

The compiler produces four internal forms:

1. A parsed syntax tree.
2. A typed study plan.
3. A resource plan with exact versions.
4. A bounded execution graph.

The runtime only executes the fourth form.

Model aliases can change between runs.

The runtime records the alias and the exact resolved version.

The runtime also records the model digest when the service provides it.

For MLflow, the registry resolves an alias to a model version.

KServe serves that exact version through its version endpoint.

The runtime never resolves the alias again during that execution.

If the exact version becomes unavailable, the execution stops.

The compiler rejects a model with missing output events.

The compiler rejects an algorithm with an incompatible contract.

The compiler stops when a required remote resource is not ready.

The compiler never selects an unapproved fallback.

A data connector must provide a stable snapshot identifier or an extraction hash.

The result is non-repeatable when neither value exists.

An audited production run stops in that condition.

## 14. Standard connector contracts

Use Arrow Flight SQL for compatible remote SQL systems.

Use vendor adapters when the warehouse does not support Flight SQL.

Use KServe V2 for compatible prediction services.

Use OpenAPI for general remote algorithms.

Use JSON Schema 2020-12 for request and response contracts.

Each connector must expose these operations:

```text
describe
check
run
cancel
audit
```

The `describe` operation returns identity, version, and contracts.

The `check` operation tests access and compatibility.

The `run` operation executes one bounded request.

The `cancel` operation stops a supported request.

The `audit` operation returns the execution record.

Each remote request gets an idempotency key and a time limit.

The runtime retries only safe or idempotent requests.

The SeamScript runtime controls remote calls.

The simulation algorithm does not select a model by itself.

The runtime sends model probability vectors to the selected simulation algorithm.

A full plate-appearance simulation also needs a pitch-choice policy.

That policy can use an approved model or a named observed policy.

## 15. Security and trust

Study files and catalogs must not contain secrets.

Connection profiles get secrets from the operating system or a secret manager.

Data connections use read-only access by default.

The compiler sends only required columns and rows to a remote model.

The execution plan lists every remote service that will receive data.

The runtime does not send player names when stable identifiers are sufficient.

The runtime stops on a contract change. It does not guess a field mapping.

The audit record contains these values:

- Normalized study text
- Data source and snapshot
- Executed query or query hash
- Model alias and exact version
- Model digest when available
- Algorithm name and exact version
- Input and output contract versions
- Hidden simulation seed
- Trial count
- Request identifiers
- Warnings and retries

## 16. Time safety

Remote models can contain data from later seasons.

The model metadata must give its training cutoff.

The runtime compares that cutoff with the study period.

It labels each estimate as prospective or retrospective.

It warns when a historical study uses later training data.

## 17. Error style

Errors identify the block, key, value, and correction.

```text
Line 18, estimate.method:
  Unknown value "simulate".
  Use "observed", "model", or "simulation".
```

```text
Resource "approved pitch outcome" is not ready.
The study says "on unavailable: stop".
No model was trained or selected as a fallback.
```

## 18. Core grammar

This grammar shows the document structure.

```ebnf
document       = study, use?, data, sequence, compare?, estimate?, show ;
study          = "study:", text, newline ;
use            = "use:", newline, use_entry+ ;
data           = "data:", newline, data_entry+ ;
sequence       = "sequence:", newline, sequence_item+ ;
compare        = "compare:", newline, compare_entry+ ;
estimate       = "estimate:", newline, estimate_entry+ ;
show           = "show:", newline, show_item+ ;
sequence_item  = indent, "- ", pitch_expression, newline ;
show_item      = indent, "- ", output_expression, newline ;
entry          = indent, key, ": ", value, newline ;
indent         = "  " ;
newline        = "\n" ;
```

The parser first reads blocks and indentation.

The domain parser then checks each typed value.

This two-step design keeps error messages clear.

## 19. Design decision

Do not make SeamScript accept arbitrary English.

Arbitrary English creates synonyms, hidden assumptions, and unclear errors.

Use readable values inside a small and stable block grammar.

This design gives beginners a readable file.

It also gives regular users a pattern they can remember.

## 20. Standards used

- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [CommonMark 0.31.2](https://spec.commonmark.org/spec)
- [JSON RFC 8259](https://www.rfc-editor.org/info/rfc8259/)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [Apache Arrow Flight SQL](https://arrow.apache.org/docs/format/FlightSql.html)
- [KServe V2 inference protocol](https://kserve.github.io/website/docs/concepts/architecture/data-plane/v2-protocol)
- [OpenAPI 3.2.0](https://spec.openapis.org/oas/latest.html)
- [MLflow model registry aliases](https://mlflow.org/docs/latest/ml/model-registry/workflow)
