# Devpost submission text

## Project name

SeamScript

## Short description

A readable language for checked next-pitch prediction and recommendation.

## Inspiration

Baseball teams have detailed pitch data and approved models.

Coaches still need analysts and custom code to use them.

We wanted one clear language for the final decision.

## What it does

SeamScript starts with a real pre-pitch situation.

The user enters the pitcher, batter, count, prior pitch, and game state.

The user then selects one task.

- Predict all outcomes for one pitch and target location.
- Recommend the best available pitch call for one result.

The result has six separate outcomes that total 100%.

Recommendation mode tests the pitcher's arsenal and approved target locations.

Automatic simulation runs 40,000 trials for each call.

The user does not enter technical random controls.

## Language design

`situation` contains only known facts.

`question` contains only the requested output.

`outcomes for` tests one call.

`best pitch for` requests a ranked recommendation.

This formula stays readable and easy to remember.

## How we built it

We built the language, checked planner, runtime, and browser studio in TypeScript.

The runtime can connect to local or remote data and approved models.

It can freeze MLflow model versions and call KServe services.

It does not train an undeclared replacement model.

## Research choices

Pitch type alone is not a complete call.

The product includes intended location and execution error.

Long sequence simulation compounds model and policy error.

The first release therefore predicts one pitch at a time.

Recommendations state one goal and stay inside the pitcher's arsenal.

## Accomplishments

- Two direct baseball decision tasks
- A clear facts-versus-output language
- Complete outcome distributions
- Automatic local simulation
- Ranked pitch and location calls
- Approved remote resource support
- A full live studio
- A self-contained offline playground
- Desktop and mobile layouts
- Unit, server, and browser tests

## Demonstration notice

The included players, data, and local model are synthetic.

They prove the product flow.

They do not provide real baseball advice.
