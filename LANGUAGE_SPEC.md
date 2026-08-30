# SeamScript language specification

Version 0.3

## 1. Design rules

Write each idea once.

Use one key for one meaning.

Keep targets separate from known facts.

Follow the order of a game-plan study.

Use team defaults unless the user needs an override.

## 2. Complete study

```seam
study: Fastball setup for slider

source: team pitches

scope:
  seasons: 2023 through 2025
  games: regular season

target:
  event: swing and miss
  pitch: slider

sequence:
  after: fastball
  versus: without fastball
  lookback: 2 pitches

facts:
  match: pitcher, count, batter side, season
  consider: batter history, pitcher form, pitch shape, sequence history, game situation, ballpark, defense

evidence: simulation

include:
  - zone map
  - 5 examples
```

The fixed workflow is:

```text
source -> target -> sequence -> facts -> evidence -> include
```

`scope` filters the source.

`resources` overrides a team default.

Both blocks stay next to the item that they change.

## 3. Top-level form

SeamScript accepts these keys in this order:

1. `study`
2. `source`
3. `scope`
4. `resources`
5. `target`
6. `sequence`
7. `facts`
8. `evidence`
9. `include`

`source`, `target`, and `evidence` are required.

All other keys are optional.

`study` is only a display name.

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
- Use commas inside one-line lists.
- Treat unknown keys as errors.
- Treat duplicate keys as errors.

Normal values do not need quotes.

## 5. Source and scope

`source` names one approved data resource.

```seam
source: team pitches
```

The catalog can connect that name to local or remote data.

`scope` adds record filters.

```seam
scope:
  seasons: 2023 through 2025
  games: regular season
  pitchers: P100
  batters: B100
  counts: 1-2, 2-2
  batter sides: left
```

Version 0.3 accepts these scope keys:

- `seasons`
- `dates`
- `games`
- `teams`
- `pitchers`
- `batters`
- `counts`
- `batter sides`

`through` defines an inclusive range.

```seam
dates: 2025-04-01 through 2025-04-30
```

Commas separate individual values.

## 6. Resources

The catalog supplies approved defaults.

Most users omit `resources`.

Use this block only for an approved override.

```seam
resources:
  model: approved pitch event
  matching: matched comparison
  simulator: adaptive event simulation
```

Each key has one role:

- `model` predicts the target event.
- `matching` makes the two record groups comparable.
- `simulator` runs repeated event trials.

The values can name local or remote services.

The user never writes an address or credential.

The runtime never trains a replacement model.

## 7. Target

`target` states the event under review.

It never states an input fact.

```seam
target:
  event: swing and miss
  pitch: slider
```

`event` states what the study measures or predicts.

`pitch` anchors the state before that event.

Immediate events are:

- `swing`
- `swing and miss`
- `contact`
- `foul`
- `called strike`
- `ball in play`

Plate-appearance events are:

- `strikeout`
- `walk`
- `hit by pitch`
- `ball in play`
- `reach base`

The compiler infers the event period.

Immediate-only events use `this pitch`.

Plate-appearance-only events use `plate appearance`.

`ball in play` uses `this pitch` by default.

Add `period` only when you must remove this ambiguity.

```seam
target:
  event: ball in play
  pitch: slider
  period: plate appearance
```

## 8. Sequence

`sequence` defines the pitch setup under review.

```seam
sequence:
  after: fastball
  versus: without fastball
  lookback: 2 pitches
```

`after` defines the primary setup.

`versus` defines one optional baseline.

`lookback` applies to both conditions.

The user writes it once.

For another setup, start `versus` with `after`.

```seam
sequence:
  after: changeup, fastball
  versus: after curveball
  lookback: 3 pitches
```

For an exclusion, start `versus` with `without`.

```seam
versus: without fastball
```

Pitch lists run from oldest to newest.

The order must match inside the lookback.

Other pitches can occur between listed pitches.

Use `lookback: 1 pitch` for the immediately prior pitch.

History never crosses a plate-appearance boundary.

## 9. Facts

`facts` contains information known before the target event.

Facts are never prediction targets.

```seam
facts:
  match: pitcher, count, batter side, season
  consider: batter history, pitcher form, pitch shape, game situation
```

`match` names facts that must align across both groups.

`consider` names feature groups for prediction and adjustment.

The catalog supplies safe defaults when this block is absent.

Supported match facts are:

- `pitcher`
- `batter`
- `count`
- `batter side`
- `pitcher hand`
- `season`
- `ballpark`
- `inning`
- `outs`
- `base state`

Supported feature groups are:

- `batter history`
- `pitcher form`
- `pitch shape`
- `game situation`
- `ballpark`
- `defense`
- `sequence history`

The execution plan lists every field from these groups.

## 10. Feature timing

Each field has one availability class.

- `before pitch`
- `after pitch`
- `after plate appearance`
- `after game`

Predictive facts can use only `before pitch` values.

Historical rates must stop before the target pitch.

The target event can use later values only as its label.

The compiler rejects feature leakage.

## 11. Evidence

`evidence` selects one result type.

```seam
evidence: simulation
```

It accepts three values:

- `observed`
- `model`
- `simulation`

`observed` calculates rates from selected records.

