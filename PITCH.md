# SeamScript pitch

SeamScript turns a baseball question into a checked execution plan.

Baseball teams have detailed data and tested models.

Most coaches still need an analyst to use them.

SeamScript removes that access gap.

A pregame coordinator writes four short blocks: `data`, `use`, `analyze`, and an optional `study` name.

Inside `analyze`, `target` states what to estimate.

`facts` states what the model can use.

`when` selects the primary sequence.

`versus` selects the baseline.

This structure prevents a target from looking like an input fact.

It also removes repeated `compare`, `estimate`, and `show` commands.

The compiler checks every key, value, resource, contract, and feature time.

It then builds a frozen plan, parameterized SQL, and bounded service calls.

The plan can use a team warehouse and approved remote models.

The system never trains an untested model by default.

`method: simulation` runs automatic trials for the target event.

The runtime stops when Monte Carlo error reaches its approved limit.

The user does not set a seed or trial count.

The private audit record keeps the seed for repeatability.

Every result separates four ideas:

- observed rate;
- model chance;
- simulated chance;
- uncertainty limits.

SeamScript does not call a matched difference a causal effect.

The first product serves a pregame game-plan coordinator.

Later releases can review catcher calls and support mound-visit decisions.

Those releases need private call data and stronger speed tests.

The demonstration uses synthetic pitches and a transparent test model.

Its result proves the complete product path. It does not prove a baseball claim.

SeamScript makes trusted baseball analysis readable, repeatable, and reviewable.
