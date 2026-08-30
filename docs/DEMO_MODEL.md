# Demonstration model card

## Purpose

The built-in model tests the complete SeamScript runtime.

It is a transparent logistic rule set.

It is not a production baseball model.

## Inputs

The model uses selected pre-pitch facts.

They cover batter history, pitcher form, pitch shape, sequence, count, park, and catcher history.

The source list is in `src/runtime/model.ts`.

## Synthetic check

Run the check with:

```bash
npm run model:evaluate
```

The current synthetic sample has 1,440 matched target pitches.

- Brier score: 0.2167
- Log loss: 0.6251
- Expected calibration error: 0.0395
- Demonstration threshold: below 0.05

This check passes the demonstration threshold.

## Limits

The check uses the same synthetic process as the product demonstration.

It is not an independent real-world test.

The model returns point predictions only.

It does not return model uncertainty.

Do not use this model for a baseball decision.

A production model needs a time-based holdout and reliability plots.

It also needs checks by pitcher, batter, pitch, count, and season.
