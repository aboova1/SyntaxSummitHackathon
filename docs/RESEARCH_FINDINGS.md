# Next-pitch decision research

Review date: August 30, 2026.

## Product conclusion

Prioritize one-pitch outcome prediction.

Add recommendation as a controlled ranking task.

Do not start with long pitch-sequence simulation.

Do not compare a prior pitch with an artificial exclusion group.

The live decision has two useful forms.

1. Estimate all outcomes for one pitch call.
2. Rank available pitch calls for one result.

## Required inputs

The model needs the pitcher, batter, count, and prior pitch.

It also needs the intended pitch type and location.

Outs, runners, and score can change the value of an outcome.

Public Statcast provides players, pitch type, pitch result, count, outs, runners, and score.

It also provides delivered pitch location and pitch movement.

[Statcast CSV documentation](https://baseballsavant.mlb.com/csv-docs)

## What current methods support

### One-pitch outcome models

Models can estimate contact, called-strike, and run outcomes.

Flexible models can use players, location, count, outs, runners, and score.

Bayesian methods can also carry uncertainty through the decision.

[Bayesian plate-discipline study](https://arxiv.org/abs/2305.05752)

### Pitch-call evaluation

An at-bat can use a stochastic decision model.

The hard parts are location execution, swing behavior, and outcome prediction.

The pitch call must include intended location.

[Optimal pitching strategy study](https://arxiv.org/abs/2110.04321)

### Counterfactual pitch testing

A model can replace a candidate pitch while it holds the situation fixed.

A 2026 study tested pitch type and location this way.

The study optimized one-pitch in-play or swing-out predictions.

[Counterfactual pitch study](https://arxiv.org/abs/2606.17345)

### Context and history

Count is a strong input for pitch selection and outcome.

Prior pitch speed, movement, and location can add useful information.

The previous pitch is a direct fact.

A user does not need an artificial lookback window for the first product.

[Pitch type and location study](https://journals.sagepub.com/doi/10.3233/JSA-200559)

## Main limits

### A pitch call is not the delivered pitch

The catcher can request one location.

The pitcher can deliver another location.

A production model must estimate execution error around the target.

Public data does not reliably contain the intended target.

Team call and target data is necessary for catcher evaluation.

### Recommendation needs a clear goal

The best call depends on the goal.

Maximizing a called strike can differ from avoiding a hit.

Run value is better than one event for full game strategy.

The first interface keeps goals explicit.

### Outcome labels must not overlap

`strike` can include a called strike, a miss, or a foul.

The product therefore returns six separate outcomes.

The six chances total 100%.

`any strike` is an optional combined recommendation goal.

### Probability quality matters

Accuracy and ROC AUC do not prove reliable probabilities.

Production models need log loss, Brier score, and calibration plots.

They also need time-based tests and player holdout tests.

### Recommendation is not causation

Historical pitch calls reflect hidden intent and game plans.

A model recommendation is a counterfactual estimate.

It is not proof that the pitch causes the outcome.

### Long paths compound error

Each added pitch needs another policy and outcome prediction.

Error increases along the path.

The first release stops after one pitch.

## Capability order

1. Predict a complete one-pitch outcome distribution.
2. Include pitch type and intended location.
3. Use exact pre-pitch facts.
4. Show calibration and uncertainty.
5. Rank calls from the pitcher's arsenal.
6. Connect private call and target data.
7. Add run-value goals.
8. Add in-game use after latency and reliability tests.
9. Add multi-pitch planning after policy tests.

## Demonstration status

The offline model is illustrative.

Its data is synthetic.

Its simulation range covers simulation error only.

It does not show model or data uncertainty.
