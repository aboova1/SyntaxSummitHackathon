# Devpost submission text

## Project name

SeamScript

## Short description

A readable language and compiler for checked baseball sequence analysis.

## Inspiration

Baseball teams have detailed pitch data and approved prediction systems.

Coaches often need an analyst, SQL, and custom code to use them.

We wanted one clear language for that last mile.

## What it does

SeamScript lets a user describe one pitch-sequence question.

The language separates the target event from the input facts.

Its compiler checks syntax, baseball meaning, resource contracts, and feature timing.

It then creates a frozen plan, generated SQL, and bounded service calls.

The runtime can calculate observed rates, model chances, and simulated chances.

Automatic simulation stops when Monte Carlo error reaches its approved limit.

The normal result hides technical controls, including the seed.

The protected audit record keeps them for repeatability.

## How we built it

We built a custom lexer, parser, concrete tree, and typed semantic checker in TypeScript.

We added a catalog resolver, execution planner, SQL generator, runtime, CLI, and browser studio.

The data contract includes more than 70 baseball fields.

The compiler allows only facts known before the target pitch.

Remote connectors support HTTP data, MLflow, KServe V2, and OpenAPI services.

## Challenges

Natural English is readable but difficult to remember precisely.

We used a small, fixed, YAML-like formula instead.

Pitch-sequence models also confuse prediction with causation.

We separated observed, model, simulation, and uncertainty labels.

## Accomplishments

- A complete compiler and local runtime
- Exact remote resource plans
- Automatic and repeatable simulation
- Clear target and fact separation
- A responsive working demonstration
- Unit, integration, CLI, remote, and browser tests

## What we learned

Sequence history matters, but context and pitch shape matter more.

Strong classification scores do not prove calibrated probabilities.

Long simulations compound model and policy error.

The best first use is a reviewed pregame workflow.

## Next steps

Connect real team data and a validated team model.

Add private call-source and intended-location fields.

Test plate-appearance simulation with an approved pitch-choice policy.

Measure in-game latency before any mound-visit release.

## Demonstration notice

The included data and model are synthetic.

They prove the complete software path. They do not prove a baseball claim.
