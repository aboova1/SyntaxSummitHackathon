# Demonstration model card

## Purpose

The built-in models test the complete SeamScript runtime.

They use transparent probability rules.

They are not production baseball models.

## Inputs

The next-pitch model uses selected pre-pitch facts.

It returns ball, called strike, swing-and-miss, foul, out-in-play, and hit chances.

These separate chances total 100%.

It tests a pitch type and intended target location.

Recommendation mode tests calls from the pitcher's synthetic arsenal.

They cover batter history, pitcher form, pitch shape, sequence, count, park, and catcher history.

The next-pitch source is in `src/decision.ts`.

The legacy study model is in `src/runtime/model.ts`.

## Synthetic check

Run the check with:

```bash
npm run model:evaluate
```

The current synthetic sample has 8,640 matched target pitches.

- Brier score: 0.2121
- Log loss: 0.6147
- Expected calibration error: 0.0134
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
