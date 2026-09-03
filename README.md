# SeamScript

SeamScript turns a baseball situation into a checked next-pitch decision.

It supports two direct questions.

- Predict all outcomes for one pitch call.
- Recommend the best pitch call for one desired result.

A pitch call has a pitch type and an intended location.

The user does not need Python, SQL, or model training.

## Open the offline playground

Open [web/offline.html](web/offline.html) in a browser.

You do not need to install software or start a server.

The offline page has four pitchers and six batters.

It runs 40,000 local simulation trials for each pitch call.

You can also open [index.html](index.html). It opens the offline page.

## Try the command-line demo

Run the featured study.

```bash
npm install
npm run demo
```

The command checks the language and runs 40,000 trials.

It prints six outcome chances and the model limits.

## Language example

```seam
study: Next pitch for Alex Morgan against Taylor Kim

source: team pitches

situation:
  pitcher: Alex Morgan
  batter: Taylor Kim
  count: 1-2
  previous pitch: four-seam fastball
  previous location: high and inside
  previous result: foul
  outs: 1
  runners: first
  score: tied

question:
  outcomes for: slider
  target location: low and away

using:
  model: approved pitch outcome
  simulation: automatic

include:
  - outcome chances
  - uncertainty
```

Use this question to request a recommendation.

```seam
question:
  best pitch for: swing and miss
```

The syntax has one formula.

```text
source -> situation -> question -> using -> include
```

`situation` contains known pre-pitch facts.

`question` contains the requested output.

## Run the full studio

Use Node.js 22 or later.

```bash
npm install
npm run app
```

Open `http://127.0.0.1:4173`.

The live playground needs the local service.

It shows `npm run app` when the service is not available.

## Check the project

```bash
npm run verify
```

This command checks format, types, tests, the build, and browser flows.

## Decision model

The result uses six separate one-pitch outcomes.

- Ball
- Called strike
- Swing and miss
- Foul
- Out in play
- Hit

The six chances total 100%.

Recommendation mode tests each pitch in the selected pitcher's arsenal.

It tests approved target locations for each pitch.

It returns the best call and two other calls.

The runtime shows the model version and trial count.

It separates simulation error from model uncertainty.

## Remote resources

A catalog maps short names to approved resources.

Data can come from a team warehouse or an HTTP data service.

Models can come from MLflow and KServe services.

Algorithms can come from approved OpenAPI services.

The runtime freezes model versions.

It does not train an undeclared replacement model.

## Demonstration limits

The included players and pitch records are synthetic.

The local probability model is illustrative.

The result is not real baseball advice.

Public Statcast shows the delivered pitch.

It does not reliably show the intended target or who made the call.

A production system needs private call and target data.

See [LANGUAGE_SPEC.md](LANGUAGE_SPEC.md) and [docs/RESEARCH_FINDINGS.md](docs/RESEARCH_FINDINGS.md).
