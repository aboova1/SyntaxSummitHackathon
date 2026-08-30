# Remote resources

SeamScript can use data, models, and algorithms outside the project.

The `.seam` file contains short names only.

## Separation

The study selects a readable resource name.

The catalog defines its connector and contract.

The connections file defines its service address and token variable.

This design keeps addresses and secrets out of user studies.

## Data

The active remote data path uses a bounded HTTP JSON gateway.

The request includes planned columns, filters, contracts, and the plan fingerprint.

The response must include an exact data snapshot.

Apache Arrow defines Flight SQL for remote SQL data.

The current Arrow JavaScript stack lacks direct Flight SQL support.

Use an ADBC sidecar or an HTTP gateway with this Node runtime.

[Flight SQL format](https://arrow.apache.org/docs/format/FlightSql.html) · [ADBC JavaScript](https://arrow.apache.org/adbc/24/javascript/quickstart.html)

## Models

The registry can resolve an MLflow alias, such as `champion`.

The resolver checks approval and calibration tags.

It freezes the alias to an exact version and digest.

KServe V2 serves that exact version.

The runtime checks the input and output contract identifiers.

[MLflow model aliases](https://mlflow.org/docs/latest/ml/model-registry/workflow) · [KServe V2 protocol](https://kserve.github.io/website/docs/concepts/architecture/data-plane/v2-protocol)

## Algorithms

OpenAPI services can provide comparison and simulation algorithms.

Each catalog entry fixes the operation, release, input, and output.

The runtime sends an idempotency key with safe remote requests.

It retries only transient failures.

[OpenAPI specification](https://spec.openapis.org/oas/latest.html)

## Failure rule

The default rule is `stop`.

SeamScript does not train or choose an undeclared model.

## Example files

- `examples/fastball-slider.seam`
- `examples/seam.catalog.yml`
- `examples/seam.connections.yml`

The example addresses use the reserved `.invalid` domain.
