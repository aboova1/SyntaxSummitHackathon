# Baseball data contract

The runtime reads one row for each delivered pitch.

Each field has a type, feature group, and availability time.

The source registry lives in `src/domain/baseball-fields.ts`.

## Required identity fields

- `game_id`
- `plate_appearance_id`
- `pitch_number`
- `season`
- `game_type`
- `pitch_name`
- `description`

These fields preserve pitch order and plate-appearance boundaries.

## Fact groups

- Batter history
- Pitcher form
- Pitch shape
- Sequence history
- Game situation
- Ballpark
- Defense

The current registry defines more than 70 fields.

Examples include batter chase rate, pitcher rolling whiff rate, and expected pitch movement.

It also includes count, leverage, park factors, catcher framing, and fielder quality.

## Time rule

Only `before pitch` fields can enter a prediction request.

Later fields can define the target label.

They cannot become input facts for that target.

Historical rates must use records before the target pitch.

Count filters apply to target pitches after the runtime builds pitch history.

Remote gateways receive count values in `target_filters` for this reason.

The plan records every selected feature column.

## Missing fields

Required fields stop execution when missing.

Optional fields create a warning.

The model receives only fields that exist in both contracts.

## Data source response

The HTTP data connector expects this JSON form:

```json
{
  "snapshot": "exact-source-snapshot",
  "records": []
}
```

The request contains only planned columns and filters.

The source must return an exact snapshot identifier.

## Demonstration data

`data/sample-pitches.csv` contains 31,104 synthetic rows.

The generator is `scripts/generate-demo-data.ts`.

The file supports deterministic product tests only.
