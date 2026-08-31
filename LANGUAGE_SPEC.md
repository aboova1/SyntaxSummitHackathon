# SeamScript language specification

Version 0.4

## Purpose

SeamScript describes one next-pitch decision.

It supports two questions.

- Predict the outcome chances for one pitch call.
- Recommend the best pitch call for one result.

A pitch call has a pitch type and an intended location.

## Formula

Use these blocks in this order.

```text
study -> source -> situation -> question -> using -> include
```

`study` gives the decision a name.

`source` names approved data.

`situation` contains facts known before the next pitch.

`question` states the requested output.

`using` selects approved tools. This block is optional.

`include` selects result views. This block is optional.

## Predict outcomes

Use `outcomes for` to test one next pitch.

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

The result has six separate outcomes.

- `ball`
- `called strike`
- `swing and miss`
- `foul`
- `out in play`
- `hit`

The six chances total 100%.

## Recommend a pitch

Use `best pitch for` to rank pitch calls.

```seam
question:
  best pitch for: swing and miss
```

The runtime tests pitches in the selected pitcher's arsenal.

It tests approved target locations for each pitch.

It returns the best call and two other calls.

Valid goals are:

- `swing and miss`
- `called strike`
- `any strike`
- `out in play`

## Situation rules

The situation uses one exact count.

The previous pitch is the last pitch in the plate appearance.

Use `previous pitch: none` before the first pitch.

Valid locations are:

- `high and inside`
- `high and away`
- `middle`
- `low and inside`
- `low and away`

`outs` accepts 0, 1, or 2.

`score` accepts `ahead`, `tied`, or `behind`.

## Tool rules

The catalog supplies team defaults.

The user can select a different approved model.

The model can run locally or through a remote service.

The runtime does not train an undeclared model.

`simulation: automatic` runs approved trials.

The user does not enter technical random controls.

## Evidence rules

The result must name the model and version.

The result must state the number of simulation trials.

The result must separate simulation error from model uncertainty.

A recommendation is a model estimate. It is not a causal claim.

The model must use only pre-pitch facts.
