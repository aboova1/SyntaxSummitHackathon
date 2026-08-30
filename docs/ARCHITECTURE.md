# Compiler architecture

SeamScript uses explicit compiler stages.

Each stage accepts one typed form and returns one typed form.

Every failure includes a stage, code, message, source range, and correction.

```text
source text
  -> lexer tokens
  -> concrete syntax tree
  -> typed baseball study
  -> checked resource plan
  -> execution graph
  -> SQL and service calls
  -> verified result
```

## Front end

The lexer reads indentation, keys, values, list marks, comments, and line endings.

The parser builds a generic mapping and list tree.

The semantic checker builds the typed `data`, `use`, and `analyze` forms.

It rejects unknown keys, duplicate keys, invalid values, and invalid block combinations.

## Resource planning

The resolver reads an administrator-owned catalog.

It maps readable names to exact data, model, and algorithm resources.

It checks contracts, approval rules, versions, and training cutoffs.

The study file never contains addresses or credentials.

## Execution

The planner creates a bounded directed graph.

The graph contains data reads, feature work, comparisons, predictions, simulations, and output work.

The runtime owns all remote calls.

Remote algorithms cannot select undeclared models or data.

## Feature safety

Every baseball field has an availability time and a feature group.

Only values known before the target pitch can enter a predictive request.

Post-pitch values can define results. They cannot define predictive features.

The first feature groups are:

- Batter history
- Pitcher form
- Pitch shape
- Sequence history
- Game situation
- Ballpark
- Defense

The compiler records every selected field in the execution plan.

## Runtime outputs

Each result separates these forms of evidence:

- Observed rate
- Model chance
- Simulated chance
- Matched difference
- Sample uncertainty
- Model uncertainty
- Monte Carlo error

The runtime does not label a model scenario as a causal effect.
