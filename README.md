# SeamScript

SeamScript is a readable language for sports sequence analysis.

It lets analysts study pitch sequences without Python, SQL, or model training.

The first release focuses on baseball.

## Core design

A `.seam` file has seven stable blocks:

1. `study`
2. `use`
3. `data`
4. `sequence`
5. `compare`
6. `estimate`
7. `show`

The syntax uses YAML-like keys and indentation.

It uses Markdown-like lists and comments.

It uses JSON-like strict types and errors.

## Example

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
  - calculation details
```

`method: simulation` starts the simulation automatically.

The system hides the random seed and trial controls.

The protected audit record keeps the seed for repeatability.

`calculation details` shows the trial count and stopping rule.

It does not show the seed.

## Remote resources

The `use` block selects approved data, models, and algorithms by readable name.

A trusted catalog maps each name to a local or remote resource.

Study files contain no addresses or secrets.

The compiler checks access, contracts, approval state, and exact versions.

It stops when a required resource is unavailable.

It never trains an untested replacement model.

## First target user

The first target user is a pregame game-plan coordinator.

This user can review results before a coach or player receives them.

Later releases can support catcher review and fast in-game decisions.

## Project documents

- [Final pitch](PITCH.md)
- [Language specification](LANGUAGE_SPEC.md)
- [Target users](TARGET_USERS.md)
- [Example study](examples/fastball-slider.seam)
- [Example resource catalog](examples/seam.catalog.yml)
- [Research report](research/seamscript-pitch-sequencing/report.html)

## Status

The research and language design are complete for version 0.1.

The parser, connectors, analysis engine, and interface are not implemented yet.
