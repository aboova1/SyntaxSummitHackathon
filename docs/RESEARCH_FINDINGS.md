# Pitch-sequence research findings

Review date: August 30, 2026.

## Product conclusion

Prioritize short-horizon prediction and clear comparison evidence.

Do not promise an optimal pitch or a causal sequence effect.

The data supports useful prediction. It does not capture the complete decision.

## What current methods do well

### Short event prediction

Recent models can estimate near-term pitch results from pitch history and context.

One 2026 preprint reported a 0.811 ROC AUC for its binary task.

That score measures discrimination. It does not prove calibrated probabilities.

The study used MLB data and one main swing-out objective.

Its authors call for more objectives, external tests, and clear explanations.

[Counterfactual pitch-sequence study](https://arxiv.org/abs/2606.17345)

### Physical contrast

Speed, movement, and location changes contain useful sequence information.

Earlier work linked lower pitch predictability with higher strikeout rates.

Its context was limited. SeamScript therefore adds count, batter, pitcher, and game facts.

[Pitch predictability study](https://journals.sagepub.com/doi/full/10.3233/JSA-170103)

### Repeated sequence patterns

Large Statcast samples reveal stable sequence motifs.

The same motifs do not directly explain broad results, such as ERA or wins.

SeamScript treats motifs as conditions. It does not treat them as complete explanations.

[Pitch-pattern motif study](https://arxiv.org/pdf/2601.11904)

### Context adjustment

Pitch choice depends on count, batter, pitcher, and game state.

Matched groups and propensity methods can reduce clear selection differences.

They cannot remove unknown intent or all unmeasured context.

[Propensity-score study](https://arxiv.org/abs/2208.03492)

## Main limits

### Public data shows delivery, not the complete call

Statcast records the delivered pitch and result.

It does not reliably show the intended location or the call source.

A catcher review therefore needs private call and target data.

[Statcast field documentation](https://baseballsavant.mlb.com/csv-docs)

### Long simulations compound error

Each simulated step uses another prediction and another policy choice.

Error increases as the path grows.

The first release therefore prioritizes one-pitch events.

[World-model study](https://arxiv.org/pdf/2602.07030)

### Player-pair data is sparse

Many pitcher-batter pairs have few shared pitches.

Isolated pair models can become unstable.

Use pooled batter and pitcher history by default.

### A strong score is not probability calibration

Accuracy, F1, and ROC AUC do not test probability reliability.

Production models need Brier score, log loss, and reliability checks.

The demonstration model passes only a synthetic calibration check.

### Observed differences are not causal effects

The pitcher chose each pitch for a reason.

Matching controls known facts only.

SeamScript reports a matched difference. It does not report a causal effect.

## Capability order

1. Compile a readable one-pitch question.
2. Enforce plate-appearance boundaries and feature timing.
3. Show observed rates and matched differences.
4. Use an approved, frozen model version.
5. Run automatic one-pitch simulations.
6. Show data, model, and simulation uncertainty separately.
7. Add private call and intended-location data.
8. Add plate-appearance paths after policy and calibration tests.
9. Add in-game advice after latency and reliability tests.

## Data scope

The demonstration uses synthetic 2023 through 2025 data.

A real study should use a time-based train and test split.

Bat tracking is optional because public coverage starts in 2024.

The 2026 ABS change can also create a new data period.

[Statcast overview](https://www.mlb.com/glossary/statcast) · [Bat tracking](https://www.mlb.com/news/what-you-need-to-know-about-statcast-bat-tracking) · [2026 ABS rules](https://www.mlb.com/press-release/press-release-mlb-announces-abs-challenge-system-coming-to-the-major-leagues-beginning-in-the-2026-season)