`model` requests chances from the approved model.

`simulation` samples the approved model chance repeatedly.

No value claims a causal effect.

## 12. Automatic simulation

The user does not set a seed or trial count.

The runtime starts with 10,000 trials.

It calculates this Monte Carlo half-width:

```text
1.96 * sqrt(chance * (1 - chance) / trials)
```

It doubles the trials when the error limit fails.

It stops after the limit passes or after 100,000 trials.

The normal result shows the trial count and stopping reason.

It never shows the seed.

A protected audit record stores the seed.

## 13. Included views

The runtime always returns core evidence.

The user does not request it again.

`include` adds only supporting views.

```seam
include:
  - zone map
  - 5 examples
```

Version 0.3 accepts:

- `zone map`
- `<number> examples`
- `pitcher breakdown`
- `batter breakdown`
- `park breakdown`

Core evidence includes:

- target definition
- data scope
- sample counts
- observed rates
- selected evidence
- baseline difference
- uncertainty
- exact resource versions
- warnings

## 14. Cross-key rules

`evidence: observed` needs only the source.

`evidence: model` needs an approved model.

`evidence: simulation` needs an approved model and simulator.

A `versus` value needs an approved matching resource.

The catalog supplies omitted resources when possible.

The runtime gets sample and error limits from catalog policy.

The user does not repeat those limits.

## 15. Pitch names

Atomic names are:

- `four-seam fastball`
- `sinker`
- `cutter`
- `slider`
- `sweeper`
- `curveball`
- `knuckle curve`
- `changeup`
- `splitter`

Group names are:

- `fastball`
- `breaking ball`
- `off-speed pitch`

The catalog defines each group expansion.

The execution plan records that expansion.

## 16. Resource catalog

The catalog maps readable names to resources.

```yaml
catalog: team baseball
version: 1

defaults:
  model: approved pitch event
  comparison: matched comparison
  simulation: adaptive event simulation

data:
  team pitches:
    connector: flight sql
    connection: team warehouse
    object: baseball.analytics.statcast_pitches
    contract: seam.pitch.v1
    access: read only

models:
  approved pitch event:
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
```

The catalog can change a connector without changing a study.

Before execution, the compiler performs these checks:

1. Resolve each readable name.
2. Check the connection profile.
3. Check input and output contracts.
4. Check approval requirements.
5. Resolve aliases to exact versions.
6. Freeze all versions in the execution plan.
7. Check data movement and feature timing.

The runtime never resolves an alias again during that run.

It stops when a frozen version becomes unavailable.

## 17. Errors

Each error gives a line, key, problem, and correction.

```text
study.seam:9:3 [S202]
Unknown key 'outcome' in target.
Use 'event'.
```

```text
study.seam:20:1 [S315]
'simulation' needs an outcome model.
Add 'resources.model' or configure a catalog default.
```

## 18. Core grammar

```ebnf
document       = study?, source, scope?, resources?, target,
                 sequence?, facts?, evidence, include? ;
study          = "study:", text, newline ;
source         = "source:", resource_name, newline ;
scope          = "scope:", newline, scope_entry+ ;
resources      = "resources:", newline, resource_entry+ ;
target         = "target:", newline, target_entry+ ;
sequence       = "sequence:", newline, sequence_entry+ ;
facts          = "facts:", newline, facts_entry+ ;
evidence       = "evidence:", evidence_value, newline ;
include        = "include:", newline, include_item+ ;
include_item   = indent, "- ", include_value, newline ;
entry          = indent, key, ": ", value, newline ;
indent         = "  " ;
newline        = "\n" ;
```

The parser reads indentation first.

The semantic checker then reads baseball values.

## 19. Version 0.2 migration

Version 0.3 removes wrapper blocks and repeated lookbacks.

| Version 0.2               | Version 0.3                    |
| ------------------------- | ------------------------------ |
| `data.source`             | `source`                       |
| other `data` keys         | `scope`                        |
| `use`                     | `resources`                    |
| `use.comparison`          | `resources.matching`           |
| `use.simulation`          | `resources.simulator`          |
| `analyze.target.outcome`  | `target.event`                 |
| `target.horizon`          | optional `target.period`       |
| `when.previous.sequence`  | `sequence.after`               |
| two `window` values       | one `sequence.lookback`        |
| `versus.previous.exclude` | `sequence.versus: without ...` |
| `facts.account for`       | `facts.consider`               |
| `method`                  | `evidence`                     |
| `report`                  | `include`                      |

The `analyze` wrapper has no replacement.

Its child ideas now appear directly in study order.

## 20. Standards

- [YAML 1.2.2](https://yaml.org/spec/1.2.2/)
- [CommonMark 0.31.2](https://spec.commonmark.org/0.31.2/)
- [JSON RFC 8259](https://www.rfc-editor.org/info/rfc8259)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [Apache Arrow Flight SQL](https://arrow.apache.org/docs/format/FlightSql.html)
- [KServe V2](https://kserve.github.io/website/docs/concepts/architecture/data-plane/v2-protocol)
- [OpenAPI 3.2.0](https://spec.openapis.org/oas/latest.html)
- [MLflow registry aliases](https://mlflow.org/docs/latest/ml/model-registry/workflow)
