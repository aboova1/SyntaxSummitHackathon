# SeamScript

SeamScript turns a baseball question into a checked execution plan.

It gives coaches access to approved data, models, and algorithms.

The user does not need Python, SQL, or model training.

The first release studies pitch sequences.

## The language

A study follows the same order as a pregame question.

`source` selects approved data.

`target` states what to estimate.

`sequence` states the setup and baseline.

`facts` states known inputs.

`evidence` selects the result type.

```seam
study: Fastball before slider

source: synthetic demo pitches

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

The syntax uses one formula:

```text
source -> target -> sequence -> facts -> evidence -> include
```

`target` is the event to estimate.

`facts` contains information available before that event.

One `lookback` applies to the primary setup and baseline.

`include` adds views. Core evidence and audit data are automatic.

The catalog supplies approved tools by default.

An optional `resources` block selects a different approved remote tool.

## Run the project

Use Node.js 22 or later.

```bash
npm install
npm run check
npm run demo
npm run app
```

Open `http://127.0.0.1:4173` after the last command.

The studio includes a guided playground, code editor, language guide, resource catalog, and local run history.

The playground shows four pitchers, six batters, and full player profiles.

It also supports four prior pitches, count groups, and batter-side filters.

It saves drafts in the browser. It also supports light, dark, desktop, and mobile layouts.

The demonstration uses 31,104 synthetic pitch records.

Do not use its result as baseball evidence.

Run `npm run demo:record` to create a short browser recording.

## Command line

```bash
npm run dev -- check examples/demo.seam --catalog examples/demo.catalog.yml
npm run dev -- compile examples/demo.seam --catalog examples/demo.catalog.yml --emit plan
npm run dev -- compile examples/demo.seam --catalog examples/demo.catalog.yml --emit sql
npm run dev -- explain examples/demo.seam --catalog examples/demo.catalog.yml
npm run demo
```

Use `--json` for public machine output.

Use `--audit-file <path>` for the protected repeatability record.

The normal output never includes the simulation seed.

## What works

- A custom indentation lexer
- A concrete syntax tree parser
- A typed baseball semantic checker
- Source ranges and useful corrections
- A trusted resource catalog
- Exact remote model version resolution
- A frozen execution graph and fingerprint
- Parameterized SQL generation
- Plate-appearance-safe sequence selection
- Exact-strata comparison weights
- More than 70 baseball data fields
- Pre-pitch feature timing checks
- Observed, model, and simulated evidence
- Adaptive automatic simulation
- Confidence ranges and explicit uncertainty limits
- Zone maps, examples, and breakdown data
- CSV and bounded HTTP data access
- MLflow alias resolution
- Exact KServe V2 inference
- OpenAPI comparison and simulation services
- A CLI and responsive browser studio

## Remote resources

The study uses short resource names.

An administrator-owned catalog maps names to resources.

A separate connections file stores service locations and token names.

The study never contains an address or secret.

The runtime supports these remote paths:

- HTTP JSON data gateways
- MLflow model aliases
- KServe V2 model services
- OpenAPI comparison services
- OpenAPI simulation services

The runtime freezes each model alias to an exact version.

It never trains an undeclared replacement model.

Direct Flight SQL needs an ADBC sidecar or HTTP gateway.

The current Node runtime does not claim direct Flight SQL support.

See [REMOTE_RESOURCES.md](docs/REMOTE_RESOURCES.md).

## Evidence rules

SeamScript uses four separate labels.

- An observed rate describes matching records.
- A model chance is a point prediction.
- A simulated chance samples model results.
- A causal effect needs a separate causal design.

The current release does not report causal effects.

Model uncertainty is explicit when the model does not provide it.

Monte Carlo error does not include model or data uncertainty.

## Target users

The first user is a pregame game-plan coordinator.

The next users are a catching coordinator and an in-game pitching coach.

See [TARGET_USERS.md](TARGET_USERS.md) for their decisions and limits.

## Test the project

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run model:evaluate
```

The test suite covers syntax, planning, execution, remote failures, security, and browser behavior.

## Project documents

- [Final pitch](PITCH.md)
- [Language specification](LANGUAGE_SPEC.md)
- [Compiler architecture](docs/ARCHITECTURE.md)
- [Research findings](docs/RESEARCH_FINDINGS.md)
- [Data contract](docs/DATA_CONTRACT.md)
- [Demonstration model card](docs/DEMO_MODEL.md)
- [Remote resources](docs/REMOTE_RESOURCES.md)
- [Demonstration script](docs/DEMO_SCRIPT.md)
- [Devpost text](docs/DEVPOST.md)
