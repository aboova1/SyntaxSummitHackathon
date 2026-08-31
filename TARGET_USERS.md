# Target users

## 1. Pregame game-plan coordinator

This user prepares pitch plans for an opponent.

The user tests calls for important counts and batters.

SeamScript shows all outcome chances for each call.

It also ranks calls for one selected goal.

This user is the first product target.

The user has time to review the result before a game.

### Main decision

Which pitch calls should enter the game plan for this batter and count?

### Success measure

The user gets a checked answer without a new analyst request.

## 2. Catching coordinator

This user reviews the quality of pitch calls.

The system must separate the call from pitch execution.

Each call must contain the intended pitch type and location.

Public Statcast does not reliably contain this intent.

A production review needs private call, target, and call-source data.

### Main decision

Did the catcher select a strong call for the known situation?

### Success measure

The review controls for pitcher, batter, count, game state, and execution.

## 3. Pitching coach

This user needs a short answer during an inning break.

The product must use loaded data and an approved model version.

It must return three ranked calls in less than one second.

Each call must show its chance and uncertainty.

This release must follow the pregame release.

### Main decision

Which available pitch and target location best support the current goal?

### Success measure

The coach receives a clear answer before play starts again.

## Product order

1. Build the reviewed pregame workflow.
2. Add catcher review when private call data exists.
3. Add the in-game workflow after speed and reliability tests.

The product supports a coach. It does not replace the coach.

## Example

```seam
situation:
  pitcher: Alex Morgan
  batter: Taylor Kim
  count: 1-2
  previous pitch: four-seam fastball
  previous location: high and inside
  previous result: foul
  outs: 1
  runners: first
  score: tied

question:
  best pitch for: swing and miss
```
